"""
PelicanEye - Auth Dependencies

Reusable FastAPI dependencies for extracting the current user from JWT tokens.
"""

from fastapi import Header, HTTPException

from app.services.local_auth import get_user_from_token


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """
    Extract and validate the JWT from the Authorization header.
    Returns the user's ID (string UUID).
    Raises 401 if the token is missing, malformed, or expired.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header.")
    token = authorization.replace("Bearer ", "", 1)
    try:
        user = get_user_from_token(token)
        return user["id"]
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
