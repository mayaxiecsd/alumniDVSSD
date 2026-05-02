"""
Alumni Portal — Department of Vocational Studies & Skill Development
Manipur University
Backend: Flask + SQLite
"""

import os
import sqlite3
import hashlib
import secrets
import jwt
import json
import re
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, render_template_string

app = Flask(__name__, static_folder='static')

# ─── CONFIG ───────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))
DB_PATH    = os.path.join(os.path.dirname(__file__), 'alumni.db')
TOKEN_EXP  = 24  # hours

# ─── DATABASE SETUP ───────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS alumni (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name     TEXT    NOT NULL,
                email         TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                salt          TEXT    NOT NULL,
                roll_number   TEXT,
                batch_year    INTEGER,
                graduation_year INTEGER,
                program       TEXT,
                specialization TEXT,
                phone         TEXT,
                whatsapp      TEXT,
                current_job   TEXT,
                employer      TEXT,
                industry      TEXT,
                location_city TEXT,
                location_state TEXT,
                linkedin_url  TEXT,
                bio           TEXT,
                achievements  TEXT,
                photo_url     TEXT,
                is_verified   INTEGER DEFAULT 0,
                is_admin      INTEGER DEFAULT 0,
                created_at    TEXT    DEFAULT (datetime('now')),
                updated_at    TEXT    DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                alumni_id  INTEGER NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
                token_hash TEXT    NOT NULL,
                created_at TEXT    DEFAULT (datetime('now')),
                expires_at TEXT    NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                alumni_id  INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
                action     TEXT NOT NULL,
                ip_address TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_alumni_email ON alumni(email);
            CREATE INDEX IF NOT EXISTS idx_alumni_batch ON alumni(batch_year);
            CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
        """)

        # Create default admin if not exists
        admin_email = 'admin@manipuruniv.ac.in'
        existing = db.execute("SELECT id FROM alumni WHERE email=?", (admin_email,)).fetchone()
        if not existing:
            salt = secrets.token_hex(16)
            pw_hash = hash_password('Admin@1234', salt)
            db.execute("""
                INSERT INTO alumni (full_name, email, password_hash, salt, is_admin, is_verified)
                VALUES (?, ?, ?, ?, 1, 1)
            """, ('Administrator', admin_email, pw_hash, salt))
            db.commit()

# ─── SECURITY HELPERS ─────────────────────────────────────────────────────────
def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256', password.encode(), salt.encode(), 260000
    ).hex()

def verify_password(password: str, salt: str, stored_hash: str) -> bool:
    return secrets.compare_digest(hash_password(password, salt), stored_hash)

def make_token(alumni_id: int, is_admin: bool) -> str:
    payload = {
        'sub': alumni_id,
        'admin': is_admin,
        'exp': datetime.utcnow() + timedelta(hours=TOKEN_EXP),
        'iat': datetime.utcnow(),
        'jti': secrets.token_hex(8)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def validate_email(email: str) -> bool:
    return bool(re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email))

def validate_password(pw: str) -> tuple[bool, str]:
    if len(pw) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r'[A-Z]', pw):
        return False, "Password must contain an uppercase letter."
    if not re.search(r'\d', pw):
        return False, "Password must contain a number."
    return True, ""

def sanitize(value, max_len=255):
    if value is None:
        return None
    return str(value).strip()[:max_len]

# ─── AUTH DECORATOR ───────────────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        token = auth[7:]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Session expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        request.alumni_id = payload['sub']
        request.is_admin  = payload.get('admin', False)
        return f(*args, **kwargs)
    return wrapper

def require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not getattr(request, 'is_admin', False):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return require_auth(wrapper)

# ─── RATE LIMITING (simple in-memory) ────────────────────────────────────────
_rate = {}
def rate_limit(key, max_calls=5, window=60):
    now = datetime.utcnow().timestamp()
    calls = [t for t in _rate.get(key, []) if now - t < window]
    calls.append(now)
    _rate[key] = calls
    return len(calls) > max_calls

# ─── ROUTES ───────────────────────────────────────────────────────────────────

# Serve frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# ── AUTH ─────────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    ip   = request.remote_addr

    if rate_limit(f'reg:{ip}', max_calls=5, window=300):
        return jsonify({'error': 'Too many registration attempts. Please wait.'}), 429

    # Required fields
    full_name = sanitize(data.get('full_name'), 120)
    email     = sanitize(data.get('email'), 120)
    password  = data.get('password', '')

    if not full_name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required.'}), 400
    if not validate_email(email):
        return jsonify({'error': 'Invalid email address.'}), 400
    ok, msg = validate_password(password)
    if not ok:
        return jsonify({'error': msg}), 400

    salt = secrets.token_hex(16)
    pw_hash = hash_password(password, salt)

    with get_db() as db:
        existing = db.execute("SELECT id FROM alumni WHERE email=?", (email.lower(),)).fetchone()
        if existing:
            return jsonify({'error': 'An account with this email already exists.'}), 409

        cur = db.execute("""
            INSERT INTO alumni (full_name, email, password_hash, salt,
                roll_number, batch_year, graduation_year, program, specialization,
                phone, whatsapp, current_job, employer, industry,
                location_city, location_state, linkedin_url, bio, achievements)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            full_name, email.lower(), pw_hash, salt,
            sanitize(data.get('roll_number')),
            data.get('batch_year'),
            data.get('graduation_year'),
            sanitize(data.get('program')),
            sanitize(data.get('specialization')),
            sanitize(data.get('phone'), 20),
            sanitize(data.get('whatsapp'), 20),
            sanitize(data.get('current_job')),
            sanitize(data.get('employer')),
            sanitize(data.get('industry')),
            sanitize(data.get('location_city')),
            sanitize(data.get('location_state')),
            sanitize(data.get('linkedin_url')),
            sanitize(data.get('bio'), 1000),
            sanitize(data.get('achievements'), 1000),
        ))
        alumni_id = cur.lastrowid
        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (alumni_id, 'REGISTER', ip))
        db.commit()

    token = make_token(alumni_id, False)
    return jsonify({'message': 'Registration successful!', 'token': token, 'alumni_id': alumni_id}), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    ip   = request.remote_addr

    if rate_limit(f'login:{ip}', max_calls=10, window=300):
        return jsonify({'error': 'Too many login attempts. Please wait.'}), 429

    email    = sanitize(data.get('email', ''), 120).lower()
    password = data.get('password', '')

    with get_db() as db:
        row = db.execute("SELECT * FROM alumni WHERE email=?", (email,)).fetchone()
        if not row or not verify_password(password, row['salt'], row['password_hash']):
            return jsonify({'error': 'Invalid email or password.'}), 401

        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (row['id'], 'LOGIN', ip))
        db.commit()

    token = make_token(row['id'], bool(row['is_admin']))
    return jsonify({
        'token': token,
        'alumni_id': row['id'],
        'full_name': row['full_name'],
        'is_admin': bool(row['is_admin'])
    })


