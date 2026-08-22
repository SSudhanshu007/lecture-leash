import { useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const LEGACY_KEY = "attendance-tracker-v1";

const DEFAULT: DBState = {
  version: 1,
  semesters: [],
  subjects: [],
  lectures: [],
  records: [],
  settings: { theme: "system", defaultTarget: 75 },
};

let state: DBState = DEFAULT;
let hydrated = false;
let hydratingFor: string | null = null;
const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined";
}

function notify() {
  listeners.forEach((l) => l());
}

function set(updater: (s: DBState) => DBState) {
  state = updater(state);
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): DBState {
  return state;
}
function getServerSnapshot(): DBState {
  return DEFAULT;
}

export function useDB<T>(selector: (s: DBState) => T): T {
  const cache = useRef<{ state: DBState | null; value: T }>({
    state: null,
    value: undefined as unknown as T,
  });
  const get = (snap: DBState) => {
    if (cache.current.state !== snap) {
      cache.current = { state: snap, value: selector(snap) };
    }
    return cache.current.value;
  };
  return useSyncExternalStore(
    subscribe,
    () => get(getSnapshot()),
    () => get(getServerSnapshot()),
  );
}

export function getDB() {
  return state;
}

const uid = () =>
  isBrowser() && crypto.randomUUID
    ? crypto.randomUUID()
    : ([1e7] as any + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
      );

// ---------- Hydration ----------

interface DbRowSemester { id: string; name: string; created_at: string }
interface DbRowSubject { id: string; semester_id: string; name: string; code: string | null; faculty: string | null; color: string; target: number; manual_attended?: number | null; manual_total?: number | null }
interface DbRowLecture { id: string; semester_id: string; subject_id: string; weekday: number; start_time: string; end_time: string; room: string | null; teacher: string | null; is_extra?: boolean | null; date?: string | null; effective_from?: string | null; effective_to?: string | null }
interface DbRowRecord { id: string; date: string; lecture_id: string; subject_id: string; semester_id: string; status: AttendanceStatus; updated_at: string }
interface DbRowSettings { theme: "light" | "dark" | "system"; default_target: number; active_semester_id: string | null }

