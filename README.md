# VaultNotes — Enterprise-Lite Secure Note-Taking Application

VaultNotes is a full-stack note-taking application built with **FastAPI** and **Vanilla JavaScript** (with Tailwind CSS), organized in a clean, flat root-level module structure.

---

## File Architecture

```
notebook/
├── app.py                # Application factory, CORS middleware, router registration, & static file serving
├── database.py           # SQLAlchemy engine, SessionLocal, & get_db dependency
├── models.py             # User and Note ORM models with relational isolation
├── schemas.py            # Pydantic schemas for data validation and payload transfer
├── auth.py               # Password hashing (bcrypt), JWT encoding/decoding, & current_user dependency
├── routes/
│   ├── __init__.py
│   ├── auth_routes.py    # Signup (/api/auth/signup), login, and profile endpoints
│   └── notes_routes.py   # CRUD notes endpoints with strict tenant isolation
├── static/
│   ├── index.html        # Single Page Application HTML layout
│   ├── script.css        # Custom animations and scrollbar styles
│   └── script.js         # Frontend controller, API service, & reactive UI state manager
├── requirements.txt      # Python dependencies
└── README.md             # Project setup and documentation
```

---

## Security & Data Isolation

- **Authentication:** Stateless JWT tokens using `HS256` encryption and `bcrypt` salted password hashing.
- **Tenant Isolation:** All CRUD operations inside `routes/notes_routes.py` query the database explicitly filtering by `Note.owner_id == current_user.id`. Users cannot access, modify, or delete notes belonging to other user accounts.

---

## Setup & Running Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the Server

```bash
uvicorn app:app --reload --port 8000
```

### 3. Open in Browser

- **Web Application:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
