import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Monitor, Download, Upload, Plus, Check, Trash2, LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDB, updateSettings, exportJSON, importJSON, resetAll,
  createSemester, setActiveSemester, deleteSemester,
} from "@/lib/attendance/store";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Attendance Tracker" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const settings = useDB((s) => s.settings);
  const semesters = useDB((s) => s.semesters);
  const [newSem, setNewSem] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const isDark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    if (settings.theme === "system") {
      const mq = matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [settings.theme]);

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  };

  const doImport = (file: File) => {
    file.text().then((txt) => {
      try { importJSON(txt); toast.success("Backup restored"); }
      catch { toast.error("Invalid file"); }
    });
  };

  return (
    <AppShell title="Settings">
      <div className="px-5 pt-4 space-y-5">
        <Section title="Theme">
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "light", label: "Light", icon: Sun },
              { v: "dark", label: "Dark", icon: Moon },
              { v: "system", label: "System", icon: Monitor },
            ] as const).map((o) => {
              const Icon = o.icon;
              const active = settings.theme === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => updateSettings({ theme: o.v })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors",
                    active ? "bg-primary-container text-on-primary-container border-transparent" : "border-border text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{o.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Default target attendance">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Applied to new subjects</span>
            <span className="font-semibold tabular-nums">{settings.defaultTarget}%</span>
          </div>
          <input type="range" min={50} max={100} step={5} value={settings.defaultTarget} onChange={(e) => updateSettings({ defaultTarget: Number(e.target.value) })} className="w-full accent-[var(--color-primary)]" />
        </Section>

        <Section title="Semesters">
          <div className="space-y-2 mb-3">
            {semesters.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted">
                <button onClick={() => setActiveSemester(s.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <span className={cn("h-6 w-6 rounded-full grid place-items-center shrink-0", settings.activeSemesterId === s.id ? "bg-primary text-primary-foreground" : "bg-background")}>
                    {settings.activeSemesterId === s.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="font-medium truncate">{s.name}</span>
                </button>
                <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => confirm(`Delete "${s.name}" and all its data?`) && deleteSemester(s.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newSem} onChange={(e) => setNewSem(e.target.value)} placeholder="New semester name" className="h-11 rounded-xl" />
            <Button
              className="rounded-full"
              disabled={!newSem.trim()}
              onClick={() => { createSemester(newSem.trim()); setNewSem(""); toast.success("Semester created"); }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Section>

        <Section title="Backup & restore">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-full" onClick={doExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          </div>
        </Section>

        <Section title="Danger zone">
          <Button
            variant="outline"
            className="w-full rounded-full text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => { if (confirm("Erase all data? This cannot be undone.")) { resetAll(); toast.success("All data cleared"); navigate({ to: "/" }); } }}
          >
            Clear all data
          </Button>
        </Section>

        <p className="text-center text-xs text-muted-foreground pt-4 pb-2">
          Attendance Tracker · Offline · Data stored on this device
        </p>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</h2>
      <Card className="p-4 rounded-2xl">{children}</Card>
    </section>
  );
}
