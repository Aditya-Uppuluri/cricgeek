from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).resolve().parent.parent
AI_SERVICE_DIR = ROOT_DIR / "ai_service"

for path in (ROOT_DIR, AI_SERVICE_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from ai_service.t20_api import router as t20_router
from ai_service.t20_insights import T20InsightsUnavailable, get_metadata

app = FastAPI(
    title="CricGeek T20 Insights Service",
    description="Lightweight deployed service for capstone T20 advisor, evaluation, and player explorer routes.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://cricgeek.vercel.app",
        "https://cricgeek.in",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(t20_router)


@app.get("/health")
async def health() -> dict[str, object]:
    try:
        metadata = get_metadata()
        return {
            "status": "ok",
            "service": "t20-insights",
            "players": metadata.get("playerCount", 0),
            "teams": metadata.get("teamCount", 0),
            "artifacts": metadata.get("artifactStatus", {}),
        }
    except T20InsightsUnavailable as exc:
        return {
            "status": "degraded",
            "service": "t20-insights",
            "error": str(exc),
        }
    except Exception as exc:
        return {
            "status": "degraded",
            "service": "t20-insights",
            "error": f"Unexpected insights health error: {exc}",
        }
