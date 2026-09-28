from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes import router




app = FastAPI(
    title="License Service",
    description="ClearKey license server for the video streaming service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:5173"],
    # allow_credentials=True, 
    allow_origins=["*"],  # temporal para test
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "license-service",
        "docs": "/docs",
        "health": "/api/health",
    }