import base64
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from .database import get_db
from .models import ContentKey
from .schemas import (
    RegisterKeyRequest,
    RegisterKeyResponse,
    ContentKeyInfo,
    LicenseRequest,
    LicenseResponse,
    ClearKeyEntry,
)

router = APIRouter()


def _hex_to_base64url(hex_str: str) -> str:
    """
    Convert a hex string to base64url (no padding).
    The W3C ClearKey format requires base64url encoding.
    """
    raw = bytes.fromhex(hex_str)
    encoded = base64.urlsafe_b64encode(raw).decode("ascii")
    return encoded.rstrip("=")


def _base64url_to_hex(b64url_str: str) -> str:
    """Inverse of _hex_to_base64url. Accepts both padded and unpadded input."""
    padded = b64url_str + "=" * (-len(b64url_str) % 4)
    raw = base64.urlsafe_b64decode(padded)
    return raw.hex()


@router.get("/health")
def health():
    """Simple liveness check."""
    return {"status": "ok", "service": "license-service"}


@router.post(
    "/keys",
    response_model=RegisterKeyResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_key(payload: RegisterKeyRequest, db: Session = Depends(get_db)):
    """
    Register a new KID/KEY pair for a video.
    Called by the backend Node worker after generating the encryption keys.
    """
    existing = db.query(ContentKey).filter(ContentKey.kid == payload.kid).first()
    if existing:
        # Idempotent: if the KID already exists, return it as-is
        return existing

    record = ContentKey(
        kid=payload.kid,
        key_hex=payload.key_hex,
        video_id=payload.video_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/keys/{kid}", response_model=ContentKeyInfo)
def get_key_info(kid: str, db: Session = Depends(get_db)):
    """
    Return metadata for a KID (without the secret key).
    Useful for debugging.
    """
    record = db.query(ContentKey).filter(ContentKey.kid == kid).first()
    if not record:
        raise HTTPException(status_code=404, detail="KID not found")
    return record

@router.get("/license/{kid_hex}")
def get_license_raw(kid_hex: str, db: Session = Depends(get_db)):
    """
    Endpoint para AES-128 whole-segment en HLS.
    El player hace GET con el KID como path param y espera 16 bytes crudos
    (la key en binario).
    """
    record = db.query(ContentKey).filter(ContentKey.kid == kid_hex).first()
    if not record:
        raise HTTPException(status_code=404, detail="KID not found")

    key_bytes = bytes.fromhex(record.key_hex)

    return Response(
        content=key_bytes,
        media_type="application/octet-stream",
        headers={
            "Access-Control-Allow-Origin": "*",
        },
    )

@router.post("/license", response_model=LicenseResponse)
def get_license(payload: LicenseRequest, db: Session = Depends(get_db)):
    """
    Return the decryption key(s) for the requested KID(s).
    Called by the browser via EME when the player detects encrypted content.

    The payload.kids are base64url-encoded. We convert to hex, look them up,
    and return the keys in W3C ClearKey format.
    """
    if not payload.kids:
        raise HTTPException(status_code=400, detail="No KIDs provided")

    entries = []
    for kid_b64 in payload.kids:
        try:
            kid_hex = _base64url_to_hex(kid_b64)
        except Exception:
            # Skip malformed KIDs
            continue

        record = db.query(ContentKey).filter(ContentKey.kid == kid_hex).first()
        if not record:
            continue

        entries.append(
            ClearKeyEntry(
                kty="oct",
                k=_hex_to_base64url(record.key_hex),
                kid=_hex_to_base64url(record.kid),
            )
        )

    if not entries:
        raise HTTPException(status_code=404, detail="No matching keys found")

    return LicenseResponse(keys=entries)