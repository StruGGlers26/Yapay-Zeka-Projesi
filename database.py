"""
Yerel SQLite — kullanıcılar, kayıtlı rutin şablonları, değerlendirme geçmişi.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash

DB_PATH = Path(__file__).parent / "data" / "rutin.db"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS routines (
                user_id INTEGER NOT NULL,
                period TEXT NOT NULL,
                activities_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, period),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                period TEXT NOT NULL,
                score REAL NOT NULL,
                summary TEXT NOT NULL,
                result_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_eval_user ON evaluations(user_id, created_at DESC);
            """
        )


def create_user(username: str, password: str, display_name: str | None = None) -> dict[str, Any]:
    username = username.strip().lower()
    if len(username) < 3:
        raise ValueError("Kullanıcı adı en az 3 karakter olmalı.")
    if len(password) < 4:
        raise ValueError("Şifre en az 4 karakter olmalı.")
    display = (display_name or username).strip() or username
    pw_hash = generate_password_hash(password)
    now = _utc_now()
    with get_db() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, display_name, created_at) VALUES (?, ?, ?, ?)",
                (username, pw_hash, display, now),
            )
        except sqlite3.IntegrityError:
            raise ValueError("Bu kullanıcı adı zaten kayıtlı.") from None
        user_id = cur.lastrowid
    return {"id": user_id, "username": username, "display_name": display}


def authenticate(username: str, password: str) -> dict[str, Any] | None:
    username = username.strip().lower()
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, display_name FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
    }


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, username, display_name FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if not row:
        return None
    return dict(row)


def save_routine(user_id: int, period: str, activities: list[dict[str, Any]]) -> None:
    now = _utc_now()
    payload = json.dumps(activities, ensure_ascii=False)
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO routines (user_id, period, activities_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, period) DO UPDATE SET
                activities_json = excluded.activities_json,
                updated_at = excluded.updated_at
            """,
            (user_id, period, payload, now),
        )


def load_routine(user_id: int, period: str) -> list[dict[str, Any]] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT activities_json FROM routines WHERE user_id = ? AND period = ?",
            (user_id, period),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["activities_json"])


def load_all_routines(user_id: int) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    with get_db() as conn:
        rows = conn.execute(
            "SELECT period, activities_json FROM routines WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    for row in rows:
        out[row["period"]] = json.loads(row["activities_json"])
    return out


def save_evaluation(
    user_id: int,
    period: str,
    score: float,
    summary: str,
    result: dict[str, Any],
) -> int:
    now = _utc_now()
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO evaluations (user_id, period, score, summary, result_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, period, score, summary, json.dumps(result, ensure_ascii=False), now),
        )
        return int(cur.lastrowid)


def list_evaluations(user_id: int, limit: int = 20) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, period, score, summary, created_at
            FROM evaluations WHERE user_id = ?
            ORDER BY created_at DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def find_matching_evaluation(
    user_id: int,
    period: str,
    activities: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Mevcut rutinle aynı programa sahip en son değerlendirme sonucunu döndürür."""
    from analyzer import routine_signature

    target = routine_signature(activities, period)
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT result_json FROM evaluations
            WHERE user_id = ? AND period = ?
            ORDER BY created_at DESC LIMIT 40
            """,
            (user_id, period),
        ).fetchall()
    for row in rows:
        result = json.loads(row["result_json"])
        stored = result.get("activities") or []
        if routine_signature(stored, period) == target:
            return result
    return None


def get_evaluation(user_id: int, eval_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, period, score, summary, result_json, created_at
            FROM evaluations WHERE id = ? AND user_id = ?
            """,
            (eval_id, user_id),
        ).fetchone()
    if not row:
        return None
    data = dict(row)
    data["result"] = json.loads(data.pop("result_json"))
    return data


def get_user_baseline_hours(user_id: int, period: str) -> dict[str, float] | None:
    """Kayıtlı şablondan kullanıcının tipik kategori dağılımı."""
    activities = load_routine(user_id, period)
    if not activities:
        return None
    from analyzer import activities_from_payload, aggregate_hours, category_label

    acts = activities_from_payload(activities, period=period)
    if not acts:
        return None
    agg = aggregate_hours(acts)
    return {category_label(k): v for k, v in agg.items() if v > 0}
