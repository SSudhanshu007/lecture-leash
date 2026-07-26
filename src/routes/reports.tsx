import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { useDB } from "@/lib/attendance/store";
import { computeSubjectStats, overallStats } from "@/lib/attendance/calc";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — Attendance Tracker" }] }),
  component: Reports,
});

function Reports() {
  const activeId = useDB((s) => s.settings.activeSemesterId);
  const subjects = useDB((s) => s.subjects.filter((x) => x.semesterId === activeId));
  const records = useDB((s) => s.records.filter((x) => x.semesterId === activeId));

  const overall = overallStats(subjects, records);

  const pieData = useMemo(() => {
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const cancelled = records.filter((r) => r.status === "cancelled").length;
    const holiday = records.filter((r) => r.status === "holiday").length;
    return [
      { name: "Present", value: present, color: "var(--color-success)" },
      { name: "Absent", value: absent, color: "var(--color-destructive)" },
      { name: "Cancelled", value: cancelled, color: "var(--color-muted-foreground)" },
      { name: "Holiday", value: holiday, color: "var(--color-warning)" },
    ].filter((x) => x.value > 0);
  }, [records]);

  const bySubject = useMemo(() => subjects.map((s) => {
    const st = computeSubjectStats(s, records);
    return { name: s.name.slice(0, 8), pct: Math.round(st.percentage), fill: s.color };
  }), [subjects, records]);

  return (
    <AppShell title="Reports">
      <div className="px-5 pt-4 space-y-4">
        <Card className="p-5 rounded-3xl">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Overall</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums">{overall.percentage.toFixed(1)}%</div>
          <div className="mt-1 text-sm text-muted-foreground">{overall.present} present · {overall.conducted} conducted</div>
        </Card>

        {pieData.length > 0 && (
          <Card className="p-5 rounded-3xl">
            <h3 className="text-sm font-semibold mb-3">Distribution</h3>
            <div className="h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {bySubject.length > 0 && (
          <Card className="p-5 rounded-3xl">
            <h3 className="text-sm font-semibold mb-3">By subject</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={bySubject} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="pct" radius={[8, 8, 0, 0]}>
                    {bySubject.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold px-1">Detail</h3>
          {subjects.length === 0 && (
            <Card className="p-8 rounded-2xl text-center border-dashed">
              <PieIcon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nothing to report yet.</p>
            </Card>
          )}
          {subjects.map((s) => {
            const st = computeSubjectStats(s, records);
            return (
              <Card key={s.id} className="p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-xl grid place-items-center text-white text-sm font-semibold shrink-0" style={{ background: s.color }}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">target {s.target}%</p>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">{st.percentage.toFixed(0)}%</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <Stat label="Present" value={st.present} />
                  <Stat label="Absent" value={st.absent} />
                  <Stat label="Total" value={st.conducted} />
                  <Stat label={st.percentage >= s.target ? "Can skip" : "Need"} value={st.percentage >= s.target ? st.bunkable : st.needed} accent />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-2 ${accent ? "bg-primary-container text-on-primary-container" : "bg-muted"}`}>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}
