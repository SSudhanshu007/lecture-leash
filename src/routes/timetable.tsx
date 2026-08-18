import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useDB,
  createLecture,
  duplicateDay,
  editLectureFrom,
  endLectureFrom,
  todayKey,
} from "@/lib/attendance/store";
import type { Lecture, Weekday } from "@/lib/attendance/types";
import { WEEKDAYS_FULL } from "@/lib/attendance/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable — Attendance Tracker" },
      { name: "description", content: "Edit your weekly class timetable. Changes apply to future classes only, so past attendance stays intact." },
      { property: "og:title", content: "Timetable — Attendance Tracker" },
      { property: "og:description", content: "Edit your weekly class timetable. Changes apply to future classes only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Timetable,
});

const DAYS: Weekday[] = [1, 2, 3, 4, 5, 6];

function prettyDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function Timetable() {
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const lectures = useDB((s) => s.lectures.filter((x) => x.semesterId === activeId));

  const [day, setDay] = useState<Weekday>(((new Date().getDay() || 1) as Weekday) > 6 ? 1 : ((new Date().getDay() || 1) as Weekday));
  const [addOpen, setAddOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [editing, setEditing] = useState<Lecture | null>(null);
  const [ending, setEnding] = useState<Lecture | null>(null);
  const [showPast, setShowPast] = useState(false);

  const today = todayKey();
  const dayLectures = useMemo(
    () =>
      lectures
        .filter((l) => !l.isExtra && l.weekday === day)
        .filter((l) => showPast || !l.effectiveTo || l.effectiveTo >= today)
        .sort((a, b) => a.start.localeCompare(b.start)),
    [lectures, day, showPast, today],
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

        <Card className="p-3 rounded-2xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Show past versions</p>
            <p className="text-xs text-muted-foreground">Slots that ended earlier in the semester</p>
          </div>
          <Switch checked={showPast} onCheckedChange={setShowPast} />
        </Card>

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
              const ended = !!l.effectiveTo && l.effectiveTo < today;
              const upcoming = !!l.effectiveFrom && l.effectiveFrom > today;
              return (
                <Card key={l.id} className={cn("p-4 rounded-2xl flex items-center gap-3", ended && "opacity-60")}>
                  <span className="h-10 w-1.5 rounded-full shrink-0" style={{ background: s?.color ?? "#888" }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {l.start}–{l.end}{l.room ? ` • ${l.room}` : ""}{l.teacher ? ` • ${l.teacher}` : ""}
                    </p>
                    {(ended || upcoming || l.effectiveFrom) && (
                      <p className="text-[11px] mt-0.5 text-muted-foreground">
                        {ended
                          ? `Ended ${prettyDate(l.effectiveTo!)}`
                          : upcoming
                            ? `Starts ${prettyDate(l.effectiveFrom!)}`
                            : `Since ${prettyDate(l.effectiveFrom!)}`}
                      </p>
                    )}
                  </div>
                  {!ended && (
                    <>
                      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => setEditing(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => setEnding(l)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddLectureDialog open={addOpen} onOpenChange={setAddOpen} day={day} semesterId={activeId} />
      <DuplicateDialog open={dupOpen} onOpenChange={setDupOpen} day={day} semesterId={activeId} />
      <EditLectureDialog lecture={editing} onClose={() => setEditing(null)} semesterId={activeId} />
      <EndLectureDialog lecture={ending} onClose={() => setEnding(null)} />
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
  const [from, setFrom] = useState(todayKey());

  const save = () => {
    if (!subjectId) return;
    createLecture({
      semesterId, subjectId, weekday: day, start, end,
      room: room || undefined, teacher: teacher || undefined,
      effectiveFrom: from || undefined,
    });
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
          <label className="text-xs text-muted-foreground block">
            Applies from
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 rounded-xl" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={!subjectId} className="rounded-full">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLectureDialog({ lecture, onClose, semesterId }: {
  lecture: Lecture | null; onClose: () => void; semesterId: string;
}) {
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === semesterId));
  const [subjectId, setSubjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [weekday, setWeekday] = useState<string>("1");
  const [from, setFrom] = useState(todayKey());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (lecture && loadedFor !== lecture.id) {
    setLoadedFor(lecture.id);
    setSubjectId(lecture.subjectId);
    setStart(lecture.start);
    setEnd(lecture.end);
    setRoom(lecture.room ?? "");
    setTeacher(lecture.teacher ?? "");
    setWeekday(String(lecture.weekday));
    setFrom(todayKey());
  }

  const save = () => {
    if (!lecture) return;
    editLectureFrom(
      lecture.id,
      {
        subjectId,
        weekday: Number(weekday) as Weekday,
        start,
        end,
        room: room || undefined,
        teacher: teacher || undefined,
      },
      from || todayKey(),
    );
    onClose();
  };

  return (
    <Dialog open={!!lecture} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Edit class</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choose subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Day" /></SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAYS_FULL[d]}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Start<Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
            <label className="text-xs text-muted-foreground">End<Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-11 rounded-xl" /></label>
          </div>
          <Input placeholder="Classroom (optional)" value={room} onChange={(e) => setRoom(e.target.value)} className="h-11 rounded-xl" />
          <Input placeholder="Teacher (optional)" value={teacher} onChange={(e) => setTeacher(e.target.value)} className="h-11 rounded-xl" />
          <label className="text-xs text-muted-foreground block">
            Apply changes from
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 rounded-xl" />
          </label>
          <p className="text-xs text-muted-foreground">
            Classes before this date keep the old schedule and their attendance stays untouched.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={!subjectId} className="rounded-full">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndLectureDialog({ lecture, onClose }: { lecture: Lecture | null; onClose: () => void }) {
  const [from, setFrom] = useState(todayKey());
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (lecture && loadedFor !== lecture.id) {
    setLoadedFor(lecture.id);
    setFrom(todayKey());
  }
  return (
    <Dialog open={!!lecture} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Remove class</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This class stops appearing from the date below. Earlier dates and their attendance are kept.
        </p>
        <label className="text-xs text-muted-foreground block">
          Remove from
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 rounded-xl" />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => { if (lecture) endLectureFrom(lecture.id, from || todayKey()); onClose(); }}
            className="rounded-full"
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({ open, onOpenChange, day, semesterId }: {
  open: boolean; onOpenChange: (v: boolean) => void; day: Weekday; semesterId: string;
}) {
  const [target, setTarget] = useState<string>("");
  const [from, setFrom] = useState(todayKey());
  const doDup = () => {
    if (!target) return;
    duplicateDay(day, Number(target) as Weekday, semesterId, from || todayKey());
    onOpenChange(false);
    setTarget("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Duplicate {WEEKDAYS_FULL[day]}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Copy this day's classes to another day, starting from the chosen date. Past classes stay untouched.</p>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Copy to..." /></SelectTrigger>
          <SelectContent>
            {DAYS.filter((d) => d !== day).map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAYS_FULL[d]}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="text-xs text-muted-foreground block">
          Applies from
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 rounded-xl" />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={doDup} disabled={!target} className="rounded-full">Copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
