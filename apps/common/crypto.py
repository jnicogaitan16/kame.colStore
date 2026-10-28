"""
Field-level encryption utilities for PII data.

Uses Fernet (AES-128-CBC + HMAC-SHA256) for encryption and HMAC-SHA256 for
blind indexes that allow lookups without decrypting.

Requires env var FIELD_ENCRYPTION_KEY (base64-encoded 32-byte key).
Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import hashlib
import hmac
import os

from cryptography.fernet import Fernet, InvalidToken

_ENCRYPTION_KEY = os.getenv("FIELD_ENCRYPTION_KEY", "")


def _get_fernet() -> Fernet | None:
    if not _ENCRYPTION_KEY:
        return None
    return Fernet(_ENCRYPTION_KEY.encode())


def encrypt_value(plaintext: str) -> str:
    """Encrypt a string. Returns the plaintext unchanged if no key is configured."""
    f = _get_fernet()
    if f is None:
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a string. Returns the ciphertext unchanged if decryption fails or no key is configured."""
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        # If decryption fails, the value is likely already plaintext (pre-migration data)
        return ciphertext


def make_blind_index(value: str) -> str:
    """Create a deterministic HMAC-SHA256 hash for lookups. Uses the encryption key as HMAC key."""
    key = _ENCRYPTION_KEY.encode() if _ENCRYPTION_KEY else b"default-hmac-key"
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()
