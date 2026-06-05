"""
Rutin Değerlendirme ve Öneri Sistemi — Flask web uygulaması.
Kullanıcı girişi, kayıtlı rutin şablonları ve kişisel değerlendirme geçmişi.
"""

from __future__ import annotations

import secrets
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session

from analyzer import (
    CATEGORIES,
    activities_from_payload,
    detect_time_conflicts,
    evaluate_activities,
    evaluate_routine,
    get_thresholds_info,
)
from database import (
    authenticate,
    create_user,
    find_matching_evaluation,
    get_evaluation,
    get_user_by_id,
    init_db,
    list_evaluations,
    load_all_routines,
    save_evaluation,
    save_routine,
)

app = Flask(__name__)
SECRET_PATH = Path(__file__).parent / "data" / ".secret"


def _get_secret_key() -> str:
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text(encoding="utf-8").strip()
    key = secrets.token_hex(32)
    SECRET_PATH.parent.mkdir(parents=True, exist_ok=True)
    SECRET_PATH.write_text(key, encoding="utf-8")
    return key


app.secret_key = _get_secret_key()
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_HTTPONLY=True,
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)
init_db()


def _current_user() -> dict | None:
    uid = session.get("user_id")
    if not uid:
        return None
    return get_user_by_id(int(uid))


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _current_user():
            return jsonify({"error": "Giriş yapmanız gerekiyor."}), 401
        return fn(*args, **kwargs)

    return wrapper


def _result_to_dict(result) -> dict:
    return {
        "period": result.period,
        "summary": result.summary,
        "overall_score": result.overall_score,
        "category_hours": result.category_hours,
        "feature_vector": result.feature_vector,
        "feature_labels": list(CATEGORIES.keys()),
        "similarity_scores": result.similarity_scores,
        "best_template": result.best_template,
        "activities": [
            {
                "name": a.name,
                "hours": round(a.hours, 2),
                "category": a.category,
                "category_label": CATEGORIES[a.category]["label"],
                "start": a.start,
                "end": a.end,
                "day": a.day,
            }
            for a in result.activities
        ],
        "triggered_rules": result.triggered_rules,
        "recommendations": result.recommendations,
        "template_tip": result.template_tip,
        "time_conflicts": result.time_conflicts or [],
    }


@app.route("/")
def index():
    category_list = [
        {"id": cid, "label": info["label"]} for cid, info in CATEGORIES.items()
    ]
    return render_template("index.html", categories=category_list)


@app.route("/api/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    display_name = data.get("display_name", "")
    try:
        user = create_user(username, password, display_name)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session.permanent = True
    return jsonify({"user": user})


@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    user = authenticate(data.get("username", ""), data.get("password", ""))
    if not user:
        return jsonify({"error": "Kullanıcı adı veya şifre hatalı."}), 401
    session["user_id"] = user["id"]
    session["username"] = user["username"]
    session.permanent = True
    return jsonify({"user": user})


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/auth/me")
def api_me():
    user = _current_user()
    return jsonify({"user": user})


@app.route("/api/routines")
@login_required
def api_get_routines():
    user = _current_user()
    assert user
    routines = load_all_routines(user["id"])
    return jsonify({"routines": routines})


@app.route("/api/routine", methods=["PUT"])
@login_required
def api_save_routine():
    user = _current_user()
    assert user
    data = request.get_json(silent=True) or {}
    period = data.get("period", "günlük")
    activities = data.get("activities", [])
    save_routine(user["id"], period, activities)
    return jsonify({"ok": True, "period": period, "count": len(activities)})


@app.route("/api/evaluate", methods=["POST"])
@login_required
def api_evaluate():
    user = _current_user()
    assert user
    data = request.get_json(silent=True) or {}
    period = data.get("period", "günlük")
    payload_activities = data.get("activities")

    try:
        if payload_activities:
            if not payload_activities:
                return jsonify({"error": "En az bir aktivite ekleyin."}), 400
            result = evaluate_activities(payload_activities, period=period)
        else:
            text = data.get("routine_text", "")
            lines = [ln for ln in text.strip().splitlines() if ln.strip()]
            if not lines:
                return jsonify({"error": "En az bir aktivite ekleyin."}), 400
            default_hours = float(data.get("default_hours", 1.0))
            result = evaluate_routine(lines, period=period, default_hours=default_hours)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Değerlendirme hatası: {exc}"}), 500

    payload = _result_to_dict(result)

    save_evaluation(
        user["id"],
        period,
        result.overall_score,
        result.summary,
        payload,
    )

    return jsonify(payload)


@app.route("/api/conflicts", methods=["POST"])
@login_required
def api_conflicts():
    data = request.get_json(silent=True) or {}
    period = data.get("period", "günlük")
    items = data.get("activities", [])
    try:
        acts = activities_from_payload(items, period=period)
        conflicts = detect_time_conflicts(acts, period)
        return jsonify({"conflicts": conflicts})
    except Exception as exc:
        return jsonify({"error": str(exc), "conflicts": []}), 400


@app.route("/api/thresholds")
def api_thresholds():
    return jsonify({"thresholds": get_thresholds_info()})


@app.route("/api/evaluation/lookup", methods=["POST"])
@login_required
def api_evaluation_lookup():
    """Kayıtlı rutin ile eşleşen son değerlendirme sonucunu döndürür."""
    user = _current_user()
    assert user
    data = request.get_json(silent=True) or {}
    period = data.get("period", "günlük")
    items = data.get("activities") or []
    if not items:
        return jsonify({"error": "Aktivite yok."}), 400
    result = find_matching_evaluation(user["id"], period, items)
    if not result:
        return jsonify({"error": "Bu rutin için kayıtlı değerlendirme bulunamadı."}), 404
    return jsonify(result)


@app.route("/api/history/<int:eval_id>")
@login_required
def api_history_detail(eval_id: int):
    user = _current_user()
    assert user
    row = get_evaluation(user["id"], eval_id)
    if not row:
        return jsonify({"error": "Kayıt bulunamadı."}), 404
    return jsonify(row)


@app.route("/api/history")
@login_required
def api_history():
    user = _current_user()
    assert user
    return jsonify(list_evaluations(user["id"]))


@app.route("/api/methods")
def api_methods():
    return jsonify({
        "title": "Kullanılan Yapay Zeka Yöntemleri",
        "methods": [
            {
                "name": "Kullanıcı tanımlı kategoriler",
                "description": "Her aktivite kullanıcı tarafından seçilen kategoriyle etiketlenir.",
            },
            {
                "name": "Özellik vektörü oluşturma",
                "description": "Kategori başına saat sürelerinden sayısal vektör üretilir.",
            },
            {
                "name": "Kosinüs benzerliği",
                "description": "İdeal şablonlarla sklearn cosine_similarity karşılaştırması.",
            },
            {
                "name": "Kural tabanlı uzman sistemi",
                "description": "Uyku, iş yükü ve denge için IF-THEN kuralları.",
            },
        ],
    })


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
