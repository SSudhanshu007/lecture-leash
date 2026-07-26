import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDB, setStatus } from "@/lib/attendance/store";
import {
  computeSubjectStats,
  overallStats,
  todaysLectures,
  ymd,
  WEEKDAYS_FULL,
  weekdayOf,
} from "@/lib/attendance/calc";
import type { AttendanceStatus } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Attendance Tracker — Home" },
      { name: "description", content: "Track class attendance, hit your target, know when you can skip." },
      { property: "og:title", content: "Attendance Tracker — Home" },
      { property: "og:description", content: "Track class attendance, hit your target, know when you can skip." },
    ],
  }),
  component: Home,
});

const STATUS_META: Record<AttendanceStatus, { label: string; emoji: string; className: string }> = {
  present: { label: "Present", emoji: "✓", className: "bg-success text-white" },
  absent: { label: "Absent", emoji: "✕", className: "bg-destructive text-destructive-foreground" },
  cancelled: { label: "Cancelled", emoji: "—", className: "bg-muted text-foreground" },
  holiday: { label: "Holiday", emoji: "★", className: "bg-warning text-black" },
};

function Home() {
  const navigate = useNavigate();
  const semesters = useDB((s) => s.semesters);
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const lectures = useDB((s) => s.lectures.filter((x) => x.semesterId === activeId));
  const records = useDB((s) => s.records.filter((x) => x.semesterId === activeId));

  const today = useMemo(() => new Date(), []);
  const dateStr = ymd(today);
  const todays = todaysLectures(lectures, today, activeId);
  const overall = overallStats(subjects, records);

  if (semesters.length === 0) {
    return <FirstRun onCreate={() => navigate({ to: "/setup" })} />;
  }

  const setLectureStatus = (lectureId: string, status: AttendanceStatus | null) => {
    const l = lectures.find((x) => x.id === lectureId);
    if (l) setStatus(dateStr, l, status);
  };

  const recordFor = (lectureId: string) =>
    records.find((r) => r.date === dateStr && r.lectureId === lectureId);

  return (
    <AppShell
      title="Attendance"
      action={
        <Link to="/timetable">
          <Button size="sm" variant="ghost" className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Class
          </Button>
        </Link>
      }
    >
      <div className="px-5 pt-5 space-y-6">
        {/* Overall card */}
        <Card className="p-6 rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-0 shadow-lg">
          <div className="text-xs uppercase tracking-wider opacity-80">Overall attendance</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums">{overall.percentage.toFixed(1)}</span>
            <span className="text-lg opacity-80">%</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white/90" style={{ width: `${Math.min(100, overall.percentage)}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-sm opacity-90">
            <span>{overall.present} attended</span>
            <span>{overall.conducted} conducted</span>
          </div>
        </Card>

        {/* Today */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold">Today</h2>
              <p className="text-xs text-muted-foreground">
                {WEEKDAYS_FULL[weekdayOf(today)]}, {today.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{todays.length} class{todays.length === 1 ? "" : "es"}</span>
          </div>

          {todays.length === 0 ? (
            <Card className="p-8 rounded-2xl text-center border-dashed">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary-container text-on-primary-container grid place-items-center mb-3">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {weekdayOf(today) === 0 ? "It's Sunday — enjoy the day off." : "No classes scheduled today."}
              </p>
              <Link to="/timetable" className="inline-block mt-3">
                <Button variant="outline" size="sm" className="rounded-full">Edit timetable</Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {todays.map((l) => {
                const subj = subjects.find((s) => s.id === l.subjectId);
                if (!subj) return null;
                const rec = recordFor(l.id);
                return (
                  <Card key={l.id} className="p-4 rounded-2xl border-border/60">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-10 w-1.5 rounded-full shrink-0" style={{ background: subj.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{subj.name}</p>
                          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                            {l.start}–{l.end}
                          </span>
                        </div>
                        {(l.room || l.teacher) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[l.room, l.teacher].filter(Boolean).join(" • ")}
                          </p>
                        )}
                        <div className="mt-3 grid grid-cols-4 gap-1.5">
                          {(Object.keys(STATUS_META) as AttendanceStatus[]).map((st) => {
                            const active = rec?.status === st;
                            const meta = STATUS_META[st];
                            return (
                              <button
                                key={st}
                                onClick={() => setLectureStatus(l.id, active ? null : st)}
                                className={cn(
                                  "text-[11px] font-medium h-9 rounded-full border transition-all",
                                  active
                                    ? meta.className + " border-transparent shadow-sm"
                                    : "bg-transparent border-border text-muted-foreground hover:bg-accent",
                                )}
                              >
                                <span className="mr-1">{meta.emoji}</span>
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Subjects */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Your subjects</h2>
            <Link to="/subjects" className="text-xs text-primary font-medium">See all</Link>
          </div>
          {subjects.length === 0 ? (
            <Card className="p-6 rounded-2xl text-center border-dashed">
              <p className="text-sm text-muted-foreground mb-3">No subjects yet.</p>
              <Link to="/subjects"><Button size="sm" className="rounded-full">Add subject</Button></Link>
            </Card>
          ) : (
            <div className="space-y-2">
              {subjects.map((s) => {
                const st = computeSubjectStats(s, records);
                const color =
                  st.status === "safe" ? "bg-success" : st.status === "warn" ? "bg-warning" : "bg-destructive";
                return (
                  <Card key={s.id} className="p-4 rounded-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-9 w-9 rounded-xl shrink-0 grid place-items-center text-white text-sm font-semibold" style={{ background: s.color }}>
                          {s.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {st.present}/{st.conducted} • target {s.target}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-semibold tabular-nums">{st.percentage.toFixed(0)}%</div>
                        <div className="text-[11px] text-muted-foreground">
                          {st.percentage >= s.target ? `can skip ${st.bunkable}` : `need ${st.needed}`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full transition-all", color)} style={{ width: `${Math.min(100, st.percentage)}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function FirstRun({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gradient-to-b from-primary-container/40 to-background">
      <div className="h-16 w-16 rounded-3xl bg-primary text-primary-foreground grid place-items-center shadow-lg mb-6">
        <GraduationCap className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Attendance Tracker</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        Set up your semester once. Mark daily attendance in seconds. Know exactly when you can skip.
      </p>
      <Button onClick={onCreate} size="lg" className="mt-8 rounded-full px-8">Get started</Button>
    </div>
  );
}