export async function hydrateFromSupabase(userId: string) {
  if (hydratingFor === userId && hydrated) return;
  hydratingFor = userId;
  const [semRes, subRes, lecRes, recRes, setRes] = await Promise.all([
    supabase.from("semesters").select("*").order("created_at", { ascending: true }),
    supabase.from("subjects").select("*"),
    supabase.from("lectures").select("*"),
    supabase.from("attendance_records").select("*"),
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const semesters: Semester[] = ((semRes.data ?? []) as DbRowSemester[]).map((r) => ({
    id: r.id, name: r.name, createdAt: r.created_at,
  }));
  const subjects: Subject[] = ((subRes.data ?? []) as DbRowSubject[]).map((r) => ({
    id: r.id, semesterId: r.semester_id, name: r.name,
    code: r.code ?? undefined, faculty: r.faculty ?? undefined,
    color: r.color, target: r.target,
    manualAttended: r.manual_attended ?? 0, manualTotal: r.manual_total ?? 0,
  }));
  const lectures: Lecture[] = ((lecRes.data ?? []) as DbRowLecture[]).map((r) => ({
    id: r.id, semesterId: r.semester_id, subjectId: r.subject_id,
    weekday: r.weekday as Weekday, start: r.start_time, end: r.end_time,
    room: r.room ?? undefined, teacher: r.teacher ?? undefined,
    isExtra: r.is_extra ?? false, date: r.date ?? undefined,
    effectiveFrom: r.effective_from ?? undefined, effectiveTo: r.effective_to ?? undefined,
  }));
  const records: AttendanceRecord[] = ((recRes.data ?? []) as DbRowRecord[]).map((r) => ({
    id: r.id, date: r.date, lectureId: r.lecture_id, subjectId: r.subject_id,
    semesterId: r.semester_id, status: r.status, updatedAt: r.updated_at,
  }));
  const settingsRow = (setRes.data ?? null) as DbRowSettings | null;

  let activeSemesterId = settingsRow?.active_semester_id ?? undefined;
  if (activeSemesterId && !semesters.find((s) => s.id === activeSemesterId)) {
    activeSemesterId = semesters[0]?.id;
  }
  if (!activeSemesterId && semesters.length > 0) activeSemesterId = semesters[0].id;

  state = {
    version: 1,
    semesters,
    subjects,
    lectures,
    records,
    settings: {
      theme: settingsRow?.theme ?? "system",
      defaultTarget: settingsRow?.default_target ?? 75,
      activeSemesterId,
    },
  };

  if (!settingsRow) {
    // Ensure a settings row exists
    await supabase.from("user_settings").upsert({
      user_id: userId,
      theme: state.settings.theme,
      default_target: state.settings.defaultTarget,
      active_semester_id: activeSemesterId ?? null,
    });
  }

  hydrated = true;
  notify();

  // Attempt legacy migration
  await migrateFromLocalStorage(userId);
}

export function resetStore() {
  state = DEFAULT;
  hydrated = false;
  hydratingFor = null;
  notify();
}

export function isHydrated() {
  return hydrated;
}

async function migrateFromLocalStorage(userId: string) {
  if (!isBrowser()) return;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as DBState;
    if (!parsed || !Array.isArray(parsed.semesters)) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    // Only migrate if remote is empty
    if (state.semesters.length > 0 || state.subjects.length > 0 || state.records.length > 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    if (parsed.semesters.length) {
      await supabase.from("semesters").insert(
        parsed.semesters.map((s) => ({ id: s.id, user_id: userId, name: s.name, created_at: s.createdAt })),
      );
    }
    if (parsed.subjects.length) {
      await supabase.from("subjects").insert(
        parsed.subjects.map((s) => ({
          id: s.id, user_id: userId, semester_id: s.semesterId,
          name: s.name, code: s.code ?? null, faculty: s.faculty ?? null,
          color: s.color, target: s.target,
        })),
      );
    }
    if (parsed.lectures.length) {
      await supabase.from("lectures").insert(
        parsed.lectures.map((l) => ({
          id: l.id, user_id: userId, semester_id: l.semesterId, subject_id: l.subjectId,
          weekday: l.weekday, start_time: l.start, end_time: l.end,
          room: l.room ?? null, teacher: l.teacher ?? null,
        })),
      );
    }
    if (parsed.records.length) {
      await supabase.from("attendance_records").insert(
        parsed.records.map((r) => ({
          id: r.id, user_id: userId, date: r.date, lecture_id: r.lectureId,
          subject_id: r.subjectId, semester_id: r.semesterId, status: r.status,
          updated_at: r.updatedAt,
        })),
      );
    }
    if (parsed.settings) {
      await supabase.from("user_settings").upsert({
        user_id: userId,
        theme: parsed.settings.theme ?? "system",
        default_target: parsed.settings.defaultTarget ?? 75,
        active_semester_id: parsed.settings.activeSemesterId ?? null,
      });
    }
    localStorage.removeItem(LEGACY_KEY);
    // Re-hydrate to pick up migrated data
    hydrated = false;
    await hydrateFromSupabase(userId);
  } catch (e) {
    console.error("Legacy migration failed", e);
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function bg<T>(p: PromiseLike<T>) {
  Promise.resolve(p as PromiseLike<any>).then((res: any) => {
    if (res?.error) console.error("Supabase write failed:", res.error);
  });
}

// ---------- Semester ----------
export function createSemester(name: string): Semester {
  const s: Semester = { id: uid(), name, createdAt: new Date().toISOString() };
  const shouldActivate = !state.settings.activeSemesterId;
  set((st) => ({
    ...st,
    semesters: [...st.semesters, s],
    settings: { ...st.settings, activeSemesterId: st.settings.activeSemesterId ?? s.id },
  }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("semesters").insert({ id: s.id, user_id: uid, name: s.name, created_at: s.createdAt }));
    if (shouldActivate) {
      bg(supabase.from("user_settings").upsert({
        user_id: uid,
        theme: state.settings.theme,
        default_target: state.settings.defaultTarget,
        active_semester_id: s.id,
      }));
    }
  })();
  return s;
}

export function setActiveSemester(id: UUID) {
  set((st) => ({ ...st, settings: { ...st.settings, activeSemesterId: id } }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("user_settings").upsert({
      user_id: uid,
      theme: state.settings.theme,
      default_target: state.settings.defaultTarget,
      active_semester_id: id,
    }));
  })();
}

export function deleteSemester(id: UUID) {
  const nextActive =
    state.settings.activeSemesterId === id
      ? state.semesters.find((s) => s.id !== id)?.id
      : state.settings.activeSemesterId;
  set((st) => ({
    ...st,
    semesters: st.semesters.filter((s) => s.id !== id),
    subjects: st.subjects.filter((s) => s.semesterId !== id),
    lectures: st.lectures.filter((l) => l.semesterId !== id),
    records: st.records.filter((r) => r.semesterId !== id),
    settings: { ...st.settings, activeSemesterId: nextActive },
  }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("semesters").delete().eq("id", id));
    bg(supabase.from("user_settings").upsert({
      user_id: uid,
      theme: state.settings.theme,
      default_target: state.settings.defaultTarget,
      active_semester_id: nextActive ?? null,
    }));
  })();
}

// ---------- Subject ----------
export function createSubject(input: Omit<Subject, "id">): Subject {
  const s: Subject = { ...input, id: uid() };
  set((st) => ({ ...st, subjects: [...st.subjects, s] }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("subjects").insert({
      id: s.id, user_id: uid, semester_id: s.semesterId,
      name: s.name, code: s.code ?? null, faculty: s.faculty ?? null,
      color: s.color, target: s.target,
      manual_attended: s.manualAttended ?? 0, manual_total: s.manualTotal ?? 0,
    }));
  })();
  return s;
}

