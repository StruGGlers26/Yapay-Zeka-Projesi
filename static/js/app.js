/**
 * Günlük: seçilen tek gün değerlendirilir | Haftalık: 7 gün zorunlu (Pzt–Paz)
 */

let categoryChart = null;
let similarityChart = null;
let activities = [];
let nextId = 1;
let selectedWeekDay = 0;
let currentUser = null;
const routinesByPeriod = { günlük: [], haftalık: [] };
/** Son değerlendirme: mod + rutin imzasıyla eşleşince gösterilir */
const evaluationStore = {
  günlük: {},
  haftalık: null,
};
/** Haftalık mod: her günün programı ayrı dizi (0=Pzt … 6=Paz) */
let weekDayStore = Array.from({ length: 7 }, () => []);

function emptyWeekStore() {
  return Array.from({ length: 7 }, () => []);
}

const $ = (id) => document.getElementById(id);

const WEEK_DAYS = [
  { id: 0, label: "Pazartesi", short: "Pzt" },
  { id: 1, label: "Salı", short: "Sal" },
  { id: 2, label: "Çarşamba", short: "Çar" },
  { id: 3, label: "Perşembe", short: "Per" },
  { id: 4, label: "Cuma", short: "Cum" },
  { id: 5, label: "Cumartesi", short: "Cmt" },
  { id: 6, label: "Pazar", short: "Paz" },
];

const CATEGORY_COLORS = {
  uyku: "#5c6bc0",
  calisma: "#ffa726",
  egzersiz: "#66bb6a",
  sosyal: "#ec407a",
  yemek: "#ffca28",
  kisisel_bakim: "#ab47bc",
  ev_duzen: "#8d6e63",
  hobi_eglence: "#26c6da",
  ulasim: "#78909c",
  diger: "#bdbdbd",
};

const TIMELINE_START = 0;
const TIMELINE_END = 24;
const HOUR_PX = 48;
const DAY_HOURS_REQUIRED = 24;
const DAY_HOURS_TOLERANCE = 0.25;

