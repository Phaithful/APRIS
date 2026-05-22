"""
APRIS ML Microservice — FastAPI Application
Serves XGBoost risk predictions and CNN image classification.
Runs on port 8000. Internal use only (called by Node.js backend).
"""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict

import joblib
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .predict_image import predict_image
from .predict_risk import predict_risk
from .schemas import HealthResponse, ImageResponse, RiskRequest, RiskResponse

SAVE_DIR = Path(__file__).parent.parent / "models" / "saved"

# Global model store
_models: Dict[str, Any] = {}


def load_models():
    """Load all model artefacts at startup."""
    print("Loading XGBoost models...")
    _models["risk_model"] = joblib.load(SAVE_DIR / "xgboost_risk_v2.pkl")
    _models["disease_model"] = joblib.load(SAVE_DIR / "xgboost_disease_v2.pkl")
    _models["scaler"] = joblib.load(SAVE_DIR / "scaler_v2.pkl")
    _models["encoders"] = joblib.load(SAVE_DIR / "encoders_v2.pkl")

    with open(SAVE_DIR / "model_meta_v2.json") as f:
        _models["meta"] = json.load(f)

    # Accept either the final saved model or the best checkpoint saved during training
    cnn_path = next(
        (p for p in [
            SAVE_DIR / "cnn_model_v1.h5",
            SAVE_DIR / "cnn_best.keras",
        ] if p.exists()),
        None,
    )
    ci_path = SAVE_DIR / "class_indices_v1.json"
    if cnn_path and ci_path.exists():
        print(f"Loading CNN model from {cnn_path.name}...")
        import tensorflow as tf  # noqa: F401
        import keras

        # Keras 3 removed `renorm` from BatchNormalization, but MobileNetV2
        # checkpoints still contain it in their config. Patch from_config so
        # those keys are silently stripped before the layer is constructed.
        _orig_bn_from_config = keras.layers.BatchNormalization.from_config

        @classmethod  # type: ignore[misc]
        def _compat_bn_from_config(cls, config):
            config.pop("renorm", None)
            config.pop("renorm_clipping", None)
            config.pop("renorm_momentum", None)
            return _orig_bn_from_config.__func__(cls, config)

        keras.layers.BatchNormalization.from_config = _compat_bn_from_config

        try:
            _models["cnn_model"] = tf.keras.models.load_model(
                str(cnn_path), compile=False
            )
        finally:
            # Always restore original method
            keras.layers.BatchNormalization.from_config = _orig_bn_from_config

        with open(ci_path) as f:
            ci = json.load(f)
        _models["idx_to_display"] = ci["idx_to_display"]
        print("CNN model loaded.")
    else:
        print("WARNING: CNN model files not found — image analysis will be unavailable until training completes.")

    print("All models loaded successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield
    _models.clear()


app = FastAPI(
    title="APR" \
    "\IS ML Microservice",
    description="XGBoost risk prediction and CNN dropping image classification",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("BACKEND_ORIGIN", "http://localhost:3001"),
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        models={
            "xgboost": "risk_model" in _models and "disease_model" in _models,
            "cnn": "cnn_model" in _models,
        },
    )


@app.post("/predict/risk", response_model=RiskResponse)
async def risk_endpoint(req: RiskRequest):
    if "risk_model" not in _models:
        raise HTTPException(status_code=503, detail="XGBoost models not loaded")
    try:
        return predict_risk(req, _models)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/image", response_model=ImageResponse)
async def image_endpoint(file: UploadFile = File(...)):
    if "cnn_model" not in _models:
        raise HTTPException(status_code=503, detail="CNN model not loaded")

    # Validate MIME type
    allowed = {"image/jpeg", "image/jpg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Only JPEG and PNG are accepted.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB hard cap
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    try:
        return predict_image(image_bytes, _models)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
