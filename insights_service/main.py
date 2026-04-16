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

REQUIRED_ARTIFACTS = (
    "aggregated_df.pkl",
    "bowling_over_df.pkl",
    "entries_with_perf.pkl",
    "eval_results.pkl",
    "filtered_df.pkl",
    "player_gender_map.pkl",
    "player_image_urls.json",
    "player_team_map.json",
    "team_players_map.json",
    "teams_list.pkl",
)

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


def _artifact_health() -> tuple[bool, dict[str, object]]:
    outputs_dir = ROOT_DIR / "capstone cric" / "outputs"
    files: dict[str, object] = {}
    missing: list[str] = []

    for filename in REQUIRED_ARTIFACTS:
        path = outputs_dir / filename
        exists = path.exists()
        if not exists:
            missing.append(filename)
            files[filename] = {"exists": False}
            continue

        files[filename] = {
            "exists": True,
            "sizeBytes": path.stat().st_size,
        }

    return len(missing) == 0, {
        "directory": str(outputs_dir),
        "missing": missing,
        "files": files,
    }


@app.get("/health")
async def health() -> dict[str, object]:
    artifacts_ok, artifact_report = _artifact_health()

    return {
        "status": "ok" if artifacts_ok else "degraded",
        "service": "t20-insights",
        "artifacts": artifact_report,
    }


@app.get("/health/deep")
async def health_deep() -> dict[str, object]:
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
