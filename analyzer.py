"""
Rutin değerlendirme motoru — harici API kullanmaz.
Kategoriler kullanıcı tarafından seçilir.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Kapsayıcı kategoriler: id -> görünen ad + günlük ideal saat
CATEGORIES: dict[str, dict[str, Any]] = {
    "uyku": {"label": "Uyku ve şekerleme", "ideal_daily": 8.0},
    "calisma": {"label": "İş, okul ve ders", "ideal_daily": 6.0},
    "egzersiz": {"label": "Spor ve fiziksel hareket", "ideal_daily": 1.0},
    "sosyal": {"label": "Aile, arkadaş ve sosyal", "ideal_daily": 1.5},
    "yemek": {"label": "Yemek ve içecek", "ideal_daily": 2.0},
    "kisisel_bakim": {"label": "Kişisel bakım (duş, giyinme…)", "ideal_daily": 0.75},
    "ev_duzen": {"label": "Ev, alışveriş ve düzen", "ideal_daily": 1.0},
    "hobi_eglence": {"label": "Hobi, mola ve dinlenme", "ideal_daily": 2.5},
    "ulasim": {"label": "Ulaşım ve yolculuk", "ideal_daily": 1.0},
    "diger": {"label": "Diğer", "ideal_daily": 0.5},
}

CATEGORY_IDS: list[str] = list(CATEGORIES.keys())

WEEK_DAYS: list[dict[str, Any]] = [
    {"id": 0, "label": "Pazartesi", "short": "Pzt"},
    {"id": 1, "label": "Salı", "short": "Sal"},
    {"id": 2, "label": "Çarşamba", "short": "Çar"},
    {"id": 3, "label": "Perşembe", "short": "Per"},
    {"id": 4, "label": "Cuma", "short": "Cum"},
    {"id": 5, "label": "Cumartesi", "short": "Cmt"},
    {"id": 6, "label": "Pazar", "short": "Paz"},
]
IDEAL_DAILY = np.array([CATEGORIES[c]["ideal_daily"] for c in CATEGORY_IDS])
IDEAL_WEEKLY_SCALE = 7.0
REQUIRED_DAILY_HOURS = 24.0
DAILY_HOURS_TOLERANCE = 0.25

# Kural eşikleri — kaynak: genel sağlık/yaşam önerileri (WHO, NSF özeti), günlük ×7 haftalık
THRESHOLDS: dict[str, dict[str, Any]] = {
    "uyku_min": {
        "gunluk": 6.0,
        "haftalik": 42.0,
        "kaynak": "Yetişkinler için günde ~7–9 saat uyku (NSF); alt sınır 6 sa/gün.",
    },
    "uyku_max": {
        "gunluk": 10.0,
        "haftalik": 63.0,
        "kaynak": "Günde 10 saatin üzeri sürekli uyku genelde aşırı kabul edilir.",
    },
    "egzersiz_min": {
        "gunluk": 0.33,
        "haftalik": 2.5,
        "kaynak": "WHO: haftada ~150 dk orta yoğunluk ≈ 2,5 saat; günlük ~20 dk.",
    },
    "calisma_max": {
        "gunluk": 10.0,
        "haftalik": 50.0,
        "kaynak": "Sürdürülebilir tam gün çalışma ~8–10 sa; haftalık aşırı yük uyarısı.",
    },
    "hobi_min_mola": {
        "gunluk": 0.5,
        "haftalik": 3.5,
        "kaynak": "Yoğun çalışmada günde en az ~30 dk dinlenme/eğlence önerisi.",
    },
    "calisma_mola_esik": {
        "gunluk": 4.0,
        "haftalik": 28.0,
        "kaynak": "4 saatten uzun çalışma bloklarında mola ihtiyacı artar.",
    },
    "sosyal_min": {
        "haftalik": 3.5,
        "kaynak": "Haftada birkaç saat sosyal etkileşim (ruh sağlığı için minimum).",
    },
    "denge_oran": {
        "gunluk": 0.65,
        "haftalik": 0.65,
        "kaynak": "Tek kategorinin toplam sürenin %65'ini aşması dengesiz sayılır.",
    },
}

WEEKLY_TEMPLATES = {
    "dengeli": np.array([56, 38, 7, 11, 14, 5, 7, 18, 7, 3]),
    "calisma_agir": np.array([49, 52, 3, 5, 12, 4, 5, 8, 6, 2]),
    "saglik_odakli": np.array([56, 28, 10, 9, 15, 6, 6, 24, 5, 3]),
}

# Eski kategori anahtarlarını yeniye eşle (geriye dönük uyumluluk)
_LEGACY_CATEGORY_MAP = {
    "is": "calisma",
    "beslenme": "yemek",
    "dinlenme": "hobi_eglence",
    "bakim": "kisisel_bakim",
}


def category_label(cat_id: str) -> str:
    return CATEGORIES.get(cat_id, CATEGORIES["diger"])["label"]


def normalize_category(cat: str | None) -> str:
    if not cat:
        return "diger"
    cat = cat.strip().lower()
    cat = _LEGACY_CATEGORY_MAP.get(cat, cat)
    return cat if cat in CATEGORIES else "diger"


def _t(key: str, period: str) -> float:
    p = "gunluk" if period == "günlük" else "haftalik"
    entry = THRESHOLDS[key]
    return float(entry.get(p, entry.get("haftalik", entry.get("gunluk", 0))))


def get_thresholds_info() -> list[dict[str, str]]:
    labels = {
        "uyku_min": "Minimum uyku",
        "uyku_max": "Maksimum uyku",
        "egzersiz_min": "Minimum hareket",
        "calisma_max": "Maksimum iş/okul",
        "hobi_min_mola": "Minimum dinlenme (mola kuralı)",
        "calisma_mola_esik": "Mola kuralı çalışma eşiği",
        "sosyal_min": "Minimum sosyal (haftalık)",
        "denge_oran": "Denge — tek kategori üst sınırı (oran)",
    }
    out = []
    for key, entry in THRESHOLDS.items():
        out.append({
            "id": key,
            "label": labels.get(key, key),
            "gunluk": str(entry.get("gunluk", "—")),
            "haftalik": str(entry.get("haftalik", entry.get("gunluk", "—"))),
            "kaynak": entry.get("kaynak", ""),
        })
    return out


RULES: list[dict[str, Any]] = [
    {
        "id": "sleep_low",
        "check": lambda f: f["uyku"] < _t("uyku_min", f.get("period", "günlük")),
        "severity": "yüksek",
        "msg": "Uyku süresi önerilen düzeyin altında. Yatış saatini 30–45 dk öne almayı deneyin.",
    },
    {
        "id": "sleep_high",
        "check": lambda f: f["uyku"] > _t("uyku_max", f.get("period", "günlük")),
        "severity": "orta",
        "msg": "Uyku süresi yüksek; gün içi düzeni veya uyku kalitesini gözden geçirin.",
    },
    {
        "id": "no_exercise",
        "check": lambda f: f["egzersiz"] < _t("egzersiz_min", f.get("period", "günlük")),
        "severity": "yüksek",
        "msg": "Fiziksel hareket yetersiz. Günde 20–30 dk yürüyüş veya haftalık toplamı artırın.",
    },
    {
        "id": "work_overload",
        "check": lambda f: f["calisma"] > _t("calisma_max", f.get("period", "günlük")),
        "severity": "yüksek",
        "msg": "İş/okul süresi yoğun. Net bitiş saati ve düzenli molalar planlayın.",
    },
    {
        "id": "no_breaks",
        "check": lambda f: (
            f["hobi_eglence"] < _t("hobi_min_mola", f.get("period", "günlük"))
            and f["calisma"] > _t("calisma_mola_esik", f.get("period", "günlük"))
        ),
        "severity": "orta",
        "msg": "Çalışma fazla, dinlenme/eğlence az. Gün içine en az 30 dk ekransız mola ekleyin.",
    },
    {
        "id": "social_isolation",
        "check": lambda f: f.get("period") == "haftalık"
        and f["sosyal"] < _t("sosyal_min", "haftalık"),
        "severity": "orta",
        "msg": "Sosyal zaman düşük. Haftada yüz yüze veya sesli bir buluşma planlamayı düşünün.",
    },
    {
        "id": "imbalance",
        "check": lambda f: _imbalance(f),
        "severity": "orta",
        "msg": "Zaman tek bir alanda toplanmış. Kategoriler arasında daha dengeli dağılım deneyin.",
    },
    {
        "id": "good_balance",
        "check": lambda f: _good_score(f) >= 75,
        "severity": "bilgi",
        "msg": "Genel denge iyi görünüyor. Küçük ayarlar için öneri listesine bakabilirsiniz.",
    },
]


def _imbalance(f: dict[str, float]) -> bool:
    vals = [f[k] for k in CATEGORY_IDS if f.get(k, 0) > 0]
    if len(vals) < 2:
        return False
    total = sum(vals) or 1
    limit = _t("denge_oran", f.get("period", "günlük"))
    return max(v / total for v in vals) > limit


def _good_score(f: dict[str, float]) -> float:
    ideal = IDEAL_DAILY if f.get("period") == "günlük" else IDEAL_DAILY * IDEAL_WEEKLY_SCALE
    user = np.array([f.get(k, 0) for k in CATEGORY_IDS])
    return float(cosine_similarity([user], [ideal])[0][0]) * 100


@dataclass
class Activity:
    name: str
    hours: float
    category: str
    start: str | None = None
    end: str | None = None
    day: int | None = None


@dataclass
class EvaluationResult:
    period: str
    activities: list[Activity]
    category_hours: dict[str, float]
    feature_vector: list[float]
    overall_score: float
    similarity_scores: dict[str, float]
    best_template: str
    triggered_rules: list[dict[str, str]]
    recommendations: list[str]
    summary: str
    days_missing: list[str] | None = None
    time_conflicts: list[dict[str, str]] | None = None
    template_tip: str | None = None


def parse_clock(text: str) -> int | None:
    """HH:MM -> dakika (gece yarısından itibaren)."""
    if not text:
        return None
    m = re.match(r"^(\d{1,2}):(\d{2})$", str(text).strip())
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return h * 60 + mi


def hours_from_clock_range(start: str, end: str) -> float:
    s, e = parse_clock(start), parse_clock(end)
    if s is None or e is None:
        return 0.0
    diff = e - s
    if diff <= 0:
        diff += 24 * 60
    return round(diff / 60.0, 2)


def parse_duration_text(text: str) -> float:
    text = text.lower().strip()
    if not text:
        return 0.0
    m = re.search(r"(\d+[.,]?\d*)\s*(saat|s|h)", text)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"(\d+)\s*(dk|dakika|min)", text)
    if m:
        return int(m.group(1)) / 60.0
    m = re.search(r"^(\d+[.,]?\d*)$", text)
    if m:
        return float(m.group(1).replace(",", "."))
    return 0.0


def _normalize_day(raw_day: Any) -> int | None:
    if raw_day is None:
        return None
    try:
        d = int(raw_day)
    except (TypeError, ValueError):
        return None
    return d if 0 <= d <= 6 else None


def week_days_missing(activities: list[Activity]) -> list[str]:
    filled = {a.day for a in activities if a.day is not None}
    return [d["label"] for d in WEEK_DAYS if d["id"] not in filled]


def activities_from_payload(items: list[dict[str, Any]], period: str = "günlük") -> list[Activity]:
    result: list[Activity] = []
    for raw in items:
        name = str(raw.get("name", "")).strip()
        if not name:
            continue
        cat = normalize_category(raw.get("category"))
        start = raw.get("start") or None
        end = raw.get("end") or None
        day = _normalize_day(raw.get("day"))
        if period == "haftalık" and day is None:
            continue
        hours = raw.get("hours")
        if hours is not None:
            hours = float(hours)
        elif start and end:
            hours = hours_from_clock_range(start, end)
        else:
            hours = 0.0
        if hours <= 0:
            continue
        result.append(
            Activity(
                name=name,
                hours=round(hours, 2),
                category=cat,
                start=start,
                end=end,
                day=day,
            )
        )
    return result


def routine_signature(items: list[dict[str, Any]], period: str) -> str:
    """Kayıtlı rutin ile geçmiş değerlendirmeyi eşleştirmek için kanonik imza."""
    period = period.lower().strip()
    normalized: list[dict[str, Any]] = []
    for raw in items or []:
        name = str(raw.get("name", "")).strip()
        if not name:
            continue
        entry: dict[str, Any] = {
            "n": name,
            "s": raw.get("start") or "",
            "e": raw.get("end") or "",
            "c": raw.get("category") or "",
        }
        if period == "haftalık":
            day = _normalize_day(raw.get("day"))
            entry["d"] = day if day is not None else -1
        normalized.append(entry)
    normalized.sort(
        key=lambda x: (
            x.get("d", 0),
            str(x.get("s", "")),
            str(x.get("n", "")),
        )
    )
    return json.dumps(normalized, ensure_ascii=False, sort_keys=True)


def aggregate_hours(activities: list[Activity]) -> dict[str, float]:
    agg = {k: 0.0 for k in CATEGORY_IDS}
    for a in activities:
        agg[a.category] = agg.get(a.category, 0) + a.hours
    return agg


def build_features(agg: dict[str, float], period: str) -> dict[str, float]:
    f = dict(agg)
    f["period"] = period
    f["total"] = sum(agg.values())
    return f


def compute_similarity(agg: dict[str, float], period: str) -> dict[str, float]:
    user = np.array([agg.get(k, 0) for k in CATEGORY_IDS]).reshape(1, -1)
    if period == "günlük":
        scores = {"ideal_gunluk": float(cosine_similarity(user, IDEAL_DAILY.reshape(1, -1))[0][0])}
        for name, tmpl in WEEKLY_TEMPLATES.items():
            scaled = (tmpl / IDEAL_WEEKLY_SCALE).reshape(1, -1)
            scores[f"haftalik_{name}"] = float(cosine_similarity(user, scaled)[0][0])
    else:
        scores = {}
        for name, tmpl in WEEKLY_TEMPLATES.items():
            scores[name] = float(cosine_similarity(user, tmpl.reshape(1, -1))[0][0])
        ideal_week = (IDEAL_DAILY * IDEAL_WEEKLY_SCALE).reshape(1, -1)
        scores["ideal_haftalik"] = float(cosine_similarity(user, ideal_week)[0][0])
    return scores


def activity_intervals(act: Activity) -> list[tuple[int, int]]:
    """Dakika aralıkları (0–1440); gece yarısını geçen aktivite ikiye bölünür."""
    if not act.start or not act.end:
        return []
    s, e = parse_clock(act.start), parse_clock(act.end)
    if s is None or e is None:
        return []
    if e > s:
        return [(s, e)]
    return [(s, 24 * 60), (0, e)]


def _intervals_overlap(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def detect_time_conflicts(activities: list[Activity], period: str) -> list[dict[str, str]]:
    conflicts: list[dict[str, str]] = []
    groups: dict[int, list[Activity]] = {}
    for act in activities:
        if not act.start or not act.end:
            continue
        day_key = 0 if period == "günlük" else (act.day if act.day is not None else -1)
        if day_key < 0:
            continue
        groups.setdefault(day_key, []).append(act)

    for day_key, acts in groups.items():
        day_label = "Gün" if period == "günlük" else next(
            (d["label"] for d in WEEK_DAYS if d["id"] == day_key), f"Gün {day_key}"
        )
        for i in range(len(acts)):
            for j in range(i + 1, len(acts)):
                a, b = acts[i], acts[j]
                for ia in activity_intervals(a):
                    for ib in activity_intervals(b):
                        if _intervals_overlap(ia, ib):
                            conflicts.append({
                                "day": day_label,
                                "a": a.name,
                                "b": b.name,
                                "time_a": f"{a.start}–{a.end}",
                                "time_b": f"{b.start}–{b.end}",
                                "message": (
                                    f"{day_label}: «{a.name}» ({a.start}–{a.end}) ile "
                                    f"«{b.name}» ({b.start}–{b.end}) çakışıyor."
                                ),
                            })
                            break
    return conflicts


def template_tip_for(best_template: str, sim_scores: dict[str, float], period: str) -> str:
    if not sim_scores or not best_template or best_template == "—":
        return ""
    score = sim_scores.get(best_template, 0)
    name = best_template.replace("_", " ")
    pct = int(round(score * 100))
    tips = {
        "ideal_gunluk": "Genel dengeli günlük dağılıma yakınsınız; küçük sapmaları kategori bazında düzeltin.",
        "ideal_haftalik": "Haftalık genel dengeye yakınsınız; eksik günleri dengeleyin.",
        "dengeli": "Dengeli yaşam şablonuna uygun — uyku, çalışma ve dinlenmeyi koruyun.",
        "calisma_agir": "İş/okul ağırlıklı bir yapı; molaları ve hareketi ihmal etmeyin.",
        "saglik_odakli": "Sağlık odaklı şablona yakınsınız; uyku ve hareketi sürdürün.",
        "haftalik_dengeli": "Haftalık dengeli şablona yakınsınız.",
        "haftalik_calisma_agir": "Haftalık iş ağırlıklı profil; tükenmişliği önlemek için dinlenme ekleyin.",
        "haftalik_saglik_odakli": "Sağlık odaklı haftalık profile yakınsınız.",
    }
    tip = tips.get(best_template, f"«{name}» profiline %{pct} benzerlik.")
    return f"En yakın şablon: {name} (%{pct}). {tip}"


def overall_score(agg: dict[str, float], period: str, sim_scores: dict[str, float]) -> float:
    f = build_features(agg, period)
    ideal = IDEAL_DAILY if period == "günlük" else IDEAL_DAILY * IDEAL_WEEKLY_SCALE
    user = np.array([agg.get(k, 0) for k in CATEGORY_IDS])
    balance = float(cosine_similarity([user], [ideal])[0][0]) * 55
    best_sim = max(sim_scores.values()) * 35 if sim_scores else 0
    penalty = 0
    if f["uyku"] < _t("uyku_min", period):
        penalty += 15
    if f["egzersiz"] < _t("egzersiz_min", period):
        penalty += 10
    if f["calisma"] > _t("calisma_max", period) + 2:
        penalty += 10
    rule_bonus = 10 if not _imbalance(f) else 0
    return round(min(100, max(0, balance + best_sim + rule_bonus - penalty)), 1)


def run_rules(f: dict[str, float]) -> list[dict[str, str]]:
    triggered = []
    for rule in RULES:
        try:
            if rule["check"](f):
                triggered.append(
                    {"id": rule["id"], "severity": rule["severity"], "message": rule["msg"]}
                )
        except (KeyError, TypeError):
            continue
    return triggered


def generate_recommendations(
    agg: dict[str, float],
    period: str,
    score: float,
    sim_scores: dict[str, float],
    rules: list[dict[str, str]],
) -> list[str]:
    recs: list[str] = []
    ideal = IDEAL_DAILY if period == "günlük" else IDEAL_DAILY * IDEAL_WEEKLY_SCALE

    for i, cat_id in enumerate(CATEGORY_IDS):
        diff = ideal[i] - agg.get(cat_id, 0)
        label = category_label(cat_id)
        if diff > 1.0:
            unit = "saat/gün" if period == "günlük" else "saat/hafta"
            recs.append(
                f"«{label}» için yaklaşık {diff:.1f} {unit} daha ayırabilirsiniz "
                f"(şu an {agg.get(cat_id, 0):.1f} saat)."
            )
        elif diff < -2.0:
            recs.append(
                f"«{label}» süresi yüksek ({agg.get(cat_id, 0):.1f} saat); "
                f"diğer alanlara zaman aktarmayı düşünün."
            )

    if score < 50:
        recs.insert(
            0,
            "Genel skor düşük: aktiviteleri net başlangıç–bitiş saatleri ve doğru kategori ile yeniden düzenleyin.",
        )
    elif score >= 80:
        recs.append("Skor iyi; küçük ayarlar dışında mevcut rutini sürdürebilirsiniz.")

    best_tpl = max(sim_scores, key=sim_scores.get) if sim_scores else ""
    if best_tpl and sim_scores.get(best_tpl, 0) > 0.85:
        recs.append(f"Rutininiz «{best_tpl.replace('_', ' ')}» şablonuna yüksek benzerlik gösteriyor.")

    seen: set[str] = set()
    for r in rules:
        if r["severity"] in ("yüksek", "orta") and r["message"] not in seen:
            recs.append(r["message"])
            seen.add(r["message"])

    return recs[:12]


def build_summary(score: float, period: str, best_template: str, total_hours: float) -> str:
    level = "zayıf" if score < 50 else "orta" if score < 75 else "iyi"
    return (
        f"{period.capitalize()} rutininiz toplam {total_hours:.1f} saat. "
        f"Değerlendirme skoru: {score}/100 ({level}). "
        f"En yakın şablon: {best_template.replace('_', ' ')}."
    )


def evaluate_activities(
    items: list[dict[str, Any]],
    period: str = "günlük",
) -> EvaluationResult:
    period = period.lower().strip()
    if period not in ("günlük", "haftalık"):
        period = "günlük"

    activities = activities_from_payload(items, period=period)
    if not activities:
        raise ValueError("Geçerli aktivite bulunamadı.")

    missing_days: list[str] | None = None
    if period == "haftalık":
        missing_days = week_days_missing(activities)
        if missing_days:
            raise ValueError(
                "Haftalık değerlendirme için 7 günün tamamına aktivite girin. "
                f"Eksik günler: {', '.join(missing_days)}."
            )

    conflicts = detect_time_conflicts(activities, period)
    if conflicts:
        msgs = [c["message"] for c in conflicts[:5]]
        extra = f" (+{len(conflicts) - 5} çakışma daha)" if len(conflicts) > 5 else ""
        raise ValueError("Zaman çakışması var: " + " | ".join(msgs) + extra)

    if period == "günlük":
        day_total = round(sum(a.hours for a in activities), 2)
        if abs(day_total - REQUIRED_DAILY_HOURS) > DAILY_HOURS_TOLERANCE:
            raise ValueError(
                f"Günlük değerlendirme için program toplamı 24 saat olmalı "
                f"(şu an {day_total:.1f} saat)."
            )

    agg = aggregate_hours(activities)
    f = build_features(agg, period)
    sim_scores = compute_similarity(agg, period)
    best_template = max(sim_scores, key=sim_scores.get) if sim_scores else "—"
    score = overall_score(agg, period, sim_scores)
    rules = run_rules(f)
    recs = generate_recommendations(agg, period, score, sim_scores, rules)
    tip = template_tip_for(best_template, sim_scores, period)
    if tip and tip not in recs:
        recs.insert(0, tip)

    category_hours_labeled = {
        category_label(k): round(v, 2) for k, v in agg.items() if v > 0
    }

    return EvaluationResult(
        period=period,
        activities=activities,
        category_hours=category_hours_labeled,
        feature_vector=[round(agg.get(k, 0), 2) for k in CATEGORY_IDS],
        overall_score=score,
        similarity_scores={k: round(v, 3) for k, v in sim_scores.items()},
        best_template=best_template,
        triggered_rules=rules,
        recommendations=recs,
        summary=build_summary(score, period, best_template, f["total"]),
        days_missing=missing_days,
        time_conflicts=[],
        template_tip=tip or None,
    )


# Geriye dönük: metin satırları (kategori içermez -> diger)
def evaluate_routine(
    lines: list[str],
    period: str = "günlük",
    default_hours: float = 1.0,
) -> EvaluationResult:
    items = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        start_m = re.match(r"^(\d{1,2}:\d{2})\s+(.+)$", line)
        start, rest = (start_m.group(1), start_m.group(2)) if start_m else (None, line)
        if "|" in rest:
            name, dur = [p.strip() for p in rest.split("|", 1)]
            items.append({"name": name, "start": start, "hours": parse_duration_text(dur) or default_hours, "category": "diger"})
        else:
            items.append({"name": rest, "start": start, "hours": default_hours, "category": "diger"})
    return evaluate_activities(items, period)
