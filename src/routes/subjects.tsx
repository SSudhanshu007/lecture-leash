import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDB, createSubject, deleteSubject, updateSubject } from "@/lib/attendance/store";
import { SUBJECT_COLORS, computeSubjectStats } from "@/lib/attendance/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/subjects")({
  head: () => ({ meta: [{ title: "Subjects — Attendance Tracker" }] }),
  component: Subjects,
});

function Subjects() {
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const records = useDB((s) => s.records.filter((x) => x.semesterId === activeId));
  const defaultTarget = useDB((s) => s.settings.defaultTarget);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [manualFor, setManualFor] = useState<string | null>(null);

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || s.code?.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell
      title="Subjects"
      action={
        <Button size="sm" onClick={() => setOpen(true)} disabled={!activeId} className="rounded-full">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      }
    >
      <div className="px-5 pt-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subjects" className="h-11 rounded-full pl-9" />
        </div>

        {!activeId ? (
          <Card className="p-6 rounded-2xl text-center text-sm text-muted-foreground border-dashed">Create a semester first.</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 rounded-2xl text-center border-dashed">
            <p className="text-sm text-muted-foreground">{subjects.length === 0 ? "No subjects yet." : "No matches."}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const st = computeSubjectStats(s, records);
              return (
                <Card key={s.id} className="p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl grid place-items-center text-white font-semibold shrink-0" style={{ background: s.color }}>
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[s.code, s.faculty].filter(Boolean).join(" • ") || `target ${s.target}%`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-semibold tabular-nums">{st.percentage.toFixed(0)}%</div>
                      <div className="text-[11px] text-muted-foreground">{st.present}/{st.conducted}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" title="Enter attended / total manually" onClick={() => setManualFor(s.id)}>
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => confirm(`Delete ${s.name}?`) && deleteSubject(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {manualFor && (() => {
        const sub = subjects.find((x) => x.id === manualFor);
        return sub ? <ManualCountDialog key={sub.id} subject={sub} onClose={() => setManualFor(null)} /> : null;
      })()}

      {activeId && <AddSubjectDialog open={open} onOpenChange={setOpen} semesterId={activeId} defaultTarget={defaultTarget} />}
    </AppShell>
  );
}

function AddSubjectDialog({ open, onOpenChange, semesterId, defaultTarget }: {
  open: boolean; onOpenChange: (v: boolean) => void; semesterId: string; defaultTarget: number;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [target, setTarget] = useState(defaultTarget);

  const save = () => {
    if (!name.trim()) return;
    createSubject({ semesterId, name: name.trim(), code: code || undefined, faculty: faculty || undefined, color, target });
    setName(""); setCode(""); setFaculty(""); setColor(SUBJECT_COLORS[0]); setTarget(defaultTarget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>New subject</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Subject name *" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="h-11 rounded-xl" />
            <Input placeholder="Faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="mt-2 flex gap-2 flex-wrap">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn("h-8 w-8 rounded-full", color === c && "ring-2 ring-offset-2 ring-offset-card ring-foreground")} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground flex justify-between">
              <span>Target</span><span className="text-foreground tabular-nums">{target}%</span>
            </label>
            <input type="range" min={50} max={100} step={5} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full mt-2 accent-[var(--color-primary)]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={!name.trim()} className="rounded-full">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualCountDialog({ subject, onClose }: { subject: { id: string; name: string; manualAttended?: number; manualTotal?: number }; onClose: () => void }) {
  const [attended, setAttended] = useState(String(subject.manualAttended ?? 0));
  const [total, setTotal] = useState(String(subject.manualTotal ?? 0));
  const a = Math.max(0, Number(attended) || 0);
  const t = Math.max(0, Number(total) || 0);
  const invalid = a > t;

  const save = () => {
    if (invalid) return;
    updateSubject(subject.id, { manualAttended: a, manualTotal: t });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Enter counts — {subject.name}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Type how many classes you attended out of the total held. These counts are added on top of anything you mark day-to-day.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Attended</label>
            <Input inputMode="numeric" value={attended} onChange={(e) => setAttended(e.target.value.replace(/[^0-9]/g, ""))} className="h-11 rounded-xl mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Total classes</label>
            <Input inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9]/g, ""))} className="h-11 rounded-xl mt-1" />
          </div>
        </div>
        <p className={cn("text-xs", invalid ? "text-destructive" : "text-muted-foreground")}>
          {invalid ? "Attended can't be more than total." : t === 0 ? "Set both to 0 to remove the manual counts." : `${((a / t) * 100).toFixed(0)}% from manual entry`}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-full">Cancel</Button>
          <Button onClick={save} disabled={invalid} className="rounded-full">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
