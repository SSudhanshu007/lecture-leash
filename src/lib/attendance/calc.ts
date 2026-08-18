import type { AttendanceRecord, Lecture, Subject } from "./types";

export interface SubjectStats {
  subject: Subject;
  present: number;
  absent: number;
  cancelled: number;
  holiday: number;
  conducted: number; // present + absent
  percentage: number; // 0-100
  needed: number; // classes to attend consecutively to reach target
  bunkable: number; // classes can miss while staying at/above target
  status: "safe" | "warn" | "critical";
}

export function computeSubjectStats(
  subject: Subject,
  records: AttendanceRecord[],
): SubjectStats {
  const rs = records.filter((r) => r.subjectId === subject.id);
  const present = rs.filter((r) => r.status === "present").length;
  const absent = rs.filter((r) => r.status === "absent").length;
  const cancelled = rs.filter((r) => r.status === "cancelled").length;
  const holiday = rs.filter((r) => r.status === "holiday").length;
  const conducted = present + absent;
  const percentage = conducted === 0 ? 0 : (present / conducted) * 100;
  const t = subject.target / 100;

  // needed: smallest x so that (present+x)/(conducted+x) >= t
  let needed = 0;
  if (percentage < subject.target && t < 1) {
    needed = Math.ceil((t * conducted - present) / (1 - t));
    if (needed < 0) needed = 0;
  }

  // bunkable: max x so that present/(conducted+x) >= t
  let bunkable = 0;
  if (percentage >= subject.target && t > 0) {
    bunkable = Math.floor(present / t - conducted);
    if (bunkable < 0) bunkable = 0;
  }

  const status: SubjectStats["status"] =
    percentage >= subject.target ? "safe" : percentage >= subject.target - 10 ? "warn" : "critical";

  return { subject, present, absent, cancelled, holiday, conducted, percentage, needed, bunkable, status };
}

export function overallStats(subjects: Subject[], records: AttendanceRecord[]) {
  const per = subjects.map((s) => computeSubjectStats(s, records));
  const present = per.reduce((a, b) => a + b.present, 0);
  const conducted = per.reduce((a, b) => a + b.conducted, 0);
  const percentage = conducted === 0 ? 0 : (present / conducted) * 100;
  return { per, present, conducted, percentage };
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(d: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return d.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function isLectureActiveOn(l: Lecture, dateKey: string) {
  if (l.effectiveFrom && dateKey < l.effectiveFrom) return false;
  if (l.effectiveTo && dateKey > l.effectiveTo) return false;
  return true;
}

export function todaysLectures(lectures: Lecture[], date: Date, semesterId?: string) {
  const wd = weekdayOf(date);
  const key = ymd(date);
  return lectures
    .filter((l) => !semesterId || l.semesterId === semesterId)
    .filter((l) => (l.isExtra ? l.date === key : wd !== 0 && l.weekday === wd && isLectureActiveOn(l, key)))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function addDays(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return ymd(dt);
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const SUBJECT_COLORS = [
  "#6750A4", "#006A6A", "#B3261E", "#7D5260",
  "#00629E", "#5B6B00", "#A03E00", "#4A6363",
];
