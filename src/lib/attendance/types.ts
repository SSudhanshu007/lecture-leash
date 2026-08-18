export type UUID = string;

export type AttendanceStatus = "present" | "absent" | "cancelled" | "holiday";

export interface Subject {
  id: UUID;
  semesterId: UUID;
  name: string;
  code?: string;
  faculty?: string;
  color: string; // hex
  target: number; // 0-100
}

export interface Semester {
  id: UUID;
  name: string;
  createdAt: string;
}

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6; // Mon-Sat

export interface Lecture {
  id: UUID;
  semesterId: UUID;
  subjectId: UUID;
  weekday: Weekday;
  start: string; // "09:00"
  end: string; // "10:00"
  room?: string;
  teacher?: string;
  isExtra?: boolean; // one-off extra class, not part of the weekly timetable
  date?: string; // YYYY-MM-DD, only for extra classes
  effectiveFrom?: string; // YYYY-MM-DD, first date this slot applies (inclusive)
  effectiveTo?: string; // YYYY-MM-DD, last date this slot applies (inclusive)
}

export interface AttendanceRecord {
  id: UUID; // `${date}-${lectureId}`
  date: string; // YYYY-MM-DD
  lectureId: UUID;
  subjectId: UUID;
  semesterId: UUID;
  status: AttendanceStatus;
  updatedAt: string;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  defaultTarget: number;
  activeSemesterId?: UUID;
}

export interface DBState {
  version: 1;
  semesters: Semester[];
  subjects: Subject[];
  lectures: Lecture[];
  records: AttendanceRecord[];
  settings: AppSettings;
}
