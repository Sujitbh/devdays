"""
PelicanEye - Auth Pydantic Models

Request/response schemas for registration and login endpoints.
"""

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    """Body for the POST /api/auth/register endpoint."""
    email: EmailStr
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    """Body for the POST /api/auth/login endpoint."""
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    """Successful auth response with tokens and user info."""
    success: bool
    message: str
    access_token: str
    refresh_token: str
    user: dict


class AuthError(BaseModel):
    """Error response from auth endpoints."""
    success: bool = False
    message: str
