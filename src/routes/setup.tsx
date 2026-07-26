import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, GraduationCap, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createSemester, createSubject, useDB } from "@/lib/attendance/store";
import { SUBJECT_COLORS } from "@/lib/attendance/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [{ title: "Setup — Attendance Tracker" }] }),
  component: Setup,
});

interface DraftSubject {
  name: string;
  code: string;
  faculty: string;
  color: string;
  target: number;
}

function Setup() {
  const navigate = useNavigate();
  const defaultTarget = useDB((s) => s.settings.defaultTarget);
  const [step, setStep] = useState<1 | 2>(1);
  const [semName, setSemName] = useState("");
  const [subjects, setSubjects] = useState<DraftSubject[]>([]);
  const [draft, setDraft] = useState<DraftSubject>({
    name: "",
    code: "",
    faculty: "",
    color: SUBJECT_COLORS[0],
    target: defaultTarget,
  });

  const addSubject = () => {
    if (!draft.name.trim()) return;
    setSubjects((prev) => [...prev, draft]);
    setDraft({
      name: "",
      code: "",
      faculty: "",
      color: SUBJECT_COLORS[(subjects.length + 1) % SUBJECT_COLORS.length],
      target: defaultTarget,
    });
  };

  const finish = () => {
    const sem = createSemester(semName.trim() || "My Semester");
    subjects.forEach((s) => createSubject({ ...s, semesterId: sem.id, name: s.name.trim() }));
    navigate({ to: "/timetable" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-8 pb-4 max-w-xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn(step >= 1 && "text-primary font-semibold")}>Semester</span>
          <ArrowRight className="h-3 w-3" />
          <span className={cn(step >= 2 && "text-primary font-semibold")}>Subjects</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {step === 1 ? "Name your semester" : "Add your subjects"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1 ? "You can create more semesters later." : "You can edit these anytime from Subjects."}
        </p>
      </header>

      <main className="px-5 pb-32 max-w-xl mx-auto">
        {step === 1 ? (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Semester name</span>
              <Input
                value={semName}
                onChange={(e) => setSemName(e.target.value)}
                placeholder="e.g. Fall 2026"
                className="mt-2 h-12 rounded-xl"
                autoFocus
              />
            </label>
          </div>
        ) : (
          <div className="space-y-5">
            {subjects.length > 0 && (
              <div className="space-y-2">
                {subjects.map((s, i) => (
                  <Card key={i} className="p-3 rounded-2xl flex items-center gap-3">
                    <span className="h-9 w-9 rounded-xl grid place-items-center text-white text-sm font-semibold shrink-0" style={{ background: s.color }}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[s.code, s.faculty].filter(Boolean).join(" • ") || `target ${s.target}%`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSubjects((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
            <Card className="p-4 rounded-2xl space-y-3">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Subject name *"
                className="h-11 rounded-xl"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="Code"
                  className="h-11 rounded-xl"
                />
                <Input
                  value={draft.faculty}
                  onChange={(e) => setDraft({ ...draft, faculty: e.target.value })}
                  placeholder="Faculty"
                  className="h-11 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Color</label>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {SUBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft({ ...draft, color: c })}
                      className={cn("h-8 w-8 rounded-full transition-transform", draft.color === c && "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Target attendance</span>
                  <span className="text-foreground tabular-nums">{draft.target}%</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={draft.target}
                  onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
                  className="w-full mt-2 accent-[var(--color-primary)]"
                />
              </div>
              <Button onClick={addSubject} disabled={!draft.name.trim()} variant="secondary" className="w-full rounded-full">
                <Plus className="h-4 w-4 mr-1" /> Add subject
              </Button>
            </Card>
            {subjects.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">Add at least one subject to continue.</p>
            )}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="max-w-xl mx-auto p-4 flex gap-2">
          {step === 2 && (
            <Button variant="outline" className="rounded-full flex-1" onClick={() => setStep(1)}>Back</Button>
          )}
          <Button
            className="rounded-full flex-1"
            disabled={step === 2 && subjects.length === 0}
            onClick={() => (step === 1 ? setStep(2) : finish())}
          >
            {step === 1 ? "Continue" : "Finish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
