"""
PelicanEye - Auth Routes

Endpoints for user registration, login, logout, and session check.
Uses Supabase Auth (GoTrue) — handles password hashing, JWTs, etc.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from app.models.auth import RegisterRequest, LoginRequest, AuthResponse
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    """
    Register a new user with Supabase Auth.

    Supabase handles password hashing and stores users in its auth.users table.
    """
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {
                "data": {
                    "full_name": body.full_name,
                }
            }
        })

        if result.user is None:
            raise HTTPException(status_code=400, detail="Registration failed. User may already exist.")

        return AuthResponse(
            success=True,
            message="Registration successful.",
            access_token=result.session.access_token if result.session else "",
            refresh_token=result.session.refresh_token if result.session else "",
            user={
                "id": str(result.user.id),
                "email": result.user.email,
                "full_name": body.full_name,
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """
    Log in with email and password via Supabase Auth.

    Returns access and refresh tokens.
    """
    try:
        supabase = get_supabase()
        result = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })

        if result.user is None or result.session is None:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        user_meta = result.user.user_metadata or {}

        return AuthResponse(
            success=True,
            message="Login successful.",
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
            user={
                "id": str(result.user.id),
                "email": result.user.email,
                "full_name": user_meta.get("full_name", ""),
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    """Sign out the current user session."""
    try:
        supabase = get_supabase()
        supabase.auth.sign_out()
        return {"success": True, "message": "Logged out."}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/me")
async def get_current_user(authorization: str = Header(...)):
    """
    Validate the access token and return the current user.

    Expects header: Authorization: Bearer <access_token>
    """
    try:
        token = authorization.replace("Bearer ", "")
        supabase = get_supabase()
        result = supabase.auth.get_user(token)

        if result.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")

        user_meta = result.user.user_metadata or {}

        return {
            "success": True,
            "user": {
                "id": str(result.user.id),
                "email": result.user.email,
                "full_name": user_meta.get("full_name", ""),
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
