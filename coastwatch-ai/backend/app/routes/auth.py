"""
PelicanEye - Auth Routes

Endpoints for user registration, login, logout, and session check.
Uses a local SQLite database with bcrypt hashing and JWT tokens.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.limiter import limiter
from app.models.auth import RegisterRequest, LoginRequest, RefreshRequest, AuthResponse
from app.services.local_auth import register_user, login_user, get_user_from_token, refresh_tokens

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest):
    """
    Register a new user.

    Stores the user in the local SQLite database with a bcrypt-hashed password.
    Returns JWT access token on success.
    """
    try:
        result = register_user(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
        )
        log.info("User registered: %s", body.email)
        return AuthResponse(
            success=True,
            message="Registration successful.",
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            user=result["user"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    """
    Authenticate with email + password.

    Validates credentials against the local database and returns a JWT.
    """
    try:
        result = login_user(email=body.email, password=body.password)
        log.info("User logged in: %s", body.email)
        return AuthResponse(
            success=True,
            message="Login successful.",
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            user=result["user"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/refresh", response_model=AuthResponse)
@limiter.limit("10/minute")
async def refresh(request: Request, body: RefreshRequest):
    """
    Exchange a valid refresh token for new access and refresh tokens.
    Use when the access token has expired (e.g. after 401).
    """
    try:
        result = refresh_tokens(body.refresh_token)
        return AuthResponse(
            success=True,
            message="Tokens refreshed.",
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            user=result["user"],
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Refresh failed.") from exc


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Sign out the current user session (client should discard tokens)."""
    return {"success": True, "message": "Logged out."}


@router.get("/me")
async def get_current_user(authorization: str = Header(...)):
    """
    Validate the access token and return the current user.

    Expects header: Authorization: Bearer <access_token>
    """
    try:
        token = authorization.replace("Bearer ", "")
        user = get_user_from_token(token)
        return {"success": True, "user": user}
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
