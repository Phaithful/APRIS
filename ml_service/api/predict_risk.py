"""XGBoost risk prediction logic."""

import json
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd

from .schemas import DiseasePrediction, MitigationAction, RiskRequest, RiskResponse

SAVE_DIR = Path(__file__).parent.parent / "models" / "saved"

# ── Disease severity lookup ────────────────────────────────────────────────────
DISEASE_SEVERITY = {
    "Avian Influenza": "critical",
    "Newcastle Disease": "high",
    "Gumboro Disease": "high",
    "Marek's Disease": "moderate",
    "Infectious Bronchitis": "moderate",
    "Fowl Typhoid": "high",
    "Coccidiosis": "moderate",
    "Heat Stress Syndrome": "high",
    "Fowl Pox": "low",
}

# ── Mitigation lookup: (disease, risk_level) → actions ────────────────────────
MITIGATIONS: Dict[str, list] = {
    "Avian Influenza": [
        {"action": "Quarantine the flock immediately and restrict farm access.", "category": "biosecurity", "urgency_rank": 1},
        {"action": "Report suspected Avian Influenza to your state veterinary authority.", "category": "vet_alert", "urgency_rank": 2},
        {"action": "Remove wild bird access points: net open-sided areas, cover water troughs.", "category": "biosecurity", "urgency_rank": 3},
        {"action": "Disinfect all equipment and footwear with approved virucidal disinfectant.", "category": "biosecurity", "urgency_rank": 4},
        {"action": "Do not move birds, eggs, or feed off-farm until cleared by authorities.", "category": "biosecurity", "urgency_rank": 5},
    ],
    "Newcastle Disease": [
        {"action": "Vaccinate all unvaccinated birds immediately with Newcastle Disease vaccine.", "category": "treatment", "urgency_rank": 1},
        {"action": "Isolate symptomatic birds in a separate pen with reduced stocking density.", "category": "biosecurity", "urgency_rank": 2},
        {"action": "Increase ventilation and reduce humidity in the poultry house.", "category": "environment", "urgency_rank": 3},
        {"action": "Contact your vet for anti-secondary infection medication.", "category": "vet_alert", "urgency_rank": 4},
        {"action": "Boost feed with vitamins A, C, and E to support immune response.", "category": "nutrition", "urgency_rank": 5},
    ],
    "Gumboro Disease": [
        {"action": "Administer Gumboro (IBD) vaccine booster if birds are 3–6 weeks old.", "category": "treatment", "urgency_rank": 1},
        {"action": "Reduce stocking density by 15–20% to lower stress.", "category": "environment", "urgency_rank": 2},
        {"action": "Disinfect drinkers and feeders daily with iodine-based disinfectant.", "category": "biosecurity", "urgency_rank": 3},
        {"action": "Provide oral rehydration salts in drinking water.", "category": "treatment", "urgency_rank": 4},
    ],
    "Marek's Disease": [
        {"action": "Ensure all new chicks are vaccinated at hatch (Marek's vaccine).", "category": "treatment", "urgency_rank": 1},
        {"action": "Review biosecurity: Marek's spreads via feather dander — improve ventilation filtration.", "category": "biosecurity", "urgency_rank": 2},
        {"action": "Cull severely affected birds to prevent spread.", "category": "biosecurity", "urgency_rank": 3},
    ],
    "Infectious Bronchitis": [
        {"action": "Increase house temperature by 2°C to reduce cold stress on the respiratory tract.", "category": "environment", "urgency_rank": 1},
        {"action": "Administer IB vaccine if birds are unvaccinated.", "category": "treatment", "urgency_rank": 2},
        {"action": "Add electrolytes and vitamins to drinking water.", "category": "nutrition", "urgency_rank": 3},
        {"action": "Contact your vet if egg production drops or breathing distress is observed.", "category": "vet_alert", "urgency_rank": 4},
    ],
    "Fowl Typhoid": [
        {"action": "Collect mortality samples for lab confirmation before treating.", "category": "vet_alert", "urgency_rank": 1},
        {"action": "Administer antibiotics (enrofloxacin or sulphonamides) under vet guidance.", "category": "treatment", "urgency_rank": 2},
        {"action": "Sanitise water supply: flush and chlorinate all drinkers.", "category": "biosecurity", "urgency_rank": 3},
        {"action": "Review feed storage for contamination sources.", "category": "biosecurity", "urgency_rank": 4},
    ],
    "Coccidiosis": [
        {"action": "Administer anticoccidial medication (amprolium or toltrazuril) in water.", "category": "treatment", "urgency_rank": 1},
        {"action": "Improve litter management: remove wet litter and replace with dry material.", "category": "environment", "urgency_rank": 2},
        {"action": "Reduce stocking density to lower exposure pressure.", "category": "environment", "urgency_rank": 3},
        {"action": "Boost nutrition with vitamins A and K to aid gut recovery.", "category": "nutrition", "urgency_rank": 4},
    ],
    "Heat Stress Syndrome": [
        {"action": "Install or increase evaporative cooling or fans immediately.", "category": "environment", "urgency_rank": 1},
        {"action": "Provide cool, clean water at all times — change every 2 hours during peak heat.", "category": "environment", "urgency_rank": 2},
        {"action": "Feed birds during cooler parts of the day (early morning and evening).", "category": "nutrition", "urgency_rank": 3},
        {"action": "Reduce stocking density by opening additional ventilation panels.", "category": "environment", "urgency_rank": 4},
        {"action": "Add electrolytes (sodium bicarbonate) to drinking water.", "category": "nutrition", "urgency_rank": 5},
    ],
    "Fowl Pox": [
        {"action": "Vaccinate unaffected birds with fowl pox vaccine immediately.", "category": "treatment", "urgency_rank": 1},
        {"action": "Control mosquitoes and biting insects — primary transmission vector.", "category": "biosecurity", "urgency_rank": 2},
        {"action": "Apply iodine solution to skin lesions on affected birds.", "category": "treatment", "urgency_rank": 3},
        {"action": "Isolate birds with wet form (diphtheritic) lesions.", "category": "biosecurity", "urgency_rank": 4},
    ],
}