export function updateSubject(id: UUID, patch: Partial<Subject>) {
  set((st) => ({
    ...st,
    subjects: st.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }));
  const dbPatch: any = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.code !== undefined) dbPatch.code = patch.code ?? null;
  if (patch.faculty !== undefined) dbPatch.faculty = patch.faculty ?? null;
  if (patch.color !== undefined) dbPatch.color = patch.color;
  if (patch.target !== undefined) dbPatch.target = patch.target;
  if (patch.manualAttended !== undefined) dbPatch.manual_attended = patch.manualAttended ?? 0;
  if (patch.manualTotal !== undefined) dbPatch.manual_total = patch.manualTotal ?? 0;
  if (Object.keys(dbPatch).length === 0) return;
  bg(supabase.from("subjects").update(dbPatch).eq("id", id));
}

export function deleteSubject(id: UUID) {
  set((st) => ({
    ...st,
    subjects: st.subjects.filter((s) => s.id !== id),
    lectures: st.lectures.filter((l) => l.subjectId !== id),
    records: st.records.filter((r) => r.subjectId !== id),
  }));
  bg(supabase.from("subjects").delete().eq("id", id));
}

// ---------- Lecture ----------
function lectureRow(l: Lecture, userId: string) {
  return {
    id: l.id, user_id: userId, semester_id: l.semesterId, subject_id: l.subjectId,
    weekday: l.weekday, start_time: l.start, end_time: l.end,
    room: l.room ?? null, teacher: l.teacher ?? null,
    is_extra: l.isExtra ?? false, date: l.date ?? null,
    effective_from: l.effectiveFrom ?? null, effective_to: l.effectiveTo ?? null,
  };
}

export function createLecture(input: Omit<Lecture, "id">): Lecture {
  const l: Lecture = { ...input, id: uid() };
  set((st) => ({ ...st, lectures: [...st.lectures, l] }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("lectures").insert(lectureRow(l, uid)));
  })();
  return l;
}

