import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDB, setStatus } from "@/lib/attendance/store";
import { todaysLectures, ymd, WEEKDAYS_FULL, weekdayOf } from "@/lib/attendance/calc";
import type { AttendanceStatus } from "@/lib/attendance/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendar")({
  head: () => ({ meta: [{ title: "Calendar — Attendance Tracker" }] }),
  component: CalendarPage,
});

const STATUS: Record<AttendanceStatus, { emoji: string; className: string; label: string }> = {
  present: { emoji: "✓", className: "bg-success text-white", label: "Present" },
  absent: { emoji: "✕", className: "bg-destructive text-destructive-foreground", label: "Absent" },
  cancelled: { emoji: "—", className: "bg-muted text-foreground", label: "Cancelled" },
  holiday: { emoji: "★", className: "bg-warning text-black", label: "Holiday" },
};

function CalendarPage() {
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const lectures = useDB((s) => s.lectures.filter((x) => x.semesterId === activeId));
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const records = useDB((s) => s.records.filter((x) => x.semesterId === activeId));

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<Date>(new Date());

  const { grid, monthLabel } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWD = first.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWD; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return { grid: cells, monthLabel: cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  }, [cursor]);

  const dateStr = ymd(selected);
  const dayLectures = todaysLectures(lectures, selected, activeId);
  const recordFor = (id: string) => records.find((r) => r.date === dateStr && r.lectureId === id);

  return (
    <AppShell title="Calendar">
      <div className="px-5 pt-4 space-y-4">
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="font-semibold">{monthLabel}</div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const ds = ymd(d);
              const marks = records.filter((r) => r.date === ds);
              const isSel = ds === ymd(selected);
              const isToday = ds === ymd(new Date());
              const hasClasses = todaysLectures(lectures, d, activeId).length > 0;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className={cn(
                    "aspect-square rounded-xl text-sm flex flex-col items-center justify-center gap-0.5 relative transition-colors",
                    isSel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    !isSel && isToday && "ring-1 ring-primary",
                  )}
                >
                  <span className={cn("tabular-nums", !isSel && !hasClasses && "text-muted-foreground")}>{d.getDate()}</span>
                  {marks.length > 0 && (
                    <span className={cn("h-1 w-1 rounded-full", isSel ? "bg-primary-foreground" : "bg-primary")} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <section>
          <h2 className="text-sm font-semibold mb-2">
            {WEEKDAYS_FULL[weekdayOf(selected)]}, {selected.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </h2>
          {dayLectures.length === 0 ? (
            <Card className="p-6 rounded-2xl text-center text-sm text-muted-foreground border-dashed">No classes scheduled.</Card>
          ) : (
            <div className="space-y-2">
              {dayLectures.map((l) => {
                const s = subjects.find((x) => x.id === l.subjectId);
                const rec = recordFor(l.id);
                return (
                  <Card key={l.id} className="p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-1.5 rounded-full shrink-0" style={{ background: s?.color ?? "#888" }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s?.name ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{l.start}–{l.end}</p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      {(Object.keys(STATUS) as AttendanceStatus[]).map((st) => {
                        const active = rec?.status === st;
                        return (
                          <button
                            key={st}
                            onClick={() => setStatus(dateStr, l, active ? null : st)}
                            className={cn(
                              "text-[11px] h-8 rounded-full border font-medium",
                              active ? STATUS[st].className + " border-transparent" : "bg-transparent border-border text-muted-foreground",
                            )}
                          >
                            {STATUS[st].emoji} {STATUS[st].label}
                          </button>
                        );
                      })}
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