# Risk score mapping
RISK_SCORE_RANGES = {
    "low": (5, 35),
    "medium": (36, 60),
    "high": (61, 80),
    "critical": (81, 99),
}


def _risk_score_from_proba(risk_level: str, proba: np.ndarray, class_idx: int) -> int:
    """Convert class probability to a risk score within the level's range."""
    lo, hi = RISK_SCORE_RANGES[risk_level]
    confidence = float(proba[class_idx])
    score = int(lo + confidence * (hi - lo))
    return min(max(score, lo), hi)


def build_feature_vector(req: RiskRequest, meta: dict) -> pd.DataFrame:
    """Convert RiskRequest to the same feature layout used during training."""
    row = {
        "temperature_c": req.temperature_c,
        "humidity_pct": req.humidity_pct,
        "rainfall_mm": req.rainfall_mm,
        "flock_age_weeks": req.flock_age_weeks,
        "flock_size": req.flock_size,
        "vaccinated": req.vaccinated,
        "nearby_outbreak": req.nearby_outbreak,
        "wild_bird_proximity": req.wild_bird_proximity,
        "mortality_rate_pct": req.mortality_rate_pct,
        "feed_intake_pct": req.feed_intake_pct,
    }

    # One-hot encode nominals to match training columns
    for col in meta["categorical_nominal"]:
        val = getattr(req, col)
        col_name = f"{col}_{val}"
        for possible in _possible_values(col):
            row[f"{col}_{possible}"] = 1 if possible == val else 0

    df = pd.DataFrame([row])
    # Ensure all expected columns are present (in correct order)
    for col in meta["feature_names"]:
        if col not in df.columns:
            df[col] = 0
    return df[meta["feature_names"]]