/** Örnek günlük program — toplam 24 saat */
const SAMPLE_DAILY = [
  { start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { start: "07:30", end: "08:00", name: "Hazırlık", category: "kisisel_bakim" },
  { start: "08:00", end: "12:30", name: "Ders çalışma", category: "calisma" },
  { start: "12:30", end: "13:30", name: "Öğle yemeği", category: "yemek" },
  { start: "13:30", end: "17:30", name: "Proje", category: "calisma" },
  { start: "17:30", end: "18:00", name: "Ulaşım", category: "ulasim" },
  { start: "18:00", end: "19:00", name: "Spor", category: "egzersiz" },
  { start: "19:00", end: "20:00", name: "Akşam yemeği", category: "yemek" },
  { start: "20:00", end: "22:00", name: "Sosyal zaman", category: "sosyal" },
  { start: "22:00", end: "22:30", name: "Hobi / dinlenme", category: "hobi_eglence" },
  { start: "22:30", end: "07:00", name: "Uyku", category: "uyku" },
];

/** Örnek hafta — her gün toplam 24 saat */
const SAMPLE_WEEKLY = [
  { day: 0, start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { day: 0, start: "07:30", end: "08:00", name: "Hazırlık", category: "kisisel_bakim" },
  { day: 0, start: "08:00", end: "12:30", name: "Ders ve iş", category: "calisma" },
  { day: 0, start: "12:30", end: "13:30", name: "Öğle yemeği", category: "yemek" },
  { day: 0, start: "13:30", end: "17:30", name: "Proje", category: "calisma" },
  { day: 0, start: "17:30", end: "18:00", name: "Ulaşım", category: "ulasim" },
  { day: 0, start: "18:00", end: "19:00", name: "Spor", category: "egzersiz" },
  { day: 0, start: "19:00", end: "20:00", name: "Akşam yemeği", category: "yemek" },
  { day: 0, start: "20:00", end: "22:00", name: "Sosyal", category: "sosyal" },
  { day: 0, start: "22:00", end: "22:30", name: "Hobi", category: "hobi_eglence" },
  { day: 0, start: "22:30", end: "07:00", name: "Uyku", category: "uyku" },
  { day: 1, start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { day: 1, start: "07:30", end: "08:00", name: "Hazırlık", category: "kisisel_bakim" },
  { day: 1, start: "08:00", end: "16:00", name: "Okul / iş", category: "calisma" },
  { day: 1, start: "16:00", end: "17:00", name: "Ulaşım", category: "ulasim" },
  { day: 1, start: "17:00", end: "18:00", name: "Spor", category: "egzersiz" },
  { day: 1, start: "18:00", end: "19:00", name: "Akşam yemeği", category: "yemek" },
  { day: 1, start: "19:00", end: "21:00", name: "Serbest zaman", category: "hobi_eglence" },
  { day: 1, start: "21:00", end: "22:00", name: "Aile", category: "sosyal" },
  { day: 1, start: "22:00", end: "23:00", name: "Akşam rutini", category: "kisisel_bakim" },
  { day: 1, start: "23:00", end: "07:00", name: "Uyku", category: "uyku" },
  { day: 2, start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { day: 2, start: "07:30", end: "08:30", name: "Hazırlık / yol", category: "ulasim" },
  { day: 2, start: "08:30", end: "12:30", name: "Çalışma", category: "calisma" },
  { day: 2, start: "12:30", end: "13:30", name: "Öğle", category: "yemek" },
  { day: 2, start: "13:30", end: "17:30", name: "Çalışma", category: "calisma" },
  { day: 2, start: "17:30", end: "19:00", name: "Aile", category: "sosyal" },
  { day: 2, start: "19:00", end: "20:00", name: "Akşam yemeği", category: "yemek" },
  { day: 2, start: "20:00", end: "22:00", name: "Hobi", category: "hobi_eglence" },
  { day: 2, start: "22:00", end: "23:00", name: "Dinlenme", category: "hobi_eglence" },
  { day: 2, start: "23:00", end: "07:00", name: "Uyku", category: "uyku" },
  { day: 3, start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { day: 3, start: "07:30", end: "08:30", name: "Hazırlık", category: "kisisel_bakim" },
  { day: 3, start: "08:30", end: "12:30", name: "Çalışma", category: "calisma" },
  { day: 3, start: "12:30", end: "13:30", name: "Öğle", category: "yemek" },
  { day: 3, start: "13:30", end: "17:30", name: "Çalışma", category: "calisma" },
  { day: 3, start: "17:30", end: "18:30", name: "Ulaşım", category: "ulasim" },
  { day: 3, start: "18:30", end: "19:30", name: "Yürüyüş", category: "egzersiz" },
  { day: 3, start: "19:30", end: "20:30", name: "Akşam yemeği", category: "yemek" },
  { day: 3, start: "20:30", end: "22:30", name: "Hobi", category: "hobi_eglence" },
  { day: 3, start: "22:30", end: "23:00", name: "Hazırlık yatış", category: "kisisel_bakim" },
  { day: 3, start: "23:00", end: "07:00", name: "Uyku", category: "uyku" },
  { day: 4, start: "07:00", end: "07:30", name: "Kahvaltı", category: "yemek" },
  { day: 4, start: "07:30", end: "09:00", name: "Hazırlık", category: "kisisel_bakim" },
  { day: 4, start: "09:00", end: "15:00", name: "Cuma dersleri", category: "calisma" },
  { day: 4, start: "15:00", end: "16:00", name: "Öğle", category: "yemek" },
  { day: 4, start: "16:00", end: "17:30", name: "Ev / düzen", category: "ev_duzen" },
  { day: 4, start: "17:30", end: "19:00", name: "Hazırlanma", category: "kisisel_bakim" },
  { day: 4, start: "19:00", end: "22:00", name: "Arkadaşlar", category: "sosyal" },
  { day: 4, start: "22:00", end: "23:00", name: "Dönüş / dinlenme", category: "hobi_eglence" },
  { day: 4, start: "23:00", end: "07:00", name: "Uyku", category: "uyku" },
  { day: 5, start: "08:00", end: "09:00", name: "Kahvaltı", category: "yemek" },
  { day: 5, start: "09:00", end: "12:00", name: "Alışveriş", category: "ev_duzen" },
  { day: 5, start: "12:00", end: "13:30", name: "Öğle", category: "yemek" },
  { day: 5, start: "13:30", end: "18:00", name: "Dinlenme", category: "hobi_eglence" },
  { day: 5, start: "18:00", end: "19:30", name: "Akşam yemeği", category: "yemek" },
  { day: 5, start: "19:30", end: "22:00", name: "Film / oyun", category: "hobi_eglence" },
  { day: 5, start: "22:00", end: "23:30", name: "Gece rutini", category: "kisisel_bakim" },
  { day: 5, start: "23:30", end: "08:00", name: "Uyku", category: "uyku" },
  { day: 6, start: "08:00", end: "10:00", name: "Brunch", category: "yemek" },
  { day: 6, start: "10:00", end: "12:00", name: "Yürüyüş", category: "egzersiz" },
  { day: 6, start: "12:00", end: "14:00", name: "Öğle dinlenme", category: "hobi_eglence" },
  { day: 6, start: "14:00", end: "17:00", name: "Hobi", category: "hobi_eglence" },
  { day: 6, start: "17:00", end: "19:00", name: "Aile", category: "sosyal" },
  { day: 6, start: "19:00", end: "20:30", name: "Akşam yemeği", category: "yemek" },
  { day: 6, start: "20:30", end: "22:30", name: "Dinlenme", category: "hobi_eglence" },
  { day: 6, start: "22:30", end: "23:00", name: "Hazırlık", category: "kisisel_bakim" },
  { day: 6, start: "23:00", end: "08:00", name: "Uyku", category: "uyku" },
];

function getPeriod() {
  return $("period").value;
}

function isDaily() {
  return getPeriod() === "günlük";
}

/** Gün kimliği 0–6 (Pzt–Paz) */
function normalizeDayId(day) {
  if (day === null || day === undefined || day === "") return null;
  const d = parseInt(day, 10);
  return Number.isInteger(d) && d >= 0 && d <= 6 ? d : null;
}

function weekDayLabel(dayId) {
  return WEEK_DAYS.find((d) => d.id === dayId)?.label || "";
}

function getViewActivities() {
  return activities;
}

function saveCurrentWeekDayToStore() {
  sortActivitiesChronologically(activities);
  weekDayStore[selectedWeekDay] = activities.map((a) => ({
    id: a.id,
    name: a.name,
    start: a.start,
    end: a.end,
    hours: a.hours,
    category: a.category,
    day: selectedWeekDay,
  }));
}

function loadSelectedWeekDayFromStore() {
  activities = (weekDayStore[selectedWeekDay] || []).map((a) => ({
    ...a,
    day: selectedWeekDay,
  }));
  sortActivitiesChronologically(activities);
}

function hydrateWeekStoreFromList(list) {
  weekDayStore = emptyWeekStore();
  (list || []).forEach((raw) => {
    const d = normalizeDayId(raw.day);
    if (d === null) return;
    weekDayStore[d].push({
      id: raw.id,
      name: raw.name,
      start: raw.start,
      end: raw.end,
      hours: raw.hours,
      category: raw.category,
      day: d,
    });
  });
  for (let d = 0; d <= 6; d++) {
    sortActivitiesChronologically(weekDayStore[d]);
  }
}

function flattenWeekStore() {
  const all = [];
  for (let d = 0; d <= 6; d++) {
    (weekDayStore[d] || []).forEach((a) => {
      all.push({ ...a, day: d });
    });
  }
  return all;
}

function switchWeekDay(dayId) {
  if (dayId === selectedWeekDay) return;
  saveCurrentWeekDayToStore();
  selectedWeekDay = dayId;
  loadSelectedWeekDayFromStore();
  recomputeNextId();
  renderAll();
  restoreSavedEvaluation();
}

function getAllActivitiesForPeriod() {
  saveCurrentWeekDayToStore();
  if (isDaily()) {
    return (weekDayStore[selectedWeekDay] || []).map((a) => ({
      ...a,
      day: selectedWeekDay,
    }));
  }
  return flattenWeekStore();
}

function getMissingWeekDays() {
  if (isDaily()) return [];
  saveCurrentWeekDayToStore();
  return WEEK_DAYS.filter((d) => !(weekDayStore[d.id] || []).length);
}

function selectedDayTotalHours() {
  saveCurrentWeekDayToStore();
  return (weekDayStore[selectedWeekDay] || []).reduce(
    (s, a) => s + (a.hours || computeActivityHours(a)),
    0
  );
}

function isSelectedDayFullDay(total = selectedDayTotalHours()) {
  return Math.abs(total - DAY_HOURS_REQUIRED) <= DAY_HOURS_TOLERANCE;
}

function parseTimeToMinutes(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function minutesToTime(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hoursBetween(start, end) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s == null || e == null) return 0;
  let diff = e - s;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

/** Başlangıç saatine göre kronolojik sıra (gece yarısı sonrası saatler gün sonuna yakın) */
function activityStartSortKey(act) {
  const m = parseTimeToMinutes(act.start);
  return m == null ? 24 * 60 + 1 : m;
}

function sortActivitiesChronologically(list) {
  if (!list?.length) return list;
  list.sort((a, b) => activityStartSortKey(a) - activityStartSortKey(b));
  return list;
}

function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} dk`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m ? `${h} sa ${m} dk` : `${h} saat`;
}

function catClass(cat) {
  return `cat-${cat || "diger"}`;
}

function catColor(cat) {
  return (window.RutinUtils?.catColor(cat)) || CATEGORY_COLORS[cat] || CATEGORY_COLORS.diger;
}

function catIcon(cat) {
  return window.RutinConfig?.CATEGORY_ICONS?.[cat] || "📌";
}

function categoryLabel(catId) {
  const found = (window.CATEGORIES || []).find((c) => c.id === catId);
  return found ? found.label : catId;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function showToast(msg) {
  document.querySelectorAll(".error-toast").forEach((el) => el.remove());
  const div = document.createElement("div");
  div.className = "error-toast";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

function computeActivityHours(act) {
  if (act.start && act.end) return hoursBetween(act.start, act.end);
  return act.hours || 0;
}

function activityToPlain(a) {
  return {
    id: a.id,
    name: a.name,
    start: a.start,
    end: a.end,
    hours: a.hours,
    category: a.category,
    day: normalizeDayId(a.day ?? selectedWeekDay),
  };
}

/** Eski kayıtlar (gün alanı yok) → Pazartesi (0) */
function listWithDayForStore(list, period) {
  const items = list || [];
  if (!items.length) return [];
  if (items.some((a) => normalizeDayId(a.day) !== null)) {
    return items.map((a) => ({ ...a, day: normalizeDayId(a.day) }));
  }
  if (period === "günlük") {
    return items.map((a) => ({ ...a, day: 0 }));
  }
  return items;
}

function normalizeActivitiesForPeriod(list, period) {
  return listWithDayForStore(list, period).filter((a) => a.day !== null);
}

/** Günlük ve haftalık kayıtları gün bazında birleştir (günlük doluysa o; yoksa haftalık) */
function mergeWeekRoutines(dailyList, weeklyList) {
  const daily = normalizeActivitiesForPeriod(dailyList, "günlük");
  const weekly = normalizeActivitiesForPeriod(weeklyList, "haftalık");
  const merged = [];
  for (let d = 0; d <= 6; d++) {
    const gDay = daily.filter((a) => a.day === d);
    const wDay = weekly.filter((a) => a.day === d);
    const pick = gDay.length ? gDay : wDay;
    pick.forEach((a) => merged.push({ ...a, day: d }));
  }
  return merged;
}

function sharedRoutineFlat() {
  saveCurrentWeekDayToStore();
  return flattenWeekStore().map((a) => {
    const { id, ...rest } = a;
    return { ...rest, day: a.day };
  });
}

function applySharedRoutineToCache(flat) {
  routinesByPeriod.günlük = flat;
  routinesByPeriod.haftalık = flat;
}

function syncPeriodToCache() {
  applySharedRoutineToCache(sharedRoutineFlat());
}

function recomputeNextId() {
  const merged = flattenWeekStore();
  const maxId = merged.reduce((m, a) => Math.max(m, Number(a.id) || 0), 0);
  nextId = maxId + 1;
}

/** Sunucudan gelen kayıtlarda id yok; düzenleme/silme için zorunlu */
function assignMissingActivityIds() {
  for (let d = 0; d <= 6; d++) {
    for (const a of weekDayStore[d] || []) {
      if (a.id == null || a.id === "") {
        a.id = nextId++;
      }
    }
  }
}

function loadPeriodFromCache() {
  const merged = mergeWeekRoutines(routinesByPeriod.günlük, routinesByPeriod.haftalık);
  applySharedRoutineToCache(merged);
  hydrateWeekStoreFromList(merged);
  recomputeNextId();
  assignMissingActivityIds();
  loadSelectedWeekDayFromStore();
}

function addActivity(data) {
  const hours = data.hours ?? hoursBetween(data.start, data.end);
  activities.push({
    id: nextId++,
    name: data.name,
    start: data.start,
    end: data.end,
    hours,
    category: data.category,
    day: normalizeDayId(data.day ?? selectedWeekDay),
  });
  sortActivitiesChronologically(activities);
  renderAll();
}

function removeActivity(id) {
  activities = activities.filter((a) => a.id != id);
  renderAll();
}

function updateActivity(id, data) {
  const a = activities.find((x) => x.id == id);
  if (!a) return;
  Object.assign(a, data);
  const d = normalizeDayId(data.day);
  a.day = d !== null ? d : selectedWeekDay;
  a.hours = computeActivityHours(a);
  sortActivitiesChronologically(activities);
  renderAll();
}

function timelineSegments(start, end) {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  if (s == null || e == null) return [];
  if (e > s) {
    return [{ startMin: s, endMin: e, timeLabel: `${start} – ${end}` }];
  }
  return [
    { startMin: s, endMin: 24 * 60, timeLabel: `${start} – 24:00` },
    { startMin: 0, endMin: e, timeLabel: `00:00 – ${end}`, overnight: true },
  ];
}

function mergeMinuteIntervals(intervals) {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/** Dolu bloklar arasındaki en erken boşluğun başlangıcı (gece yarısı öncesi boşluk sayılmaz) */
function findEarliestGapStart(dayActs) {
  const list = (dayActs || []).filter((a) => a.start && a.end);
  if (!list.length) return null;

  const intervals = [];
  list.forEach((a) => {
    timelineSegments(a.start, a.end).forEach((seg) => {
      intervals.push({ start: seg.startMin, end: seg.endMin });
    });
  });
  const merged = mergeMinuteIntervals(intervals);
  if (!merged.length) return null;

  let earliest = null;
  for (let i = 0; i < merged.length; i++) {
    const gapStart = merged[i].end;
    const gapEnd = i + 1 < merged.length ? merged[i + 1].start : 24 * 60;
    if (gapEnd > gapStart && (earliest == null || gapStart < earliest)) {
      earliest = gapStart;
    }
  }
  return earliest != null ? minutesToTime(earliest) : null;
}

function nextOccupiedStartAfter(dayActs, fromMin) {
  const list = (dayActs || []).filter((a) => a.start && a.end);
  let next = null;
  list.forEach((a) => {
    timelineSegments(a.start, a.end).forEach((seg) => {
      if (seg.startMin > fromMin && (next == null || seg.startMin < next)) {
        next = seg.startMin;
      }
    });
  });
  return next;
}

function renderRuler() {
  const ruler = $("timeline_ruler");
  ruler.innerHTML = "";
  for (let h = TIMELINE_START; h <= TIMELINE_END; h++) {
    const el = document.createElement("div");
    el.className = "hour-mark";
    el.style.top = `${(h - TIMELINE_START) * HOUR_PX}px`;
    el.textContent = `${String(h).padStart(2, "0")}:00`;
    ruler.appendChild(el);
  }
}

function appendScheduleBlock(container, act, segment, cat) {
  const durationMin = segment.endMin - segment.startMin;
  if (durationMin <= 0) return;
  const top = (segment.startMin / 60) * HOUR_PX;
  const height = Math.max((durationMin / 60) * HOUR_PX, 22);
  const title = segment.overnight ? `↳ ${act.name}` : act.name;

  const el = document.createElement("div");
  el.className = `schedule-block ${catClass(cat)}${segment.overnight ? " schedule-block-overnight" : ""}`;
  el.style.top = `${top}px`;
  el.style.height = `${height}px`;
  el.style.background = catColor(cat);
  el.innerHTML = `
    <div class="block-title">${escapeHtml(title)}</div>
    <div class="block-time">${escapeHtml(segment.timeLabel)}</div>
  `;
  el.addEventListener("click", () => openModal(act.id));
  container.appendChild(el);
}

function renderWeekDayStrip() {
  const strip = $("week_days");
  strip.hidden = false;
  strip.innerHTML = "";

  saveCurrentWeekDayToStore();
  WEEK_DAYS.forEach((day) => {
    const count = (weekDayStore[day.id] || []).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "week-day-btn";
    if (selectedWeekDay === day.id) btn.classList.add("active");
    if (count > 0) btn.classList.add("has-data");
    else btn.classList.add("empty");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", selectedWeekDay === day.id);
    btn.innerHTML = `
      <span class="wd-short">${day.short}</span>
      <span class="wd-count">${count || "—"}</span>
    `;
    btn.addEventListener("click", () => switchWeekDay(day.id));
    strip.appendChild(btn);
  });
}

function renderTimeline() {
  const blocks = $("timeline_blocks");
  renderRuler();
  blocks.innerHTML = "";

  const list = getViewActivities().filter((a) => a.start && a.end);

  list.forEach((act) => {
    const cat = act.category;
    timelineSegments(act.start, act.end).forEach((seg) => {
      appendScheduleBlock(blocks, act, seg, cat);
    });
  });
}

function renderActivityCards() {
  const ul = $("activity_cards");
  const list = getViewActivities();
  ul.innerHTML = "";
  $("empty_hint").hidden = list.length > 0;

  if (list.length === 0) {
    $("empty_hint").textContent = `${weekDayLabel(selectedWeekDay)} için aktivite yok. + ile ekleyin.`;
  }

  list.forEach((act) => {
    const cat = act.category;
    const li = document.createElement("li");
    li.className = `activity-card ${catClass(cat)}`;
    li.style.setProperty("--block-color", catColor(cat));
    const timeLabel = `${act.start} – ${act.end} · ${formatDuration(act.hours)}`;

    li.innerHTML = `
      <div class="activity-card-stripe"></div>
      <div class="activity-card-body">
        <h4>${escapeHtml(act.name)}</h4>
        <div class="activity-card-meta">${catIcon(cat)} ${escapeHtml(timeLabel)} · ${escapeHtml(categoryLabel(cat))}</div>
      </div>
      <div class="activity-card-actions">
        <button type="button" data-delete="${act.id}" aria-label="Sil">✕</button>
      </div>
    `;
    li.querySelector(".activity-card-body").addEventListener("click", () => openModal(act.id));
    li.querySelector("[data-delete]").addEventListener("click", (e) => {
      e.stopPropagation();
      removeActivity(act.id);
    });
    ul.appendChild(li);
  });
}

function updateDayLabel() {
  saveCurrentWeekDayToStore();
  const dayTotal = activities.reduce((s, a) => s + a.hours, 0);
  if (isDaily()) {
    const full = isSelectedDayFullDay(dayTotal);
    $("day_label").textContent =
      `${weekDayLabel(selectedWeekDay)} · ${dayTotal.toFixed(1)} / ${DAY_HOURS_REQUIRED} sa` +
      (full ? " · değerlendirmeye hazır" : " · 24 saate tamamlayın");
    return;
  }
  const total = flattenWeekStore().reduce((s, a) => s + a.hours, 0);
  const missing = getMissingWeekDays().length;
  $("day_label").textContent = `${weekDayLabel(selectedWeekDay)} · ${dayTotal.toFixed(1)} saat`;
  if (missing > 0) {
    $("day_label").textContent += ` · Hafta: ${total.toFixed(1)} sa (${missing} gün eksik)`;
  } else {
    $("day_label").textContent += ` · Hafta tamam: ${total.toFixed(1)} sa`;
  }
}

function renderAll() {
  if (activities.some((a) => a.id == null || a.id === "")) {
    recomputeNextId();
    assignMissingActivityIds();
    loadSelectedWeekDayFromStore();
  }
  activities.forEach((a) => {
    a.hours = computeActivityHours(a);
  });
  syncPeriodToCache();
  if (window.RutinConflicts) {
    const allForCheck = getAllActivitiesForPeriod();
    RutinConflicts.renderBanner(RutinConflicts.detect(allForCheck, getPeriod()));
  }
  renderWeekDayStrip();
  updateDayLabel();
  renderTimeline();
  renderActivityCards();
  syncEvaluationPanel();
}

function renderCopyTargetDays(sourceDay) {
  const box = $("copy_target_days");
  if (!box) return;
  box.innerHTML = WEEK_DAYS.map(
    (d) => `
    <label class="copy-target-option">
      <input type="checkbox" name="copy_target" value="${d.id}" ${d.id === sourceDay ? "disabled" : ""}>
      <span>${d.label}</span>
    </label>`
  ).join("");
}

function openCopyDayModal() {
  const sourceSelect = $("copy_source_day");
  if (!sourceSelect) return;
  sourceSelect.innerHTML = WEEK_DAYS.map(
    (d) => `<option value="${d.id}" ${d.id === selectedWeekDay ? "selected" : ""}>${d.label}</option>`
  ).join("");
  renderCopyTargetDays(parseInt(sourceSelect.value, 10));
  $("copy_day_backdrop").hidden = false;
}

function closeCopyDayModal() {
  const backdrop = $("copy_day_backdrop");
  if (backdrop) backdrop.hidden = true;
}

function applyCopyDay() {
  saveCurrentWeekDayToStore();
  const sourceDay = parseInt($("copy_source_day").value, 10);
  const src = (weekDayStore[sourceDay] || []).map((a) => ({ ...a }));
  if (!src.length) {
    showToast("Kaynak günde kopyalanacak aktivite yok.");
    return;
  }
  const targets = [...document.querySelectorAll('input[name="copy_target"]:checked')].map((el) =>
    parseInt(el.value, 10)
  );
  if (!targets.length) {
    showToast("En az bir hedef gün seçin.");
    return;
  }
  targets.forEach((d) => {
    weekDayStore[d] = src.map((a) => ({
      id: nextId++,
      name: a.name,
      start: a.start,
      end: a.end,
      hours: a.hours,
      category: a.category,
      day: d,
    }));
  });
  loadSelectedWeekDayFromStore();
  closeCopyDayModal();
  renderAll();
  const targetLabels = targets.map((d) => weekDayLabel(d)).join(", ");
  showToast(`${weekDayLabel(sourceDay)} → ${targetLabels} kopyalandı.`);
}

function updateDurationPreview() {
  const h = hoursBetween($("input_start").value, $("input_end").value);
  $("duration_preview").textContent = `Süre: ${formatDuration(h)}`;
}

function setPeriod(period) {
  saveCurrentWeekDayToStore();
  syncPeriodToCache();
  $("period").value = period;
  document.querySelectorAll(".period-btn").forEach((btn) => {
    const active = btn.dataset.period === period;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active);
  });
  const hint = $("period_hint");
  if (hint) {
    hint.hidden = false;
    hint.textContent =
      period === "günlük"
        ? "Üstten gün seçin; seçili günün programı toplam 24 saat olmalı. Girilen günler haftalık modda da görünür."
        : "Günlük modda girdiğiniz günler burada da kullanılır. 7 gün dolmadan haftalık değerlendirme yapılamaz.";
  }
  loadPeriodFromCache();
  renderAll();
  restoreSavedEvaluation();
}

function switchTab(tab) {
  const onSchedule = tab === "schedule";
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.dataset.tab === tab);
  });
  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.tab === tab);
  });
  const shell = $("app_shell");
  if (shell) shell.classList.toggle("tab-schedule", onSchedule);
  const evalBar = document.querySelector(".evaluate-bar");
  if (evalBar) evalBar.hidden = !onSchedule;
  const fab = $("fab_add");
  if (fab) fab.hidden = !onSchedule;
}

function openModal(editId = null) {
  const id =
    editId != null && editId !== "" && !Number.isNaN(Number(editId)) ? Number(editId) : null;

  $("activity_form").reset();
  $("edit_id").value = id != null ? String(id) : "";

  const dayLabel = weekDayLabel(selectedWeekDay);
  $("modal_day_label").hidden = false;
  $("modal_day_label").textContent = dayLabel;
  $("modal_title").textContent =
    id != null ? "Aktiviteyi düzenle" : `${dayLabel} — aktivite ekle`;

  if (id != null) {
    const act = activities.find((a) => a.id == id);
    if (act) {
      $("input_name").value = act.name;
      $("input_category").value = act.category;
      $("input_start").value = act.start || "08:00";
      $("input_end").value = act.end || "09:00";
      if (act.day != null) {
        const d = normalizeDayId(act.day);
        if (d !== null) {
          selectedWeekDay = d;
          $("modal_day_label").textContent = weekDayLabel(d);
        }
      }
    }
  } else {
    $("input_category").value = "";
    const dayActs = getViewActivities().filter((a) => a.start && a.end);
    if (!dayActs.length) {
      $("input_start").value = "00:00";
      $("input_end").value = "01:00";
    } else {
      const gapStart = findEarliestGapStart(dayActs);
      if (gapStart) {
        const startM = parseTimeToMinutes(gapStart);
        $("input_start").value = gapStart;
        let endM = startM + 60;
        const nextStart = nextOccupiedStartAfter(dayActs, startM);
        if (nextStart != null && endM > nextStart) {
          endM = Math.max(nextStart, startM + 15);
        }
        $("input_end").value = minutesToTime(endM);
      } else {
        $("input_start").value = "08:00";
        $("input_end").value = "09:00";
      }
    }
  }
  updateDurationPreview();
  $("modal_backdrop").hidden = false;
}

function closeModal() {
  $("modal_backdrop").hidden = true;
}

function buildPayloadActivities() {
  if (isDaily()) {
    return getAllActivitiesForPeriod().map((a) => ({
      name: a.name,
      category: a.category,
      start: a.start,
      end: a.end,
      hours: a.hours,
    }));
  }
  return getAllActivitiesForPeriod().map((a) => ({
    name: a.name,
    category: a.category,
    start: a.start,
    end: a.end,
    hours: a.hours,
    day: normalizeDayId(a.day),
  }));
}

function scoreColor(score) {
  if (score >= 75) return "#43a047";
  if (score >= 50) return "#ffb300";
  return "#e53935";
}

function setScoreRing(score) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;
  const ring = $("ring_fill");
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = scoreColor(score);
  $("score_value").textContent = score;
}

function evaluationContextLabel() {
  return isDaily() ? `${weekDayLabel(selectedWeekDay)} · günlük` : "haftalık";
}

function routineSignatureActs(acts, period = getPeriod()) {
  const normalized = (acts || [])
    .map((a) => {
      const entry = {
        n: a.name,
        s: a.start || "",
        e: a.end || "",
        c: a.category || "",
      };
      if (period === "haftalık") {
        entry.d = normalizeDayId(a.day) ?? -1;
      }
      return entry;
    })
    .sort(
      (x, y) =>
        (x.d ?? 0) - (y.d ?? 0) ||
        String(x.s || "").localeCompare(String(y.s || "")) ||
        String(x.n || "").localeCompare(String(y.n || ""))
    );
  return JSON.stringify(normalized);
}

function routineSignatureForCurrentView() {
  saveCurrentWeekDayToStore();
  const period = getPeriod();
  if (isDaily()) {
    return routineSignatureActs(weekDayStore[selectedWeekDay] || [], period);
  }
  return routineSignatureActs(flattenWeekStore(), period);
}

function persistEvaluationResult(data) {
  const entry = { data, signature: routineSignatureForCurrentView() };
  if (isDaily()) {
    evaluationStore.günlük[selectedWeekDay] = entry;
  } else {
    evaluationStore.haftalık = entry;
  }
}

function getMatchingEvaluation() {
  const signature = routineSignatureForCurrentView();
  if (isDaily()) {
    const entry = evaluationStore.günlük[selectedWeekDay];
    return entry && entry.signature === signature ? entry.data : null;
  }
  const entry = evaluationStore.haftalık;
  return entry && entry.signature === signature ? entry.data : null;
}

function evaluationPlaceholderHtml() {
  if (isDaily()) {
    const day = weekDayLabel(selectedWeekDay);
    return `<strong>${escapeHtml(day)}</strong> programını oluşturup <strong>Değerlendir</strong>’e basın.`;
  }
  return `7 günün tamamını doldurup <strong>Değerlendir</strong>’e basın (haftalık mod).`;
}

function destroyResultCharts() {
  if (categoryChart) {
    categoryChart.destroy();
    categoryChart = null;
  }
  if (similarityChart) {
    similarityChart.destroy();
    similarityChart = null;
  }
}

function isEmptyDailyDay() {
  return isDaily() && !activities.length;
}

/** Puan yok: günlük boş gün veya haftalıkta eşleşen değerlendirme yok */
function shouldShowDashScoreChip() {
  if (isEmptyDailyDay()) return true;
  if (!isDaily()) return !getMatchingEvaluation();
  return false;
}

function showDashScoreChip() {
  const chip = $("score_chip");
  if (!chip) return;
  chip.hidden = false;
  $("score_chip_value").textContent = "—";
  const ctx = $("score_chip_context");
  const label = evaluationContextLabel();
  if (ctx) ctx.textContent = label;
  chip.title = label;
  chip.className = "score-chip";
}

function clearEvaluationUI() {
  destroyResultCharts();
  $("stats_placeholder").hidden = false;
  $("stats_content").hidden = true;
  $("insights_placeholder").hidden = false;
  $("insights_content").hidden = true;
  const statsMsg = $("stats_placeholder_msg");
  const insightsMsg = $("insights_placeholder_msg");
  if (statsMsg) statsMsg.innerHTML = evaluationPlaceholderHtml();
  if (insightsMsg) {
    insightsMsg.textContent = isDaily()
      ? `${weekDayLabel(selectedWeekDay)} için değerlendirme yapılmadı veya program değişti.`
      : "Haftalık değerlendirme yapılmadı veya program değişti.";
  }
  if (shouldShowDashScoreChip()) showDashScoreChip();
  else $("score_chip").hidden = true;
}

function syncEvaluationPanel() {
  if (isEmptyDailyDay()) {
    clearEvaluationUI();
    return;
  }
  const data = getMatchingEvaluation();
  if (data) applyEvaluationToUI(data);
  else clearEvaluationUI();
}

let restoreEvalInFlight = false;

async function restoreSavedEvaluation() {
  if (!currentUser || restoreEvalInFlight) return;
  const payload = buildPayloadActivities();
  if (!payload.length) {
    syncEvaluationPanel();
    return;
  }
  if (getMatchingEvaluation()) return;

  restoreEvalInFlight = true;
  try {
    const res = await fetch("/api/evaluation/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ period: getPeriod(), activities: payload }),
    });
    if (!res.ok) return;
    const data = await res.json();
    persistEvaluationResult(data);
    syncEvaluationPanel();
  } catch {
    /* ağ hatası — sessizce geç */
  } finally {
    restoreEvalInFlight = false;
  }
}

function updateScoreChip(score) {
  if (shouldShowDashScoreChip()) {
    showDashScoreChip();
    return;
  }
  const chip = $("score_chip");
  chip.hidden = false;
  $("score_chip_value").textContent = `${Math.round(score)}/100`;
  const ctx = $("score_chip_context");
  if (ctx) ctx.textContent = evaluationContextLabel();
  chip.title = evaluationContextLabel();
  chip.className = "score-chip";
  if (score >= 75) chip.classList.add("good");
  else if (score >= 50) chip.classList.add("mid");
  else chip.classList.add("low");
}

function renderCharts(data) {
  const labels = Object.keys(data.category_hours);
  const values = Object.values(data.category_hours);
  const colors = labels.map((label) => {
    const cat = (window.CATEGORIES || []).find((c) => c.label === label);
    return cat ? catColor(cat.id) : "#78909c";
  });

  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart($("category_chart"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      cutout: "65%",
    },
  });

  const simLabels = Object.keys(data.similarity_scores).map((k) => k.replace(/_/g, " "));
  const simValues = Object.values(data.similarity_scores).map((v) => Math.round(v * 100));

  if (similarityChart) similarityChart.destroy();
  similarityChart = new Chart($("similarity_chart"), {
    type: "bar",
    data: {
      labels: simLabels,
      datasets: [{ label: "%", data: simValues, backgroundColor: "#26a69a", borderRadius: 6 }],
    },
    options: {
      scales: { y: { max: 100, beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });

  $("category_legend").innerHTML = labels
    .map(
      (l, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${escapeHtml(l)}: <strong>${values[i]} sa</strong></span>
    </div>`
    )
    .join("");
}

function applyEvaluationToUI(data) {
  $("stats_placeholder").hidden = true;
  $("stats_content").hidden = false;
  $("insights_placeholder").hidden = true;
  $("insights_content").hidden = false;

  setScoreRing(data.overall_score);
  updateScoreChip(data.overall_score);
  $("summary_text").textContent = data.summary;

  const rulesUl = $("rules_list");
  const rules = data.triggered_rules || [];
  if (!rules.length) {
    rulesUl.innerHTML = '<li class="severity-bilgi">Kritik kural tetiklenmedi.</li>';
  } else {
    rulesUl.innerHTML = rules
      .map((r) => `<li class="severity-${r.severity}">${escapeHtml(r.message)}</li>`)
      .join("");
  }

  $("recommendations_list").innerHTML = (data.recommendations || [])
    .map((r) => `<li>${escapeHtml(r)}</li>`)
    .join("");

  renderCharts(data);
}

function renderResults(data, { persist = true, navigateToStats = true } = {}) {
  if (persist) persistEvaluationResult(data);
  applyEvaluationToUI(data);
  if (navigateToStats) switchTab("stats");
}

async function loadMethods() {
  const res = await fetch("/api/methods", { credentials: "same-origin" });
  const data = await res.json();
  $("methods_list").innerHTML = data.methods
    .map((m) => `<li><strong>${m.name}:</strong> ${m.description}</li>`)
    .join("");
}

async function loadHistory() {
  const res = await fetch("/api/history", { credentials: "same-origin" });
  if (res.status === 401) return;
  const items = await res.json();
  const ul = $("history_list");
  if (!items.length) {
    ul.innerHTML = '<li class="muted">Henüz kayıt yok.</li>';
    return;
  }
  ul.innerHTML = items
    .map(
      (h) =>
        `<li class="history-item" data-id="${h.id}"><strong>${h.score}/100</strong> · ${escapeHtml(h.period)}<br><span>${escapeHtml(h.summary)}</span></li>`
    )
    .join("");
  ul.querySelectorAll(".history-item").forEach((li) => {
    li.addEventListener("click", () => openHistoryDetail(li.dataset.id));
  });
}

async function openHistoryDetail(id) {
  const res = await fetch(`/api/history/${id}`, { credentials: "same-origin" });
  if (!res.ok) return;
  const data = await res.json();
  const r = data.result || {};
  $("history_detail_backdrop").hidden = false;
  $("history_detail_title").textContent = `${data.score}/100 · ${data.period}`;
  $("history_detail_summary").textContent = data.summary;
  $("history_detail_recs").innerHTML = (r.recommendations || [])
    .map((x) => `<li>${escapeHtml(x)}</li>`)
    .join("");
  if (r.overall_score != null) renderResults(r, { persist: false, navigateToStats: false });
}

async function loadThresholds() {
  const res = await fetch("/api/thresholds");
  const data = await res.json();
  const ul = $("thresholds_list");
  if (!ul) return;
  ul.innerHTML = (data.thresholds || [])
    .map(
      (t) =>
        `<li><strong>${escapeHtml(t.label)}</strong> — günlük: ${escapeHtml(t.gunluk)}, haftalık: ${escapeHtml(t.haftalik)}<br><span class="muted">${escapeHtml(t.kaynak)}</span></li>`
    )
    .join("");
}

async function evaluate() {
  saveCurrentWeekDayToStore();
  if (!activities.length) {
    showToast(`${weekDayLabel(selectedWeekDay)} için en az bir aktivite ekleyin.`);
    return;
  }
  if (activities.some((a) => !a.category)) {
    showToast("Tüm aktivitelerde kategori seçili olmalı.");
    return;
  }

  if (isDaily()) {
    const dayTotal = selectedDayTotalHours();
    if (!isSelectedDayFullDay(dayTotal)) {
      showToast(
        `${weekDayLabel(selectedWeekDay)} için program toplamı 24 saat olmalı (şu an ${dayTotal.toFixed(1)} sa).`
      );
      return;
    }
  } else {
    const missing = getMissingWeekDays();
    if (missing.length) {
      showToast(
        `7 günün tamamını doldurun. Eksik: ${missing.map((d) => d.label).join(", ")}`
      );
      return;
    }
  }

  const conflicts = window.RutinConflicts
    ? RutinConflicts.detect(getAllActivitiesForPeriod(), getPeriod())
    : [];
  if (conflicts.length) {
    showToast(conflicts[0].message);
    RutinConflicts.renderBanner(conflicts);
    return;
  }

  const btn = $("btn_evaluate");
  btn.disabled = true;
  btn.textContent = "Analiz ediliyor…";

  try {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        activities: buildPayloadActivities(),
        period: getPeriod(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bilinmeyen hata");
    renderResults(data);
    if (await saveRoutineNow()) {
      showToast("Rutin kaydedildi.");
    }
    loadHistory();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Değerlendir";
  }
}

function loadSample() {
  saveCurrentWeekDayToStore();
  recomputeNextId();
  if (isDaily()) {
    weekDayStore[selectedWeekDay] = SAMPLE_DAILY.map((s) => ({
      id: nextId++,
      name: s.name,
      start: s.start,
      end: s.end,
      hours: hoursBetween(s.start, s.end),
      category: s.category,
      day: selectedWeekDay,
    }));
    loadSelectedWeekDayFromStore();
  } else {
    hydrateWeekStoreFromList(
      SAMPLE_WEEKLY.map((s) => ({
        id: nextId++,
        name: s.name,
        start: s.start,
        end: s.end,
        hours: hoursBetween(s.start, s.end),
        category: s.category,
        day: s.day,
      }))
    );
    selectedWeekDay = 0;
    loadSelectedWeekDayFromStore();
  }
  renderAll();
}

let confirmDialogResolve = null;

function openConfirmDialog({ title, message, hint = "", confirmLabel = "Onayla", icon = "🗑", danger = false }) {
  return new Promise((resolve) => {
    confirmDialogResolve = resolve;
    const backdrop = $("confirm_backdrop");
    if (!backdrop) {
      resolve(false);
      return;
    }
    $("confirm_title").textContent = title;
    $("confirm_message").textContent = message;
    const hintEl = $("confirm_hint");
    if (hintEl) {
      hintEl.textContent = hint;
      hintEl.hidden = !hint;
    }
    const iconEl = $("confirm_icon");
    if (iconEl) iconEl.textContent = icon;
    const okBtn = $("btn_confirm_ok");
    if (okBtn) {
      okBtn.textContent = confirmLabel;
      okBtn.classList.toggle("btn-danger", danger);
    }
    backdrop.hidden = false;
  });
}

function closeConfirmDialog(confirmed) {
  const backdrop = $("confirm_backdrop");
  if (backdrop) backdrop.hidden = true;
  if (confirmDialogResolve) {
    confirmDialogResolve(confirmed);
    confirmDialogResolve = null;
  }
}

async function executeClearDayRoutine() {
  const day = weekDayLabel(selectedWeekDay);
  weekDayStore[selectedWeekDay] = [];
  activities = [];
  if (isDaily()) delete evaluationStore.günlük[selectedWeekDay];
  else evaluationStore.haftalık = null;
  renderAll();

  if (!currentUser) {
    showToast(`${day} programı temizlendi.`);
    return;
  }
  const ok = await saveRoutineNow();
  showToast(
    ok ? `${day} temizlendi ve rutin kaydedildi.` : `${day} temizlendi; sunucuya kaydedilemedi.`
  );
}

async function confirmClearDayRoutine() {
  saveCurrentWeekDayToStore();
  const day = weekDayLabel(selectedWeekDay);
  const count = (weekDayStore[selectedWeekDay] || []).length;
  if (!count) {
    showToast(`${day} için zaten aktivite yok.`);
    return;
  }

  const hint = currentUser
    ? "Onaylarsanız değişiklik rutininize kaydedilir."
    : "Giriş yapmadıysanız yalnızca bu oturumda silinir.";
  const confirmed = await openConfirmDialog({
    title: "Programı temizle",
    message: `${day} günündeki ${count} aktivite kalıcı olarak silinecek.`,
    hint,
    confirmLabel: "Temizle",
    icon: "🗑",
    danger: true,
  });
  if (!confirmed) return;
  await executeClearDayRoutine();
}

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => setPeriod(btn.dataset.period));
});

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab);
    if (btn.dataset.tab === "stats" || btn.dataset.tab === "insights") {
      syncEvaluationPanel();
    }
  });
});

