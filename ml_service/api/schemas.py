"""Pydantic request/response schemas for the APRIS ML microservice."""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Risk Prediction ────────────────────────────────────────────────────────────

class RiskRequest(BaseModel):
    temperature_c: float = Field(..., ge=18, le=42)
    humidity_pct: float = Field(..., ge=30, le=95)
    rainfall_mm: float = Field(..., ge=0, le=200)
    season: str = Field(..., pattern="^(dry|wet|harmattan)$")
    region: str = Field(..., pattern="^(north|south_west|south_east|south_south)$")
    flock_age_weeks: int = Field(..., ge=1, le=72)
    flock_size: int = Field(..., ge=1, le=1_000_000)
    housing_type: str = Field(..., pattern="^(open_sided|closed|battery_cage)$")
    vaccinated: int = Field(..., ge=0, le=1)
    nearby_outbreak: int = Field(..., ge=0, le=1)
    wild_bird_proximity: int = Field(..., ge=0, le=1)
    mortality_rate_pct: float = Field(..., ge=0, le=100)
    feed_intake_pct: float = Field(..., ge=0, le=100)


class DiseasePrediction(BaseModel):
    disease_name: str
    probability: float
    severity: str
    rank: int


class MitigationAction(BaseModel):
    action: str
    urgency_rank: int
    category: str
    disease_ref: str


class RiskResponse(BaseModel):
    risk_level: str
    risk_score: int
    diseases: List[DiseasePrediction]
    mitigations: List[MitigationAction]
    model_version: str = "v1"


# ── Image Prediction ───────────────────────────────────────────────────────────

class ImageResponse(BaseModel):
    predicted_disease: str
    confidence: float
    severity: Optional[str]
    severity_level: int
    colour: str
    interpretation: str
    action: str
    model_version: str = "v1"


# ── Health ─────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    models: dict
