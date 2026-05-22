"""
APRIS — XGBoost Training Pipeline v2
Trains two models:
  Model A: risk_level classifier (low / medium / high / critical)
  Model B: disease_label classifier (9 diseases) for top-3 probability ranking

Fixes vs v1:
  - Single train/test split shared by both models (eliminates X/y misalignment)
  - sample_weight='balanced' for both models
  - GridSearchCV for disease model too
  - Noise covers all numeric features in the dataset generator
"""

import json
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

DATA_PATH = Path(__file__).parent.parent / "data" / "poultry_dataset.csv"
SAVE_DIR = Path(__file__).parent / "saved"
SAVE_DIR.mkdir(exist_ok=True)

CATEGORICAL_NOMINAL = ["season", "region", "housing_type"]
NUMERIC_COLS = [
    "temperature_c", "humidity_pct", "rainfall_mm",
    "flock_age_weeks", "flock_size",
    "vaccinated", "nearby_outbreak", "wild_bird_proximity",
    "mortality_rate_pct", "feed_intake_pct",
]

PARAM_GRID = {
    "max_depth": [4, 5, 6],
    "n_estimators": [200, 300],
    "learning_rate": [0.05, 0.1],
}


def load_and_preprocess(df):
    dummies = pd.get_dummies(df[CATEGORICAL_NOMINAL], prefix=CATEGORICAL_NOMINAL)
    X = pd.concat([df[NUMERIC_COLS].reset_index(drop=True),
                   dummies.reset_index(drop=True)], axis=1)
    scaler = StandardScaler()
    X[NUMERIC_COLS] = scaler.fit_transform(X[NUMERIC_COLS])
    feature_names = list(X.columns)
    return X, scaler, feature_names


def train_model(X_train, y_train, X_test, y_test, label, report_lines):
    print(f"\n{'='*60}")
    print(f"Training: {label}")
    print(f"Classes: {sorted(set(y_train))}")

    le = LabelEncoder()
    y_train_enc = le.fit_transform(y_train)
    y_test_enc = le.transform(y_test)

    sample_weights = compute_sample_weight("balanced", y_train_enc)

    base_params = dict(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )

    print("Running GridSearchCV (5-fold)...")
    cv_model = GridSearchCV(
        XGBClassifier(**base_params),
        PARAM_GRID,
        cv=5,
        scoring="accuracy",
        n_jobs=-1,
        verbose=0,
    )
    cv_model.fit(X_train, y_train_enc, sample_weight=sample_weights)
    model = cv_model.best_estimator_
    print(f"Best params: {cv_model.best_params_}")

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test_enc, y_pred)
    report = classification_report(y_test_enc, y_pred, target_names=le.classes_)
    cm = confusion_matrix(y_test_enc, y_pred)

    print(f"Test accuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(report)
    print("Confusion Matrix:")
    print(cm)

    report_lines.append(f"\n{'='*60}")
    report_lines.append(f"{label}")
    report_lines.append(f"Best params: {cv_model.best_params_}")
    report_lines.append(f"Test accuracy: {acc:.4f}")
    report_lines.append("\nClassification Report:")
    report_lines.append(report)

    return model, le


if __name__ == "__main__":
    print(f"Loading dataset from {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} records")
    print("Risk distribution:", df["risk_level"].value_counts().to_dict())
    print("Disease distribution:", df["disease_label"].value_counts().to_dict())

    X, scaler, feature_names = load_and_preprocess(df)

    y_risk = df["risk_level"]
    y_disease = df["disease_label"]

    # Single split shared by both models — fixes X/y misalignment bug from v1
    (X_train, X_test,
     y_risk_train, y_risk_test,
     y_dis_train, y_dis_test) = train_test_split(
        X, y_risk, y_disease,
        test_size=0.2, stratify=y_risk, random_state=42
    )

    report_lines = [f"APRIS XGBoost Training Report v2", f"Dataset: {len(df)} records\n"]

    risk_model, risk_le = train_model(
        X_train, y_risk_train,
        X_test, y_risk_test,
        "Risk Level Classifier",
        report_lines,
    )

    disease_model, disease_le = train_model(
        X_train, y_dis_train,
        X_test, y_dis_test,
        "Disease Label Classifier",
        report_lines,
    )

    joblib.dump(risk_model, SAVE_DIR / "xgboost_risk_v2.pkl")
    joblib.dump(disease_model, SAVE_DIR / "xgboost_disease_v2.pkl")
    joblib.dump(scaler, SAVE_DIR / "scaler_v2.pkl")
    joblib.dump(
        {"risk_le": risk_le, "disease_le": disease_le},
        SAVE_DIR / "encoders_v2.pkl",
    )

    meta = {
        "feature_names": feature_names,
        "numeric_cols": NUMERIC_COLS,
        "categorical_nominal": CATEGORICAL_NOMINAL,
        "risk_classes": list(risk_le.classes_),
        "disease_classes": list(disease_le.classes_),
        "model_version": "v2",
    }
    with open(SAVE_DIR / "model_meta_v2.json", "w") as f:
        json.dump(meta, f, indent=2)

    report_path = SAVE_DIR / "training_report_v2.txt"
    with open(report_path, "w") as f:
        f.write("\n".join(report_lines))

    print(f"\nAll models and artefacts saved to {SAVE_DIR}")
    print(f"Training report saved to {report_path}")
