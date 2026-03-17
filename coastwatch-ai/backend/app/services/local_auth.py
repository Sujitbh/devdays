"""
PelicanEye - Local Auth Service

SQLite-backed user registration & login with bcrypt password hashing
and JWT token generation.  Works out-of-the-box without Supabase.
"""

import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jose import jwt
from passlib.context import CryptContext

from app.config import BASE_DIR, JWT_SECRET, SUPABASE_KEY, SUPABASE_URL, USE_SUPABASE
from app.services.supabase_client import get_supabase

# ── Password hashing ────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT settings ─────────────────────────────────────────────────────────────
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15   # Short-lived; use refresh token to renew
REFRESH_TOKEN_EXPIRE_DAYS = 7

# ── SQLite database ─────────────────────────────────────────────────────────
DB_PATH = BASE_DIR / "users.db"
_use_supabase = bool(USE_SUPABASE and SUPABASE_URL and SUPABASE_KEY)


_db_initialized = False


def _get_db() -> sqlite3.Connection:
    """Return a connection with row_factory set to sqlite3.Row.
    Auto-initializes the DB on first access as a safety net."""
    global _db_initialized
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    if not _db_initialized:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id         TEXT PRIMARY KEY,
                full_name  TEXT NOT NULL,
                email      TEXT NOT NULL UNIQUE,
                password   TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
        _db_initialized = True
    return conn


def init_db() -> None:
    """Create the users table if it doesn't already exist."""
    if _use_supabase:
        print("[PelicanEye] Using Supabase for auth users.")
        return
    conn = _get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            full_name  TEXT NOT NULL,
            email      TEXT NOT NULL UNIQUE,
            password   TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()
    print("[PelicanEye] Local auth DB ready:", DB_PATH)

def _sb_get_user_by_email(email: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("users").select("*").ilike("email", email).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _sb_get_user_by_id(user_id: str) -> dict | None:
    sb = get_supabase()
    res = sb.table("users").select("*").eq("id", user_id).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _sb_insert_user(user: dict) -> None:
    sb = get_supabase()
    sb.table("users").insert(user).execute()


# ── Public helpers ───────────────────────────────────────────────────────────

def _create_access_token(user_id: str, email: str) -> str:
    """Create a short-lived JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _create_refresh_token(user_id: str, email: str) -> str:
    """Create a long-lived JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def register_user(email: str, password: str, full_name: str) -> dict:
    """
    Register a new user.  Returns a dict with user info + tokens.
    Raises ValueError on duplicate email or validation issues.
    """
    if not email or not password:
        raise ValueError("Email and password are required.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    if _use_supabase:
        existing = _sb_get_user_by_email(email)
        if existing:
            raise ValueError("A user with this email already exists.")

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        hashed = pwd_ctx.hash(password)
        _sb_insert_user(
            {
                "id": user_id,
                "full_name": full_name,
                "email": email,
                "password_hash": hashed,
                "created_at": now,
            }
        )

        access_token = _create_access_token(user_id, email)
        refresh_token = _create_refresh_token(user_id, email)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": user_id, "email": email, "full_name": full_name},
        }

    conn = _get_db()
    # Check for existing user
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise ValueError("A user with this email already exists.")

    user_id = str(uuid.uuid4())
    hashed = pwd_ctx.hash(password)
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(
        "INSERT INTO users (id, full_name, email, password, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, full_name, email, hashed, now),
    )
    conn.commit()
    conn.close()

    access_token = _create_access_token(user_id, email)
    refresh_token = _create_refresh_token(user_id, email)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user_id,
            "email": email,
            "full_name": full_name,
        },
    }


def login_user(email: str, password: str) -> dict:
    """
    Authenticate an existing user.  Returns tokens + user info.
    Raises ValueError on bad credentials.
    """
    if _use_supabase:
        row = _sb_get_user_by_email(email)
        if row is None:
            raise ValueError("Invalid email or password.")
        if not pwd_ctx.verify(password, row["password_hash"]):
            raise ValueError("Invalid email or password.")
        access_token = _create_access_token(row["id"], row["email"])
        refresh_token = _create_refresh_token(row["id"], row["email"])
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": row["id"], "email": row["email"], "full_name": row["full_name"]},
        }

    conn = _get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if row is None:
        raise ValueError("Invalid email or password.")

    if not pwd_ctx.verify(password, row["password"]):
        raise ValueError("Invalid email or password.")

    access_token = _create_access_token(row["id"], row["email"])
    refresh_token = _create_refresh_token(row["id"], row["email"])
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
        },
    }


def get_user_from_token(token: str) -> dict:
    """Decode JWT (access token only) and return the user record.  Raises ValueError if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise ValueError("Invalid or expired token.")
    if payload.get("type") not in (None, "access"):
        raise ValueError("Invalid token type.")

    if _use_supabase:
        row = _sb_get_user_by_id(payload["sub"])
    else:
        conn = _get_db()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (payload["sub"],)).fetchone()
        conn.close()

    if row is None:
        raise ValueError("User not found.")

    return {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
    }


def refresh_tokens(refresh_token: str) -> dict:
    """
    Validate refresh token and return new access + refresh tokens.
    Raises ValueError if refresh token is invalid or expired.
    """
    if not refresh_token:
        raise ValueError("Refresh token is required.")
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise ValueError("Invalid or expired refresh token.")
    if payload.get("type") != "refresh":
        raise ValueError("Invalid token type.")

    user_id = payload["sub"]
    email = payload.get("email", "")

    if _use_supabase:
        row = _sb_get_user_by_id(user_id)
    else:
        conn = _get_db()
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
    if row is None:
        raise ValueError("User not found.")

    return {
        "access_token": _create_access_token(row["id"], row["email"]),
        "refresh_token": _create_refresh_token(row["id"], row["email"]),
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
        },
    }
