import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
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

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created — you're signed in");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset email sent");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" && "Sign in to your account"}
            {mode === "signup" && "Create a new account"}
            {mode === "forgot" && "Reset your password"}
          </p>
        </div>

        <Card className="p-5 rounded-2xl">
          <form onSubmit={submit} className="space-y-3">
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
            {mode !== "forgot" && (
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
            <Button type="submit" disabled={busy} className="w-full rounded-full h-11">
              {busy
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
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
            {mode === "forgot" && (
              <div className="text-muted-foreground">
                Remembered it?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-primary font-medium hover:underline"
                >
                  Back to sign in
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