$("fab_add").addEventListener("click", () => openModal());
$("btn_modal_cancel").addEventListener("click", closeModal);
$("modal_backdrop").addEventListener("click", (e) => {
  if (e.target === $("modal_backdrop")) closeModal();
});

$("input_start").addEventListener("change", updateDurationPreview);
$("input_end").addEventListener("change", updateDurationPreview);

$("activity_form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("input_name").value.trim();
  const category = $("input_category").value;
  if (!name || !category) {
    showToast("Aktivite adı ve kategori zorunludur.");
    return;
  }

  const start = $("input_start").value;
  const end = $("input_end").value;
  const hours = hoursBetween(start, end);
  if (hours <= 0) {
    showToast("Geçerli başlangıç ve bitiş saati seçin.");
    return;
  }

  const payload = {
    name,
    category,
    start,
    end,
    hours,
    day: normalizeDayId(selectedWeekDay),
  };

  const editId = parseInt($("edit_id").value, 10);
  if (editId) updateActivity(editId, payload);
  else addActivity(payload);
  closeModal();
});

const btnEvaluate = $("btn_evaluate");
if (btnEvaluate) btnEvaluate.addEventListener("click", evaluate);
const btnSample = $("btn_sample");
if (btnSample) btnSample.addEventListener("click", loadSample);
const btnClear = $("btn_clear");
if (btnClear) btnClear.addEventListener("click", confirmClearDayRoutine);
const btnCopyDay = $("btn_copy_day");
if (btnCopyDay) btnCopyDay.addEventListener("click", openCopyDayModal);
const copySourceDay = $("copy_source_day");
if (copySourceDay) {
  copySourceDay.addEventListener("change", () => {
    renderCopyTargetDays(parseInt(copySourceDay.value, 10));
  });
}
const btnCopyCancel = $("btn_copy_cancel");
if (btnCopyCancel) btnCopyCancel.addEventListener("click", closeCopyDayModal);
const btnCopyConfirm = $("btn_copy_confirm");
if (btnCopyConfirm) btnCopyConfirm.addEventListener("click", applyCopyDay);
const copyDayBackdrop = $("copy_day_backdrop");
if (copyDayBackdrop) {
  copyDayBackdrop.addEventListener("click", (e) => {
    if (e.target === copyDayBackdrop) closeCopyDayModal();
  });
}