export function updateLecture(id: UUID, patch: Partial<Lecture>) {
  set((st) => ({
    ...st,
    lectures: st.lectures.map((l) => (l.id === id ? { ...l, ...patch } : l)),
  }));
  const dbPatch: any = {};
  if (patch.subjectId !== undefined) dbPatch.subject_id = patch.subjectId;
  if (patch.weekday !== undefined) dbPatch.weekday = patch.weekday;
  if (patch.start !== undefined) dbPatch.start_time = patch.start;
  if (patch.end !== undefined) dbPatch.end_time = patch.end;
  if (patch.room !== undefined) dbPatch.room = patch.room ?? null;
  if (patch.teacher !== undefined) dbPatch.teacher = patch.teacher ?? null;
  if (patch.isExtra !== undefined) dbPatch.is_extra = patch.isExtra;
  if (patch.date !== undefined) dbPatch.date = patch.date ?? null;
  if (patch.effectiveFrom !== undefined) dbPatch.effective_from = patch.effectiveFrom ?? null;
  if (patch.effectiveTo !== undefined) dbPatch.effective_to = patch.effectiveTo ?? null;
  if (Object.keys(dbPatch).length === 0) return;
  bg(supabase.from("lectures").update(dbPatch).eq("id", id));
}

/**
 * Edit a timetable slot so the change only applies from `applyFrom` onward.
 * The original slot is closed the day before, keeping past dates and their
 * attendance records untouched. Returns the lecture that carries the new values.
 */
export function editLectureFrom(
  id: UUID,
  patch: Partial<Omit<Lecture, "id" | "semesterId">>,
  applyFrom: string,
): Lecture | null {
  const current = state.lectures.find((l) => l.id === id);
  if (!current) return null;

  // No history before the change date → edit the slot in place.
  const startsLater = current.effectiveFrom ? current.effectiveFrom >= applyFrom : false;
  const noPastRecords = !state.records.some((r) => r.lectureId === id && r.date < applyFrom);
  if (startsLater || noPastRecords) {
    const next = { ...patch, effectiveFrom: current.effectiveFrom ?? applyFrom };
    updateLecture(id, next);
    return { ...current, ...next };
  }

  updateLecture(id, { effectiveTo: addDaysKey(applyFrom, -1) });
  const { id: _omit, ...rest } = current;
  return createLecture({
    ...rest,
    ...patch,
    effectiveFrom: applyFrom,
    effectiveTo: current.effectiveTo,
  });
}

/** Stop a timetable slot from `applyFrom` onward, keeping earlier attendance. */
export function endLectureFrom(id: UUID, applyFrom: string) {
  const current = state.lectures.find((l) => l.id === id);
  if (!current) return;
  const hasPast = state.records.some((r) => r.lectureId === id && r.date < applyFrom);
  const startsLater = current.effectiveFrom ? current.effectiveFrom >= applyFrom : false;
  if (!hasPast || startsLater) {
    deleteLecture(id);
    return;
  }
  updateLecture(id, { effectiveTo: addDaysKey(applyFrom, -1) });
  // Drop any future records already marked for this slot
  const stale = state.records.filter((r) => r.lectureId === id && r.date >= applyFrom);
  if (stale.length) {
    set((st) => ({ ...st, records: st.records.filter((r) => !(r.lectureId === id && r.date >= applyFrom)) }));
    bg(supabase.from("attendance_records").delete().in("id", stale.map((r) => r.id)));
  }
}

export function todayKey() {
  const dt = new Date();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}


function addDaysKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function deleteLecture(id: UUID) {
  set((st) => ({
    ...st,
    lectures: st.lectures.filter((l) => l.id !== id),
    records: st.records.filter((r) => r.lectureId !== id),
  }));
  bg(supabase.from("lectures").delete().eq("id", id));
}

export function duplicateDay(from: Weekday, to: Weekday, semesterId: UUID, applyFrom?: string) {
  const start = applyFrom ?? addDaysKey(todayKey(), 0);
  const src = state.lectures.filter(
    (l) => !l.isExtra && l.semesterId === semesterId && l.weekday === from && (!l.effectiveTo || l.effectiveTo >= start),
  );
  const existing = state.lectures.filter((l) => !l.isExtra && l.semesterId === semesterId && l.weekday === to);
  // Close existing slots on the target day instead of deleting history
  existing.forEach((l) => endLectureFrom(l.id, start));
  src.forEach((l) => {
    const { id: _omit, ...rest } = l;
    createLecture({ ...rest, weekday: to, effectiveFrom: start, effectiveTo: undefined });
  });
}

