import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth/session";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Attendance Tracker" },
      { name: "description", content: "Sign in to sync your attendance across devices." },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim(), name: name.trim() },
          },
        });
        if (error) throw error;
        toast.success(`Welcome, ${name.trim() || "friend"} — you're signed in`);
        navigate({ to: "/" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("We sent a 6-digit code to your email");
        setMode("otp");
      } else {
        const { error } = await supabase.auth.verifyOtp({
          email,
          token: code.trim(),
          type: "recovery",
        });
        if (error) throw error;
        const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
        if (updErr) throw updErr;
        toast.success("Password updated — you're signed in");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    mode === "login"
      ? "Sign in to your account"
      : mode === "signup"
        ? "Create a new account"
        : mode === "forgot"
          ? "We'll email you a verification code"
          : "Enter the code and your new password";

  const cta = busy
    ? "Please wait..."
    : mode === "login"
      ? "Sign in"
      : mode === "signup"
        ? "Create account"
        : mode === "forgot"
          ? "Send code"
          : "Reset password";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>

        <Card className="p-5 rounded-2xl">
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <label className="block">
                <span className="text-sm font-medium">Full name</span>
                <Input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl"
                />
              </label>
            )}

            {mode !== "otp" && (
              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl"
                />
              </label>
            )}

            {(mode === "login" || mode === "signup") && (
              <label className="block">
                <span className="text-sm font-medium">Password</span>
                <Input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl"
                />
              </label>
            )}

            {mode === "otp" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Code sent to <span className="font-medium text-foreground">{email}</span>
                </p>
                <label className="block">
                  <span className="text-sm font-medium">6-digit code</span>
                  <Input
                    inputMode="numeric"
                    required
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1.5 h-11 rounded-xl tracking-[0.4em] text-center"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">New password</span>
                  <Input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1.5 h-11 rounded-xl"
                  />
                </label>
              </>
            )}

            <Button type="submit" disabled={busy} className="w-full rounded-full h-11">
              {cta}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm space-y-1.5">
            {mode === "login" && (
              <>
                <div>
                  <button
                    onClick={() => setMode("forgot")}
                    className="text-primary font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="text-muted-foreground">
                  New here?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="text-primary font-medium hover:underline"
                  >
                    Create an account
                  </button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div className="text-muted-foreground">
                Have an account?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </div>
            )}
            {mode === "otp" && (
              <div>
                <button
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    setBusy(false);
                    if (error) toast.error(error.message);
                    else toast.success("New code sent");
                  }}
                  disabled={busy}
                  className="text-primary font-medium hover:underline"
                >
                  Resend code
                </button>
              </div>
            )}
            {(mode === "forgot" || mode === "otp") && (
              <div>
                <button
                  onClick={() => setMode("login")}
                  className="text-muted-foreground inline-flex items-center gap-1 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
              </div>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Your data is stored securely and synced to your account.
        </p>
      </div>
    </div>
  );
}
