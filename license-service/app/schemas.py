"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime


# ---- Input ----

class RegisterKeyRequest(BaseModel):
    """Body for POST /keys — registers a new KID/KEY pair."""
    kid: str = Field(..., min_length=32, max_length=32, description="Key ID (hex, 32 chars)")
    key_hex: str = Field(..., min_length=32, max_length=32, description="Encryption key (hex, 32 chars)")
    video_id: str = Field(..., min_length=1, max_length=64, description="Video identifier")


class LicenseRequest(BaseModel):
    """
    Body for POST /license — the player sends the KID(s) it needs.
    Format follows the W3C ClearKey license request spec.
    """
    kids: List[str] = Field(..., description="List of KIDs (base64url) the player requests")


# ---- Output ----

class RegisterKeyResponse(BaseModel):
    kid: str
    video_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ContentKeyInfo(BaseModel):
    """Response for GET /keys/:kid — debugging info (does NOT include the secret key)."""
    kid: str
    video_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClearKeyEntry(BaseModel):
    """A single key in the ClearKey license response."""
    kty: str = "oct"
    k: str    # base64url-encoded key
    kid: str  # base64url-encoded key id


class LicenseResponse(BaseModel):
    """Response for POST /license — W3C ClearKey format."""
    keys: List[ClearKeyEntry]