/* ——— Kullanıcı oturumu (auth.js ekranı yönetir) ——— */

function updateUserUI() {
  if (!currentUser) return;
  const initial = (currentUser.display_name || currentUser.username || "?")[0].toUpperCase();
  const av = $("user_avatar");
  const nm = $("user_menu_name");
  if (av) av.textContent = initial;
  if (nm) nm.textContent = currentUser.display_name || currentUser.username;
}

async function fetchRoutines() {
  const res = await fetch("/api/routines", { credentials: "same-origin" });
  if (!res.ok) return;
  const data = await res.json();
  routinesByPeriod.günlük = data.routines?.günlük || [];
  routinesByPeriod.haftalık = data.routines?.haftalık || [];
  loadPeriodFromCache();
  renderAll();
  await restoreSavedEvaluation();
}

async function saveRoutineNow() {
  if (!currentUser) return false;
  syncPeriodToCache();
  const payload = (routinesByPeriod.günlük || []).map(({ id, ...rest }) => rest);
  const headers = { "Content-Type": "application/json" };
  const opts = { method: "PUT", headers, credentials: "same-origin" };
  const results = await Promise.all(
    ["günlük", "haftalık"].map((period) =>
      fetch("/api/routine", {
        ...opts,
        body: JSON.stringify({ period, activities: payload }),
      })
    )
  );
  return results.every((r) => r.ok);
}

