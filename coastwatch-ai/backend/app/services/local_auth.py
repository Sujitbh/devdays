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

from app.config import BASE_DIR

# ── Password hashing ────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── JWT settings ─────────────────────────────────────────────────────────────
JWT_SECRET = "pelicaneye-local-dev-secret-change-in-production"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# ── SQLite database ─────────────────────────────────────────────────────────
DB_PATH = BASE_DIR / "users.db"


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


# ── Public helpers ───────────────────────────────────────────────────────────

def _create_token(user_id: str, email: str) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
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

    token = _create_token(user_id, email)
    return {
        "access_token": token,
        "refresh_token": token,  # same token for local dev
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
    conn = _get_db()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if row is None:
        raise ValueError("Invalid email or password.")

    if not pwd_ctx.verify(password, row["password"]):
        raise ValueError("Invalid email or password.")

    token = _create_token(row["id"], row["email"])
    return {
        "access_token": token,
        "refresh_token": token,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
        },
    }


def get_user_from_token(token: str) -> dict:
    """Decode JWT and return the user record.  Raises ValueError if invalid."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise ValueError("Invalid or expired token.")

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
