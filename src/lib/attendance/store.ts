import { useSyncExternalStore } from "react";
import type {
  AttendanceRecord,
  AttendanceStatus,
  DBState,
  Lecture,
  Semester,
  Subject,
  UUID,
  Weekday,
} from "./types";

const KEY = "attendance-tracker-v1";

const DEFAULT: DBState = {
  version: 1,
  semesters: [],
  subjects: [],
  lectures: [],
  records: [],
  settings: { theme: "system", defaultTarget: 75 },
};

function isBrowser() {
  return typeof window !== "undefined";
}

function read(): DBState {
  if (!isBrowser()) return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as DBState;
    return { ...DEFAULT, ...parsed, settings: { ...DEFAULT.settings, ...parsed.settings } };
  } catch {
    return DEFAULT;
  }
}

let state: DBState = DEFAULT;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (!hydrated && isBrowser()) {
    state = read();
    hydrated = true;
  }
}

function persist() {
  if (isBrowser()) localStorage.setItem(KEY, JSON.stringify(state));
}

function set(updater: (s: DBState) => DBState) {
  ensureHydrated();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): DBState {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): DBState {
  return DEFAULT;
}

export function useDB<T>(selector: (s: DBState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getServerSnapshot()),
  );
}

export function getDB() {
  ensureHydrated();
  return state;
}

const uid = () =>
  isBrowser() && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// Semester
export function createSemester(name: string): Semester {
  const s: Semester = { id: uid(), name, createdAt: new Date().toISOString() };
  set((st) => ({
    ...st,
    semesters: [...st.semesters, s],
    settings: { ...st.settings, activeSemesterId: st.settings.activeSemesterId ?? s.id },
  }));
  return s;
}

export function setActiveSemester(id: UUID) {
  set((st) => ({ ...st, settings: { ...st.settings, activeSemesterId: id } }));
}

export function deleteSemester(id: UUID) {
  set((st) => ({
    ...st,
    semesters: st.semesters.filter((s) => s.id !== id),
    subjects: st.subjects.filter((s) => s.semesterId !== id),
    lectures: st.lectures.filter((l) => l.semesterId !== id),
    records: st.records.filter((r) => r.semesterId !== id),
    settings: {
      ...st.settings,
      activeSemesterId:
        st.settings.activeSemesterId === id
          ? st.semesters.find((s) => s.id !== id)?.id
          : st.settings.activeSemesterId,
    },
  }));
}

// Subject
export function createSubject(input: Omit<Subject, "id">): Subject {
  const s: Subject = { ...input, id: uid() };
  set((st) => ({ ...st, subjects: [...st.subjects, s] }));
  return s;
}
export function updateSubject(id: UUID, patch: Partial<Subject>) {
  set((st) => ({
    ...st,
    subjects: st.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }));
}
export function deleteSubject(id: UUID) {
  set((st) => ({
    ...st,
    subjects: st.subjects.filter((s) => s.id !== id),
    lectures: st.lectures.filter((l) => l.subjectId !== id),
    records: st.records.filter((r) => r.subjectId !== id),
  }));
}

// Lecture
export function createLecture(input: Omit<Lecture, "id">): Lecture {
  const l: Lecture = { ...input, id: uid() };
  set((st) => ({ ...st, lectures: [...st.lectures, l] }));
  return l;
}
export function updateLecture(id: UUID, patch: Partial<Lecture>) {
  set((st) => ({
    ...st,
    lectures: st.lectures.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }));
}
export function deleteLecture(id: UUID) {
  set((st) => ({
    ...st,
    lectures: st.lectures.filter((l) => l.id !== id),
    records: st.records.filter((r) => r.lectureId !== id),
  }));
}
export function duplicateDay(from: Weekday, to: Weekday, semesterId: UUID) {
  set((st) => {
    const src = st.lectures.filter((l) => l.semesterId === semesterId && l.weekday === from);
    const cleared = st.lectures.filter((l) => !(l.semesterId === semesterId && l.weekday === to));
    const copies = src.map((l) => ({ ...l, id: uid(), weekday: to }));
    return { ...st, lectures: [...cleared, ...copies] };
  });
}

// Attendance
export function setStatus(
  date: string,
  lecture: Lecture,
  status: AttendanceStatus | null,
) {
  set((st) => {
    const key = `${date}-${lecture.id}`;
    const rest = st.records.filter((r) => r.id !== key);
    if (!status) return { ...st, records: rest };
    const rec: AttendanceRecord = {
      id: key,
      date,
      lectureId: lecture.id,
      subjectId: lecture.subjectId,
      semesterId: lecture.semesterId,
      status,
      updatedAt: new Date().toISOString(),
    };
    return { ...st, records: [...rest, rec] };
  });
}

// Settings
export function updateSettings(patch: Partial<DBState["settings"]>) {
  set((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
}

// Backup
export function exportJSON(): string {
  return JSON.stringify(getDB(), null, 2);
}
export function importJSON(json: string) {
  const data = JSON.parse(json) as DBState;
  set(() => ({ ...DEFAULT, ...data, settings: { ...DEFAULT.settings, ...data.settings } }));
}
export function resetAll() {
  set(() => DEFAULT);
}
