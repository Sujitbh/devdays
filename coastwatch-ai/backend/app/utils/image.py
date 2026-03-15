"""
PelicanEye - Image Utility Functions

Helpers for saving and processing uploaded images.
"""

import uuid
from pathlib import Path

from PIL import Image
from fastapi import UploadFile

from fastapi import HTTPException

from app.config import MAX_UPLOAD_BYTES, UPLOAD_DIR

CHUNK_SIZE = 1024 * 1024  # 1 MB


async def save_upload(file: UploadFile) -> Path:
    """
    Save an uploaded file to the uploads directory with a unique name.
    Enforces MAX_UPLOAD_BYTES; raises 413 if exceeded.
    Returns the full path to the saved file.
    """
    ext = Path(file.filename).suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name

    total = 0
    chunks = []
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)
    dest.write_bytes(b"".join(chunks))
    return dest


def validate_image(path: Path) -> bool:
    """Verify the file is a valid image that Pillow can open."""
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False