@app.route('/api/logout', methods=['POST'])
@require_auth
def logout():
    with get_db() as db:
        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (request.alumni_id, 'LOGOUT', request.remote_addr))
        db.commit()
    return jsonify({'message': 'Logged out.'})


# ── PROFILE ──────────────────────────────────────────────────────────────────
SAFE_FIELDS = [
    'full_name','roll_number','batch_year','graduation_year','program','specialization',
    'phone','whatsapp','current_job','employer','industry','location_city',
    'location_state','linkedin_url','bio','achievements','photo_url'
]

@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile():
    with get_db() as db:
        row = db.execute("SELECT * FROM alumni WHERE id=?", (request.alumni_id,)).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({k: row[k] for k in row.keys() if k not in ('password_hash','salt')})


@app.route('/api/profile', methods=['PUT'])
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    updates = {}
    for field in SAFE_FIELDS:
        if field in data:
            max_l = 1000 if field in ('bio','achievements') else 255
            updates[field] = sanitize(data[field], max_l)

    if not updates:
        return jsonify({'error': 'No valid fields to update.'}), 400

    updates['updated_at'] = datetime.utcnow().isoformat()
    set_clause = ', '.join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [request.alumni_id]

    with get_db() as db:
        db.execute(f"UPDATE alumni SET {set_clause} WHERE id=?", values)
        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (request.alumni_id, 'PROFILE_UPDATE', request.remote_addr))
        db.commit()

    return jsonify({'message': 'Profile updated successfully.'})


