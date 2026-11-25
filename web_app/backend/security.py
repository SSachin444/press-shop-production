"""
Security, PBKDF2 password hashing, HMAC-signed session tokens, RBAC decorators,
and rate-limited email recovery helpers for PHA INDIA Press Shop System.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import smtplib
import time
from email.message import EmailMessage
from functools import wraps
from flask import request, jsonify, g

VALID_ROLES = ("Admin", "Supervisor", "Operator", "Dashboard")
SESSION_TTL_SECONDS = int(os.environ.get("PHA_SESSION_TTL_SECONDS", 8 * 3600))

# Runtime-ephemeral fallback secret if PHA_SESSION_SECRET env is not set
_RUNTIME_SECRET = os.environ.get("PHA_SESSION_SECRET") or secrets.token_hex(32)


def get_session_secret() -> bytes:
    secret = os.environ.get("PHA_SESSION_SECRET") or _RUNTIME_SECRET
    return secret.encode("utf-8")


def hash_password(password: str, salt: str | None = None) -> str:
    """Hash password with PBKDF2-HMAC-SHA256 and per-user random salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored PBKDF2 hash (constant-time)."""
    if not stored_hash or not password:
        return False
    if stored_hash.startswith("pbkdf2_sha256$"):
        parts = stored_hash.split("$", 2)
        if len(parts) != 3:
            return False
        _, salt, expected_hex = parts
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
        return hmac.compare_digest(dk.hex(), expected_hex)
    return False


def validate_strong_password(password: str) -> str | None:
    """Enforce strong password rules for Admin and Supervisor replacements."""
    if not password or len(password) < 10:
        return "Password must be at least 10 characters long."
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"[0-9]", password):
        return "Password must include uppercase, lowercase, and numeric characters."
    return None


def sign_session_token(payload: dict, ttl_seconds: int = SESSION_TTL_SECONDS) -> str:
    """Create an HMAC-SHA256 signed session token with explicit expiration."""
    now = int(time.time())
    body = {
        **payload,
        "iat": now,
        "exp": now + ttl_seconds,
        "jti": secrets.token_hex(12),
    }
    encoded = base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")
    sig = hmac.new(get_session_secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{sig}"


def verify_session_token(token: str) -> dict | None:
    """Verify HMAC signature and expiration of a session token."""
    if not token or "." not in token:
        return None
    try:
        encoded, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(get_session_secret(), encoded.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        padded = encoded + "=" * ((4 - len(encoded) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        if payload.get("role") not in VALID_ROLES:
            return None
        return payload
    except Exception:
        return None


def hash_recovery_code(user_id: int, code: str) -> str:
    msg = f"{user_id}:{code}".encode("utf-8")
    return hmac.new(get_session_secret(), msg, hashlib.sha256).hexdigest()


def generate_six_digit_code() -> str:
    return f"{100000 + secrets.randbelow(900000)}"


def extract_session_from_request(get_db_fn, revoked_tokens: set[str] | None = None):
    """Extract and validate signed session from HTTP-only cookie or Authorization header."""
    token = request.cookies.get("pha_session") or ""
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return None
    if revoked_tokens and token in revoked_tokens:
        return None

    payload = verify_session_token(token)
    if not payload:
        return None

    # For Admin & Supervisor, verify account is still active in DB
    if payload["role"] in ("Admin", "Supervisor"):
        conn = get_db_fn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, username, full_name, role, department, is_active, must_change_password, recovery_email, recovery_email_verified FROM users WHERE id = ?",
            (payload.get("uid"),),
        )
        row = cur.fetchone()
        conn.close()
        if not row or not row["is_active"] or row["role"] != payload["role"]:
            return None
        return {
            "uid": row["id"],
            "username": row["username"],
            "full_name": row["full_name"],
            "role": row["role"],
            "department": row["department"],
            "must_change_password": bool(row["must_change_password"]),
            "recovery_email": row["recovery_email"] or "",
            "recovery_email_verified": bool(row["recovery_email_verified"]),
            "exp": payload["exp"],
            "token": token,
        }

    return {
        "uid": None,
        "username": payload.get("username", payload["role"].lower()),
        "full_name": payload.get("full_name", payload["role"]),
        "role": payload["role"],
        "department": "Press Shop MFG-2",
        "must_change_password": False,
        "exp": payload["exp"],
        "token": token,
    }


def require_roles(*allowed_roles, get_db_fn=None, revoked_tokens=None, allow_pending_password_change=False):
    """Decorator enforcing server-side role authentication & authorization."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = extract_session_from_request(get_db_fn, revoked_tokens)
            if not user:
                return jsonify({"error": "Authentication required or session expired."}), 401
            if user.get("must_change_password") and not allow_pending_password_change:
                return jsonify({"error": "Password replacement required before accessing application resources.", "must_change_password": True}), 403
            if user["role"] not in allowed_roles:
                return jsonify({"error": "Forbidden: insufficient role permissions."}), 403
            g.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def send_smtp_email(to_email: str, subject: str, body_text: str) -> tuple[bool, str]:
    """Send transactional recovery/verification emails when SMTP env vars are configured."""
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "").strip()
    smtp_pass = os.environ.get("SMTP_PASS", "").strip()
    from_addr = os.environ.get("RECOVERY_FROM_EMAIL", smtp_user).strip()

    if not smtp_host or not from_addr:
        return False, "Email delivery provider (SMTP_HOST / RECOVERY_FROM_EMAIL) is not configured."

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.set_content(body_text)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return True, "sent"
    except Exception as exc:
        return False, str(exc)
