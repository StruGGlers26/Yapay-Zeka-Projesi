window.RutinUtils = {
  $(id) {
    return document.getElementById(id);
  },
  escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  },
  showToast(msg) {
    document.querySelectorAll(".error-toast").forEach((el) => el.remove());
    const div = document.createElement("div");
    div.className = "error-toast";
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  },
  parseTimeToMinutes(t) {
    if (!t) return null;
    const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  },
  minutesToTime(min) {
    const h = Math.floor(min / 60) % 24;
    const m = Math.round(min % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  },
  hoursBetween(start, end) {
    const s = this.parseTimeToMinutes(start);
    const e = this.parseTimeToMinutes(end);
    if (s == null || e == null) return 0;
    let diff = e - s;
    if (diff <= 0) diff += 24 * 60;
    return Math.round((diff / 60) * 100) / 100;
  },
  formatDuration(hours) {
    if (hours < 1) return `${Math.round(hours * 60)} dk`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h} sa ${m} dk` : `${h} saat`;
  },
  catClass(cat) {
    return `cat-${cat || "diger"}`;
  },
  catColor(cat) {
    return RutinConfig.CATEGORY_COLORS[cat] || RutinConfig.CATEGORY_COLORS.diger;
  },
  catIcon(cat) {
    return RutinConfig.CATEGORY_ICONS[cat] || "📌";
  },
  categoryLabel(catId) {
    const found = (window.CATEGORIES || []).find((c) => c.id === catId);
    return found ? found.label : catId;
  },
  scoreColor(score) {
    if (score >= 75) return "#43a047";
    if (score >= 50) return "#ffb300";
    return "#e53935";
  },
};
