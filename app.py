import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes import auth_routes, notes_routes

# Initialize database tables on application startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Secure Notes API",
    description="Flat, production-ready full-stack REST API with JWT security and multi-tenant isolation.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API route modules
app.include_router(auth_routes.router)
app.include_router(notes_routes.router)

# Mount static frontend assets at root
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