async function onLoginSuccess(user) {
  currentUser = user;
  updateUserUI();
  await fetchRoutines();
  loadHistory();
  setPeriod($("period")?.value || "günlük");
}

window.RutinApp = {
  onLogin: onLoginSuccess,
  onLogout() {
    currentUser = null;
    activities = [];
    weekDayStore = emptyWeekStore();
    routinesByPeriod.günlük = [];
    routinesByPeriod.haftalık = [];
    evaluationStore.günlük = {};
    evaluationStore.haftalık = null;
    renderAll();
  },
};

const btnUserMenu = $("btn_user_menu");
if (btnUserMenu) {
  btnUserMenu.addEventListener("click", () => {
    const b = $("user_menu_backdrop");
    if (b) b.hidden = false;
  });
}

const userMenuBackdrop = $("user_menu_backdrop");
if (userMenuBackdrop) {
  userMenuBackdrop.addEventListener("click", (e) => {
    if (e.target === userMenuBackdrop) userMenuBackdrop.hidden = true;
  });
}

loadMethods();
loadThresholds();
if (window.RutinTheme) RutinTheme.init();
loadPeriodFromCache();
renderAll();
switchTab("schedule");

const confirmBackdrop = $("confirm_backdrop");
if (confirmBackdrop) {
  confirmBackdrop.addEventListener("click", (e) => {
    if (e.target === confirmBackdrop) closeConfirmDialog(false);
  });
}
const btnConfirmCancel = $("btn_confirm_cancel");
if (btnConfirmCancel) btnConfirmCancel.addEventListener("click", () => closeConfirmDialog(false));
const btnConfirmOk = $("btn_confirm_ok");
if (btnConfirmOk) btnConfirmOk.addEventListener("click", () => closeConfirmDialog(true));

const histBackdrop = $("history_detail_backdrop");
if (histBackdrop) {
  histBackdrop.addEventListener("click", (e) => {
    if (e.target === histBackdrop) histBackdrop.hidden = true;
  });
}
const histClose = $("btn_history_close");
if (histClose) histClose.addEventListener("click", () => { $("history_detail_backdrop").hidden = true; });
