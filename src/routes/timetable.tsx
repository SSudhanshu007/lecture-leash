import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Copy, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDB, createLecture, deleteLecture, duplicateDay } from "@/lib/attendance/store";
import type { Weekday } from "@/lib/attendance/types";
import { WEEKDAYS_FULL } from "@/lib/attendance/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timetable")({
  head: () => ({ meta: [{ title: "Timetable — Attendance Tracker" }] }),
  component: Timetable,
});

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6];

function Timetable() {
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const lectures = useDB((s) => s.lectures.filter((x) => x.semesterId === activeId));

  const [day, setDay] = useState<Weekday>(((new Date().getDay() || 1) as Weekday) > 6 ? 1 : ((new Date().getDay() || 1) as Weekday));
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);

  const dayLectures = useMemo(
    () => lectures.filter((l) => l.weekday === day).sort((a, b) => a.start.localeCompare(b.start)),
    [lectures, day],
  );

  if (!activeId) {
    return (
      <AppShell title="Timetable">
        <div className="p-8 text-center text-sm text-muted-foreground">Create a semester first.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Timetable">
      <div className="px-5 pt-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hidden -mx-5 px-5">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={cn(
                "px-4 h-10 rounded-full text-sm font-medium shrink-0 transition-colors",
                day === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {WEEKDAYS_FULL[d].slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)} className="flex-1 rounded-full" disabled={subjects.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Add class
          </Button>
          <Button variant="outline" onClick={() => setDupOpen(true)} className="rounded-full">
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {subjects.length === 0 && (
          <Card className="p-4 rounded-2xl text-sm text-muted-foreground text-center border-dashed">
            Add subjects from the Subjects tab first.
          </Card>
        )}

        {dayLectures.length === 0 ? (
          <Card className="p-8 rounded-2xl text-center border-dashed">
            <p className="text-sm text-muted-foreground">No classes on {WEEKDAYS_FULL[day]} yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {dayLectures.map((l) => {
              const s = subjects.find((x) => x.id === l.subjectId);
              return (
                <Card key={l.id} className="p-4 rounded-2xl flex items-center gap-3">
                  <span className="h-10 w-1.5 rounded-full shrink-0" style={{ background: s?.color ?? "#888" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {l.start}–{l.end}{l.room ? ` • ${l.room}` : ""}{l.teacher ? ` • ${l.teacher}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => deleteLecture(l.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddLectureDialog open={addOpen} onOpenChange={setAddOpen} day={day} semesterId={activeId} />
      <DuplicateDialog open={dupOpen} onOpenChange={setDupOpen} day={day} semesterId={activeId} />
    </AppShell>
  );
}

function AddLectureDialog({ open, onOpenChange, day, semesterId }: {
  open: boolean; onOpenChange: (v: boolean) => void; day: Weekday; semesterId: string;
}) {
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === semesterId));
  const [subjectId, setSubjectId] = useState<string>("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");

  const save = () => {
    if (!subjectId) return;
    createLecture({ semesterId, subjectId, weekday: day, start, end, room: room || undefined, teacher: teacher || undefined });
    onOpenChange(false);
    setRoom(""); setTeacher("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Add class · {WEEKDAYS_FULL[day]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choose subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Start<Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-xs text-muted-foreground">End<Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
          </div>
          <Input placeholder="Classroom (optional)" value={room} onChange={(e) => setRoom(e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder="Teacher (optional)" value={teacher} onChange={(e) => setTeacher(e.target.value)} className="h-11 rounded-xl" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={!subjectId} className="rounded-full">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ open, onOpenChange, day, semesterId }: {
  open: boolean; onOpenChange: (v: boolean) => void; day: Weekday; semesterId: string;
}) {
  const [target, setTarget] = useState<string>("");
  const doDup = () => {
    if (!target) return;
    duplicateDay(day, Number(target) as Weekday, semesterId);
    onOpenChange(false);
    setTarget("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Duplicate {WEEKDAYS_FULL[day]}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Copy this day's classes to another day. Existing classes on that day will be replaced.</p>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Copy to..." /></SelectTrigger>
          <SelectContent>
            {DAYS.filter((d) => d !== day).map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAYS_FULL[d]}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={doDup} disabled={!target} className="rounded-full">Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
