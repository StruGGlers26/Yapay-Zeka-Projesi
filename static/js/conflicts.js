/** Yerel zaman çakışması tespiti (sunucu ile aynı mantık) */
window.RutinConflicts = {
  activityIntervals(act) {
    const U = RutinUtils;
    const s = U.parseTimeToMinutes(act.start);
    const e = U.parseTimeToMinutes(act.end);
    if (s == null || e == null) return [];
    if (e > s) return [{ start: s, end: e }];
    return [
      { start: s, end: 24 * 60 },
      { start: 0, end: e },
    ];
  },
  overlap(a, b) {
    return a.start < b.end && b.start < a.end;
  },
  detect(activities, period) {
    const U = RutinUtils;
    const conflicts = [];
    const groups = {};
    for (const act of activities) {
      if (!act.start || !act.end) continue;
      const dayKey = period === "günlük" ? 0 : act.day;
      if (period === "haftalık" && (dayKey == null || dayKey < 0)) continue;
      (groups[dayKey] ||= []).push(act);
    }
    for (const [dayKey, acts] of Object.entries(groups)) {
      const dayLabel =
        period === "günlük"
          ? "Bugün"
          : RutinConfig.WEEK_DAYS.find((d) => d.id === parseInt(dayKey, 10))?.label || `Gün ${dayKey}`;
      for (let i = 0; i < acts.length; i++) {
        for (let j = i + 1; j < acts.length; j++) {
          const a = acts[i];
          const b = acts[j];
          for (const ia of this.activityIntervals(a)) {
            for (const ib of this.activityIntervals(b)) {
              if (this.overlap(ia, ib)) {
                conflicts.push({
                  message: `${dayLabel}: «${a.name}» (${a.start}–${a.end}) ile «${b.name}» (${b.start}–${b.end}) çakışıyor.`,
                });
              }
            }
          }
        }
      }
    }
    return conflicts;
  },
  renderBanner(conflicts) {
    const el = RutinUtils.$("conflict_banner");
    if (!el) return;
    if (!conflicts.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = `
      <strong>⚠ Zaman çakışması</strong>
      <ul>${conflicts.map((c) => `<li>${RutinUtils.escapeHtml(c.message)}</li>`).join("")}</ul>
      <p class="conflict-hint">Değerlendirme yapılamaz; saatleri düzeltin.</p>
    `;
  },
};
