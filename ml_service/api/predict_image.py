"""CNN dropping image prediction logic."""

import io
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image

from .schemas import ImageResponse

IMG_SIZE = (224, 224)

# ── Disease severity lookup (CNN redesign spec) ────────────────────────────────
DISEASE_SEVERITY = {
    "healthy": {
        "severity": None,
        "severity_level": 0,
        "colour": "green",
        "interpretation": "Dropping appearance is normal. No signs of disease detected.",
        "action": "Continue routine monitoring. Run a full risk assessment weekly.",
    },
    "coccidiosis": {
        "severity": "Moderate",
        "severity_level": 2,
        "colour": "amber",
        "interpretation": (
            "Signs consistent with Coccidiosis detected. Caused by parasitic infection, "
            "common in wet conditions and overcrowded housing."
        ),
        "action": (
            "Administer anticoccidial medication. Review litter moisture and housing density. "
            "Consult your vet if mortality increases."
        ),
    },
    "salmonella": {
        "severity": "Moderate",
        "severity_level": 2,
        "colour": "amber",
        "interpretation": (
            "Signs consistent with Salmonella infection detected. Bacterial infection affecting "
            "the digestive tract. Zoonotic risk — handle birds with protective gear."
        ),
        "action": (
            "Isolate affected birds immediately. Review feed and water hygiene. "
            "Contact your vet for antibiotic guidance."
        ),
    },
    "ncd": {
        "severity": "Severe",
        "severity_level": 3,
        "colour": "red",
        "interpretation": (
            "Signs consistent with Newcastle Disease detected. "
            "Highly contagious viral infection — urgent action required."
        ),
        "action": (
            "Quarantine the flock immediately. Contact your vet today. "
            "Report to your state veterinary authority. Check vaccination records."
        ),
    },
}


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # (1, 224, 224, 3)


def predict_image(image_bytes: bytes, models: Dict[str, Any]) -> ImageResponse:
    cnn_model = models["cnn_model"]
    idx_to_display = models["idx_to_display"]  # {"0": "coccidiosis", ...}

    X = preprocess_image(image_bytes)
    preds = cnn_model.predict(X, verbose=0)[0]  # shape (4,)

    pred_idx = int(np.argmax(preds))
    confidence = float(preds[pred_idx])
    predicted_disease = idx_to_display[str(pred_idx)]

    info = DISEASE_SEVERITY[predicted_disease]

    return ImageResponse(
        predicted_disease=predicted_disease,
        confidence=round(confidence, 4),
        severity=info["severity"],
        severity_level=info["severity_level"],
        colour=info["colour"],
        interpretation=info["interpretation"],
        action=info["action"],
    )