@app.route('/api/change-password', methods=['POST'])
@require_auth
def change_password():
    data = request.get_json(silent=True) or {}
    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    ok, msg = validate_password(new_pw)
    if not ok:
        return jsonify({'error': msg}), 400

    with get_db() as db:
        row = db.execute("SELECT * FROM alumni WHERE id=?", (request.alumni_id,)).fetchone()
        if not verify_password(old_pw, row['salt'], row['password_hash']):
            return jsonify({'error': 'Current password is incorrect.'}), 401

        new_salt = secrets.token_hex(16)
        new_hash = hash_password(new_pw, new_salt)
        db.execute("UPDATE alumni SET password_hash=?, salt=?, updated_at=? WHERE id=?",
                   (new_hash, new_salt, datetime.utcnow().isoformat(), request.alumni_id))
        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (request.alumni_id, 'PASSWORD_CHANGE', request.remote_addr))
        db.commit()

    return jsonify({'message': 'Password changed successfully.'})


# ── ALUMNI DIRECTORY (public listing, limited fields) ─────────────────────────
@app.route('/api/alumni', methods=['GET'])
@require_auth
def list_alumni():
    batch  = request.args.get('batch')
    search = request.args.get('q', '').strip()
    page   = max(1, int(request.args.get('page', 1)))
    limit  = 20
    offset = (page - 1) * limit

    query  = """
        SELECT id, full_name, batch_year, graduation_year, program, specialization,
               current_job, employer, industry, location_city, location_state,
               linkedin_url, bio, photo_url
        FROM alumni WHERE is_admin=0
    """
    params = []

    if batch:
        query += " AND batch_year=?"
        params.append(batch)
    if search:
        query += " AND (full_name LIKE ? OR current_job LIKE ? OR employer LIKE ? OR program LIKE ?)"
        like = f'%{search}%'
        params.extend([like, like, like, like])

    query += " ORDER BY batch_year DESC, full_name ASC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_db() as db:
        rows  = db.execute(query, params).fetchall()
        total = db.execute("SELECT COUNT(*) FROM alumni WHERE is_admin=0").fetchone()[0]

    return jsonify({
        'alumni': [dict(r) for r in rows],
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    })


# ── ADMIN ROUTES ──────────────────────────────────────────────────────────────
@app.route('/api/admin/alumni', methods=['GET'])
@require_admin
def admin_list_alumni():
    with get_db() as db:
        rows = db.execute(
            "SELECT id, full_name, email, roll_number, batch_year, program, is_verified, created_at FROM alumni WHERE is_admin=0 ORDER BY created_at DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/admin/alumni/<int:aid>/verify', methods=['POST'])
@require_admin
def admin_verify(aid):
    with get_db() as db:
        db.execute("UPDATE alumni SET is_verified=1 WHERE id=?", (aid,))
        db.execute("INSERT INTO audit_log (alumni_id, action, ip_address) VALUES (?,?,?)",
                   (aid, 'ADMIN_VERIFY', request.remote_addr))
        db.commit()
    return jsonify({'message': 'Alumni verified.'})


@app.route('/api/admin/alumni/<int:aid>', methods=['DELETE'])
@require_admin
def admin_delete(aid):
    with get_db() as db:
        db.execute("DELETE FROM alumni WHERE id=? AND is_admin=0", (aid,))
        db.commit()
    return jsonify({'message': 'Alumni deleted.'})


@app.route('/api/admin/stats', methods=['GET'])
@require_admin
def admin_stats():
    with get_db() as db:
        total       = db.execute("SELECT COUNT(*) FROM alumni WHERE is_admin=0").fetchone()[0]
        verified    = db.execute("SELECT COUNT(*) FROM alumni WHERE is_admin=0 AND is_verified=1").fetchone()[0]
        by_batch    = db.execute("SELECT batch_year, COUNT(*) as count FROM alumni WHERE is_admin=0 AND batch_year IS NOT NULL GROUP BY batch_year ORDER BY batch_year").fetchall()
        by_program  = db.execute("SELECT program, COUNT(*) as count FROM alumni WHERE is_admin=0 AND program IS NOT NULL GROUP BY program").fetchall()
        recent      = db.execute("SELECT full_name, email, created_at FROM alumni WHERE is_admin=0 ORDER BY created_at DESC LIMIT 5").fetchall()
    return jsonify({
        'total': total,
        'verified': verified,
        'by_batch': [dict(r) for r in by_batch],
        'by_program': [dict(r) for r in by_program],
        'recent': [dict(r) for r in recent],
    })


# ─── STARTUP ──────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print("=" * 60)
    print("  Alumni Portal — Manipur University")
    print("  Running at: http://localhost:5000")
    print("  Admin:  admin@manipuruniv.ac.in / Admin@1234")
    print("=" * 60)
    app.run(debug=True, port=5000)
