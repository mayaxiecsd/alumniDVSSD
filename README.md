# 🎓 Alumni Portal
## Department of Vocational Studies & Skill Development
### Manipur University

A full-stack, production-ready alumni portal with secure authentication, profile management, and an alumni directory.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Registration** | Full multi-step form — personal, academic, professional info |
| **Secure Login** | PBKDF2-SHA256 password hashing (260,000 iterations), JWT sessions |
| **Profile Management** | Alumni can edit all their own details, change password |
| **Alumni Directory** | Browse all alumni with search and batch-year filter |
| **Admin Dashboard** | Verify/delete alumni, view stats |
| **Rate Limiting** | Protects login and registration endpoints |
| **Audit Log** | All actions are logged with timestamps and IP |
| **SQLite Database** | Lightweight, file-based, production-appropriate for small institutions |

---

## 🗂 Project Structure

```
alumni-portal/
├── app.py               ← Flask backend (API + security)
├── requirements.txt     ← Python dependencies
├── alumni.db            ← SQLite database (auto-created on first run)
├── static/
│   ├── index.html       ← Single-page frontend
│   ├── style.css        ← Styles (warm academic aesthetic)
│   └── app.js           ← Frontend logic
└── README.md
```

---

## 🚀 Running Locally

### Prerequisites
- Python 3.9+
- pip

### Steps

```bash
# 1. Navigate to the project folder
cd alumni-portal

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the server
python app.py
```

Open your browser at **http://localhost:5000**

### Default Admin Account
```
Email:    admin@manipuruniv.ac.in
Password: Admin@1234
```
> ⚠️ Change this password immediately after first login via the Change Password section.

---

## 🌐 Deploying Online (Free Options)

### Option A — Render.com (Recommended)

1. Push this folder to a GitHub repository
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repository
4. Set these values:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`
   - **Environment**: Python 3
5. Add environment variable:
   - `SECRET_KEY` = (any long random string, e.g. from `python -c "import secrets; print(secrets.token_hex(32))"`)
6. Click **Deploy**

### Option B — Railway.app

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Set environment variable: `SECRET_KEY=<your-secret>`
5. Railway auto-detects Python and deploys

### Option C — PythonAnywhere (Free tier)

1. Create an account at [pythonanywhere.com](https://pythonanywhere.com)
2. Upload your files
3. Create a Web App → Flask → point to `app.py`
4. Install requirements in the Bash console

---

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| Password hashing | PBKDF2-HMAC-SHA256, 260,000 iterations + random salt |
| JWT tokens | HS256 signed, 24-hour expiry |
| Rate limiting | 10 login attempts / 5 registration attempts per 5 min |
| SQL injection | Parameterized queries throughout |
| XSS protection | Frontend HTML escaping on all user content |
| Audit logging | Every login, logout, update logged with IP |
| Input sanitization | All user input stripped and length-limited server-side |

---

## 🔧 Configuration

Edit these in `app.py` or set as environment variables:

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | Random (changes on restart) | **Set this in production!** |
| `TOKEN_EXP` | 24 | JWT expiry in hours |

> ⚠️ **Always set `SECRET_KEY` as a fixed environment variable in production** — otherwise all sessions will be invalidated every time the server restarts.

---

## 📦 Upgrading to PostgreSQL (for larger deployments)

Replace SQLite with PostgreSQL by:
1. `pip install psycopg2-binary`
2. In `app.py`, replace `sqlite3.connect(DB_PATH)` with a psycopg2 connection
3. Update placeholder syntax from `?` to `%s`
4. Set `DATABASE_URL` environment variable

---

## 📄 License

Free for educational and institutional use.