def _possible_values(col: str):
    mapping = {
        "season": ["dry", "wet", "harmattan"],
        "region": ["north", "south_west", "south_east", "south_south"],
        "housing_type": ["open_sided", "closed", "battery_cage"],
    }
    return mapping.get(col, [])


def predict_risk(req: RiskRequest, models: Dict[str, Any]) -> RiskResponse:
    risk_model = models["risk_model"]
    disease_model = models["disease_model"]
    scaler = models["scaler"]
    encoders = models["encoders"]
    meta = models["meta"]

    X = build_feature_vector(req, meta)

    # Scale numeric columns
    numeric_cols = meta["numeric_cols"]
    X[numeric_cols] = scaler.transform(X[numeric_cols])

    # ── Risk level prediction ──
    risk_proba = risk_model.predict_proba(X)[0]
    risk_pred_idx = int(np.argmax(risk_proba))
    risk_le = encoders["risk_le"]
    risk_level = risk_le.inverse_transform([risk_pred_idx])[0]
    risk_score = _risk_score_from_proba(risk_level, risk_proba, risk_pred_idx)

    # ── Disease top-3 prediction ──
    disease_proba = disease_model.predict_proba(X)[0]
    disease_le = encoders["disease_le"]
    top3_idx = np.argsort(disease_proba)[::-1][:3]
    diseases = []
    for rank, idx in enumerate(top3_idx, start=1):
        disease_name = disease_le.inverse_transform([idx])[0]
        prob = float(disease_proba[idx])
        severity = DISEASE_SEVERITY.get(disease_name, "moderate")
        diseases.append(DiseasePrediction(
            disease_name=disease_name,
            probability=round(prob, 4),
            severity=severity,
            rank=rank,
        ))

    # ── Mitigation actions ──
    # Focused on the most likely disease. Secondary disease gets a small supplement
    # only for high/critical risk, and only for categories not already covered.
    # Hard cap: never more than 7 total.
    #
    # Allocation by risk level:
    #   low      → 3 from primary
    #   medium   → 4 from primary
    #   high     → 5 from primary + up to 2 from secondary (different categories)
    #   critical → 6 from primary + up to 1 from secondary (different categories)
    MAX_PRIMARY     = {"low": 3, "medium": 4, "high": 5, "critical": 6}
    MAX_SUPPLEMENTAL = {"high": 2, "critical": 1}
    HARD_CAP = 7

    mitigations = []
    seen_actions   = set()   # deduplicate by exact action text
    seen_categories = set()  # used to avoid redundant supplemental actions

    top_disease = diseases[0] if diseases else None
    if top_disease:
        limit = MAX_PRIMARY.get(risk_level, 4)
        for action_data in MITIGATIONS.get(top_disease.disease_name, [])[:limit]:
            if action_data["action"] not in seen_actions:
                mitigations.append(MitigationAction(
                    action=action_data["action"],
                    urgency_rank=action_data["urgency_rank"],
                    category=action_data["category"],
                    disease_ref=top_disease.disease_name,
                ))
                seen_actions.add(action_data["action"])
                seen_categories.add(action_data["category"])

    if risk_level in ("high", "critical") and len(diseases) > 1:
        second_disease = diseases[1]
        max_supp = MAX_SUPPLEMENTAL.get(risk_level, 1)
        added = 0
        for action_data in MITIGATIONS.get(second_disease.disease_name, []):
            if added >= max_supp:
                break
            if (action_data["category"] not in seen_categories
                    and action_data["action"] not in seen_actions):
                mitigations.append(MitigationAction(
                    action=action_data["action"],
                    urgency_rank=action_data["urgency_rank"],
                    category=action_data["category"],
                    disease_ref=second_disease.disease_name,
                ))
                seen_actions.add(action_data["action"])
                added += 1

    mitigations.sort(key=lambda m: m.urgency_rank)
    mitigations = mitigations[:HARD_CAP]

    return RiskResponse(
        risk_level=risk_level,
        risk_score=risk_score,
        diseases=diseases,
        mitigations=mitigations,
    )