// ---------- Attendance ----------
export function setStatus(
  date: string,
  lecture: Lecture,
  status: AttendanceStatus | null,
) {
  const key = `${date}-${lecture.id}`;
  set((st) => {
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
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    if (!status) {
      bg(supabase.from("attendance_records").delete().eq("id", key));
    } else {
      bg(supabase.from("attendance_records").upsert({
        id: key,
        user_id: uid,
        date,
        lecture_id: lecture.id,
        subject_id: lecture.subjectId,
        semester_id: lecture.semesterId,
        status,
        updated_at: new Date().toISOString(),
      }));
    }
  })();
}

// ---------- Settings ----------
export function updateSettings(patch: Partial<DBState["settings"]>) {
  set((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  (async () => {
    const uid = await currentUserId();
    if (!uid) return;
    bg(supabase.from("user_settings").upsert({
      user_id: uid,
      theme: state.settings.theme,
      default_target: state.settings.defaultTarget,
      active_semester_id: state.settings.activeSemesterId ?? null,
    }));
  })();
}

// ---------- Backup ----------
export function exportJSON(): string {
  return JSON.stringify(state, null, 2);
}

export async function importJSON(json: string) {
  const data = JSON.parse(json) as DBState;
  if (!data || !Array.isArray(data.semesters)) throw new Error("Invalid backup");
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");

  // Wipe existing rows for this user
  await Promise.all([
    supabase.from("attendance_records").delete().eq("user_id", uid),
    supabase.from("lectures").delete().eq("user_id", uid),
    supabase.from("subjects").delete().eq("user_id", uid),
    supabase.from("semesters").delete().eq("user_id", uid),
  ]);

  if (data.semesters.length) {
    await supabase.from("semesters").insert(
      data.semesters.map((s) => ({ id: s.id, user_id: uid, name: s.name, created_at: s.createdAt })),
    );
  }
  if (data.subjects.length) {
    await supabase.from("subjects").insert(
      data.subjects.map((s) => ({
        id: s.id, user_id: uid, semester_id: s.semesterId,
        name: s.name, code: s.code ?? null, faculty: s.faculty ?? null,
        color: s.color, target: s.target,
      })),
    );
  }
  if (data.lectures.length) {
    await supabase.from("lectures").insert(
      data.lectures.map((l) => ({
        id: l.id, user_id: uid, semester_id: l.semesterId, subject_id: l.subjectId,
        weekday: l.weekday, start_time: l.start, end_time: l.end,
        room: l.room ?? null, teacher: l.teacher ?? null,
      })),
    );
  }
  if (data.records.length) {
    await supabase.from("attendance_records").insert(
      data.records.map((r) => ({
        id: r.id, user_id: uid, date: r.date, lecture_id: r.lectureId,
        subject_id: r.subjectId, semester_id: r.semesterId, status: r.status,
        updated_at: r.updatedAt,
      })),
    );
  }
  await supabase.from("user_settings").upsert({
    user_id: uid,
    theme: data.settings?.theme ?? "system",
    default_target: data.settings?.defaultTarget ?? 75,
    active_semester_id: data.settings?.activeSemesterId ?? null,
  });

  hydrated = false;
  await hydrateFromSupabase(uid);
}

export async function resetAll() {
  const uid = await currentUserId();
  if (!uid) {
    resetStore();
    return;
  }
  await Promise.all([
    supabase.from("attendance_records").delete().eq("user_id", uid),
    supabase.from("lectures").delete().eq("user_id", uid),
    supabase.from("subjects").delete().eq("user_id", uid),
    supabase.from("semesters").delete().eq("user_id", uid),
  ]);
  await supabase.from("user_settings").upsert({
    user_id: uid,
    theme: "system",
    default_target: 75,
    active_semester_id: null,
  });
  state = DEFAULT;
  hydrated = false;
  await hydrateFromSupabase(uid);
}
