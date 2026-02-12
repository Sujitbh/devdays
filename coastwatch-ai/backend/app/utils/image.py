"""
PelicanEye - Image Utility Functions

Helpers for saving and processing uploaded images.
"""

import uuid
from pathlib import Path

from PIL import Image
from fastapi import UploadFile

from app.config import UPLOAD_DIR


async def save_upload(file: UploadFile) -> Path:
    """
    Save an uploaded file to the uploads directory with a unique name.
    Returns the full path to the saved file.
    """
    # Generate a unique filename to avoid collisions
    ext = Path(file.filename).suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / unique_name

    # Write the file contents
    contents = await file.read()
    dest.write_bytes(contents)

    return dest


def validate_image(path: Path) -> bool:
    """Verify the file is a valid image that Pillow can open."""
    try:
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False
