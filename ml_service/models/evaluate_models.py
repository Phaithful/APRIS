"""
APRIS — Model Evaluation Script
================================
Evaluates the XGBoost risk-level classifier and CNN MobileNetV2 image
classifier, producing publication-ready plots and classification reports.

Usage:
    python evaluate_models.py          (from ml_service/models/)
    python ml_service/models/evaluate_models.py  (from project root)
"""

# =============================================================================
# SECTION 1: Imports and Global Configuration
# =============================================================================

import json
import sys
import warnings
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")  # Non-interactive backend — must be set before pyplot import
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import label_binarize

warnings.filterwarnings("ignore")

# --- Directory layout (all relative to this file) ---
SCRIPT_DIR = Path(__file__).resolve().parent
SAVED_DIR  = SCRIPT_DIR / "saved"
DATA_DIR   = SCRIPT_DIR.parent / "data"
IMAGES_DIR = DATA_DIR / "images"
OUTPUT_DIR = SCRIPT_DIR / "evaluation_outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# --- Visual constants ---
PRIMARY_COLOR = "#2E7D52"                               # Dark green for single-colour plots
CLASS_COLORS  = ["#2E7D52", "#1565C0", "#C62828", "#F57F17"]  # Up to 4 classes
DPI           = 150                                     # Minimum DPI for all saved figures


# =============================================================================
# SECTION 2: Shared Utilities
# =============================================================================

def find_file(*candidates):
    """Return the first Path from *candidates that exists on disk, or None."""
    for path in candidates:
        if Path(path).exists():
            return Path(path)
    return None


def save_report(text, path):
    """Write a plain-text evaluation report to *path* and print confirmation."""
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    print(f"    Saved: {path}")


# =============================================================================
# SECTION 3: XGBoost Evaluation
# =============================================================================

def evaluate_xgboost():
    """
    Load the saved XGBoost risk-level classifier, reproduce the 80/20
    training split, and generate evaluation artefacts:

      1. Normalised confusion matrix (heatmap)
      2. Multiclass ROC curves — One-vs-Rest, one curve per risk class
      3. Classification report — console + .txt
      4. Top-13 feature importance horizontal bar chart

    Returns a result dict, or None if a required artefact is missing.
    """
    print("\n" + "=" * 65)
    print("  XGBOOST MODEL EVALUATION")
    print("=" * 65)

    # --- Locate model artefacts (prefer v2, fall back to v1) ---
    risk_path     = find_file(SAVED_DIR / "xgboost_risk_v2.pkl",
                              SAVED_DIR / "xgboost_risk_v1.pkl")
    scaler_path   = find_file(SAVED_DIR / "scaler_v2.pkl",
                              SAVED_DIR / "scaler_v1.pkl")
    encoders_path = find_file(SAVED_DIR / "encoders_v2.pkl",
                              SAVED_DIR / "encoders_v1.pkl")
    meta_path     = find_file(SAVED_DIR / "model_meta_v2.json",
                              SAVED_DIR / "model_meta_v1.json")
    data_path     = DATA_DIR / "poultry_dataset.csv"

    required = {
        "Risk model" : risk_path,
        "Scaler"     : scaler_path,
        "Encoders"   : encoders_path,
        "Model meta" : meta_path,
        "Dataset"    : data_path if data_path.exists() else None,
    }
    for name, path in required.items():
        if path is None:
            print(f"  ERROR: {name} not found — skipping XGBoost evaluation.")
            return None
        print(f"  {name}: {path.name}")

    # --- Load artefacts ---
    risk_model = joblib.load(risk_path)
    scaler     = joblib.load(scaler_path)
    encoders   = joblib.load(encoders_path)

    with open(meta_path, encoding="utf-8") as fh:
        meta = json.load(fh)

    risk_le       = encoders["risk_le"]
    feature_names = meta["feature_names"]
    numeric_cols  = meta["numeric_cols"]
    cat_cols      = meta["categorical_nominal"]

    # Title-case labels ordered by the LabelEncoder (alphabetical at fit time)
    display_classes = [c.title() for c in risk_le.classes_]
    n_classes       = len(display_classes)

    # --- Load and preprocess dataset (mirrors the training pipeline exactly) ---
    print(f"\n  Loading dataset from {data_path} ...")
    df = pd.read_csv(data_path)
    print(f"  Records: {len(df)}")

    dummies = pd.get_dummies(df[cat_cols], prefix=cat_cols)
    X = pd.concat(
        [df[numeric_cols].reset_index(drop=True),
         dummies.reset_index(drop=True)],
        axis=1,
    )

    # Align with the exact column set used at training time
    for col in feature_names:
        if col not in X.columns:
            X[col] = 0
    X = X[feature_names].copy()

    # Transform (not fit_transform) — scaler was fitted on the full dataset during training
    X[numeric_cols] = scaler.transform(X[numeric_cols])

    y_risk = df["risk_level"]

    # Reproduce the exact training split; use only the test partition for evaluation
    _, X_test, _, y_test = train_test_split(
        X, y_risk, test_size=0.2, stratify=y_risk, random_state=42
    )
    print(f"  Test split: {len(X_test)} records (20%, stratified on risk_level)")

    y_test_enc = risk_le.transform(y_test)
    y_pred_enc = risk_model.predict(X_test)
    y_proba    = risk_model.predict_proba(X_test)

    acc        = accuracy_score(y_test_enc, y_pred_enc)
    macro_f1   = f1_score(y_test_enc, y_pred_enc, average="macro")
    report_str = classification_report(
        y_test_enc, y_pred_enc, target_names=display_classes
    )

    print(f"\n  Accuracy : {acc:.4f}")
    print(f"  Macro F1 : {macro_f1:.4f}")
    print("\n  Classification Report:")
    print(report_str)

    outputs = {}

    # --- 3.1  Normalised Confusion Matrix ---
    print("  [1/4] Generating confusion matrix ...")
    cm      = confusion_matrix(y_test_enc, y_pred_enc)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm_norm, annot=True, fmt=".2f", cmap="Greens",
        xticklabels=display_classes, yticklabels=display_classes,
        linewidths=0.5, ax=ax,
        cbar_kws={"label": "Normalised Proportion"},
    )
    ax.set_title("XGBoost Risk Classifier — Normalised Confusion Matrix",
                 fontsize=13, pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label", fontsize=11)
    plt.tight_layout()
    cm_path = OUTPUT_DIR / "xgboost_confusion_matrix.png"
    fig.savefig(cm_path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["Confusion Matrix"] = cm_path
    print(f"    Saved: {cm_path}")

    # --- 3.2  ROC Curves (One-vs-Rest multiclass) ---
    print("  [2/4] Generating ROC curves ...")
    y_test_bin = label_binarize(y_test_enc, classes=list(range(n_classes)))

    fig, ax = plt.subplots(figsize=(8, 6))
    for i, (cls_name, color) in enumerate(zip(display_classes, CLASS_COLORS)):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_proba[:, i])
        auc          = roc_auc_score(y_test_bin[:, i], y_proba[:, i])
        ax.plot(fpr, tpr, color=color, lw=2,
                label=f"{cls_name}  (AUC = {auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Random Classifier")
    ax.set_title("XGBoost Risk Classifier — ROC Curves (One-vs-Rest)",
                 fontsize=13, pad=12)
    ax.set_xlabel("False Positive Rate", fontsize=11)
    ax.set_ylabel("True Positive Rate", fontsize=11)
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    roc_path = OUTPUT_DIR / "xgboost_roc_curve.png"
    fig.savefig(roc_path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["ROC Curve"] = roc_path
    print(f"    Saved: {roc_path}")

    # --- 3.3  Classification Report (.txt) ---
    print("  [3/4] Saving classification report ...")
    report_body = (
        "APRIS XGBoost Risk Classifier — Evaluation Report\n"
        f"Test set  : {len(X_test)} records  "
        f"(80/20 stratified split, random_state=42)\n"
        f"Accuracy  : {acc:.4f}   Macro F1 : {macro_f1:.4f}\n\n"
        "Classification Report:\n" + report_str
    )
    cr_path = OUTPUT_DIR / "xgboost_classification_report.txt"
    save_report(report_body, cr_path)
    outputs["Classification Report"] = cr_path

    # --- 3.4  Top-13 Feature Importance Chart ---
    print("  [4/4] Generating feature importance chart ...")
    feat_df = (
        pd.DataFrame({
            "feature"   : feature_names,
            "importance": risk_model.feature_importances_,
        })
        .sort_values("importance", ascending=False)
        .head(13)
    )

    fig, ax = plt.subplots(figsize=(9, 6))
    bars = ax.barh(
        feat_df["feature"][::-1],
        feat_df["importance"][::-1],
        color=PRIMARY_COLOR, edgecolor="white",
    )
    for bar in bars:
        w = bar.get_width()
        ax.text(w + 0.001, bar.get_y() + bar.get_height() / 2,
                f"{w:.4f}", va="center", ha="left", fontsize=8)
    ax.set_title("XGBoost Risk Classifier — Top 13 Feature Importances",
                 fontsize=13, pad=12)
    ax.set_xlabel("Importance Score", fontsize=11)
    ax.set_ylabel("Feature", fontsize=11)
    ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()
    fi_path = OUTPUT_DIR / "xgboost_feature_importance.png"
    fig.savefig(fi_path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["Feature Importance"] = fi_path
    print(f"    Saved: {fi_path}")

    return {
        "model"    : "XGBoost Risk Classifier",
        "accuracy" : acc,
        "macro_f1" : macro_f1,
        "outputs"  : outputs,
    }


# =============================================================================
# SECTION 4: CNN Evaluation
# =============================================================================

# Folder / internal name  →  display label used in all plots and reports
_CNN_DISPLAY_MAP = {
    "cocci"      : "Coccidiosis",
    "healthy"    : "Healthy",
    "ncd"        : "Newcastle Disease",
    "salmo"      : "Salmonella",
    "coccidiosis": "Coccidiosis",
    "salmonella" : "Salmonella",
}


def _load_cnn_model(path):
    """
    Load a Keras model with a compatibility shim for MobileNetV2 checkpoints
    that still carry the deprecated BatchNormalization 'renorm' keys.
    Patches __init__ rather than from_config for Keras 3.x compatibility.
    """
    import tensorflow as tf
    import keras

    orig_init = keras.layers.BatchNormalization.__init__

    def _patched_init(self, *args, **kwargs):
        for key in ("renorm", "renorm_clipping", "renorm_momentum"):
            kwargs.pop(key, None)
        orig_init(self, *args, **kwargs)

    keras.layers.BatchNormalization.__init__ = _patched_init
    try:
        model = tf.keras.models.load_model(str(path), compile=False)
    finally:
        keras.layers.BatchNormalization.__init__ = orig_init

    return model


def evaluate_cnn():
    """
    Load the saved CNN MobileNetV2 classifier and evaluate it on a held-out
    image set, generating:

      0. Training history plot  (skipped with a warning if history file absent)
      1. Normalised confusion matrix (heatmap)
      2. Per-class classification report — console + .txt
      3. 3×4 sample prediction grid with true/predicted labels and confidence

    Returns a result dict, or None if a required artefact is missing.
    """
    print("\n" + "=" * 65)
    print("  CNN MODEL EVALUATION")
    print("=" * 65)

    # --- Lazy TensorFlow import (skip rather than crash if absent) ---
    try:
        import tensorflow as tf                                    # noqa: F401
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
        from PIL import Image as PilImage
    except ImportError as exc:
        print(f"  ERROR: TensorFlow/Keras not available ({exc}). "
              "Skipping CNN evaluation.")
        return None

    # --- Locate CNN model ---
    cnn_path = find_file(
        SAVED_DIR / "cnn_best.keras",
        SAVED_DIR / "cnn_model_v1.h5",
        SAVED_DIR / "cnn_best.h5",
    )
    ci_path = find_file(SAVED_DIR / "class_indices_v1.json")

    if not cnn_path:
        print("  ERROR: CNN model file not found — skipping CNN evaluation.")
        return None

    print(f"  CNN model: {cnn_path.name}")
    try:
        cnn_model = _load_cnn_model(cnn_path)
        print("  Model loaded successfully.")
    except Exception as exc:
        print(f"  ERROR loading CNN model: {exc}. Skipping CNN evaluation.")
        return None

    # --- Training history (optional) ---
    hist_path = find_file(
        SAVED_DIR / "cnn_history.json",
        SAVED_DIR / "cnn_history.pkl",
        SAVED_DIR / "training_history.json",
        SAVED_DIR / "training_history.pkl",
    )
    if not hist_path:
        print("  WARNING: CNN training history not found. "
              "Re-train the model with history saving enabled to generate this plot.")

    # --- Build index → display-label mapping from class_indices_v1.json ---
    idx_to_display = {}
    if ci_path:
        with open(ci_path, encoding="utf-8") as fh:
            ci_data = json.load(fh)
        for idx_str, raw_name in ci_data.get("idx_to_display", {}).items():
            idx_to_display[int(idx_str)] = _CNN_DISPLAY_MAP.get(
                raw_name.lower(), raw_name.title()
            )

    # --- Image data setup ---
    if not IMAGES_DIR.exists():
        print(f"  ERROR: Images directory not found at {IMAGES_DIR}. "
              "Skipping CNN evaluation.")
        return None

    IMG_SIZE   = (224, 224)
    BATCH_SIZE = 32

    # Use a dedicated test/ subfolder when available; otherwise 20% validation split
    test_dir = IMAGES_DIR / "test"
    if test_dir.exists():
        eval_dir = test_dir
        print(f"  Using dedicated test directory: {test_dir}")
        datagen  = ImageDataGenerator(rescale=1.0 / 255)
        test_gen = datagen.flow_from_directory(
            str(eval_dir),
            target_size=IMG_SIZE, batch_size=BATCH_SIZE,
            class_mode="categorical", shuffle=False,
        )
    else:
        eval_dir = IMAGES_DIR
        print(f"  No test/ subfolder found — using 20% validation split of {IMAGES_DIR}")
        datagen  = ImageDataGenerator(rescale=1.0 / 255, validation_split=0.2)
        test_gen = datagen.flow_from_directory(
            str(eval_dir),
            target_size=IMG_SIZE, batch_size=BATCH_SIZE,
            class_mode="categorical", shuffle=False,
            subset="validation", seed=42,
        )

    if test_gen.samples == 0:
        print("  ERROR: No images found in test generator. Skipping CNN evaluation.")
        return None

    print(f"  Test samples: {test_gen.samples}")
    print(f"  Class indices: {test_gen.class_indices}")

    # If class_indices file was unavailable, fall back to folder-name mapping
    if not idx_to_display:
        idx_to_display = {
            idx: _CNN_DISPLAY_MAP.get(name, name.title())
            for name, idx in test_gen.class_indices.items()
        }
    display_classes = [idx_to_display[i] for i in range(len(test_gen.class_indices))]

    # --- Run predictions over the full test set ---
    print("  Running predictions ...")
    preds   = cnn_model.predict(test_gen, verbose=0)
    y_proba = preds
    y_pred  = np.argmax(preds, axis=1)
    y_true  = test_gen.classes

    acc        = accuracy_score(y_true, y_pred)
    macro_f1   = f1_score(y_true, y_pred, average="macro")
    report_str = classification_report(y_true, y_pred, target_names=display_classes)

    print(f"\n  Accuracy : {acc:.4f}")
    print(f"  Macro F1 : {macro_f1:.4f}")
    print("\n  Classification Report:")
    print(report_str)

    outputs = {}

    # --- 4.0  Training History Plot (only when history file is present) ---
    if hist_path:
        print("  [0/3] Generating training history plot ...")
        try:
            if hist_path.suffix == ".json":
                with open(hist_path, encoding="utf-8") as fh:
                    history_data = json.load(fh)
            else:
                history_data = joblib.load(hist_path)

            acc_key     = "accuracy"     if "accuracy"     in history_data else "acc"
            val_acc_key = "val_accuracy" if "val_accuracy" in history_data else "val_acc"
            epochs_x    = range(1, len(history_data[acc_key]) + 1)

            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

            ax1.plot(epochs_x, history_data[acc_key],
                     color=PRIMARY_COLOR, lw=2, label="Training Accuracy")
            ax1.plot(epochs_x, history_data[val_acc_key],
                     color="#C62828", lw=2, linestyle="--", label="Validation Accuracy")
            ax1.set_title("Accuracy over Epochs", fontsize=12)
            ax1.set_xlabel("Epoch")
            ax1.set_ylabel("Accuracy")
            ax1.legend()
            ax1.grid(alpha=0.3)

            ax2.plot(epochs_x, history_data["loss"],
                     color=PRIMARY_COLOR, lw=2, label="Training Loss")
            ax2.plot(epochs_x, history_data["val_loss"],
                     color="#C62828", lw=2, linestyle="--", label="Validation Loss")
            ax2.set_title("Loss over Epochs", fontsize=12)
            ax2.set_xlabel("Epoch")
            ax2.set_ylabel("Loss")
            ax2.legend()
            ax2.grid(alpha=0.3)

            fig.suptitle("CNN MobileNetV2 — Training History", fontsize=14)
            plt.tight_layout()
            hp = OUTPUT_DIR / "cnn_training_history.png"
            fig.savefig(hp, dpi=DPI, bbox_inches="tight")
            plt.close(fig)
            outputs["Training History"] = hp
            print(f"    Saved: {hp}")
        except Exception as exc:
            print(f"  WARNING: Could not generate training history plot: {exc}")

    # --- 4.1  Normalised Confusion Matrix ---
    print("  [1/3] Generating CNN confusion matrix ...")
    cm      = confusion_matrix(y_true, y_pred)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm_norm, annot=True, fmt=".2f", cmap="Greens",
        xticklabels=display_classes, yticklabels=display_classes,
        linewidths=0.5, ax=ax,
        cbar_kws={"label": "Normalised Proportion"},
    )
    ax.set_title("CNN MobileNetV2 — Normalised Confusion Matrix",
                 fontsize=13, pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label", fontsize=11)
    plt.tight_layout()
    cm_path = OUTPUT_DIR / "cnn_confusion_matrix.png"
    fig.savefig(cm_path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["Confusion Matrix"] = cm_path
    print(f"    Saved: {cm_path}")

    # --- 4.2  Classification Report (.txt) ---
    print("  [2/3] Saving CNN classification report ...")
    split_desc = (
        "dedicated test/ subfolder"
        if test_dir.exists() else "20% validation split (subset='validation')"
    )
    report_body = (
        "APRIS CNN MobileNetV2 — Evaluation Report\n"
        f"Test images : {test_gen.samples}  ({split_desc})\n"
        f"Accuracy    : {acc:.4f}   Macro F1 : {macro_f1:.4f}\n\n"
        "Classification Report:\n" + report_str
    )
    cr_path = OUTPUT_DIR / "cnn_classification_report.txt"
    save_report(report_body, cr_path)
    outputs["Classification Report"] = cr_path

    # --- 4.3  Sample Prediction Grid (3 × 4 = 12 random test images) ---
    print("  [3/3] Generating sample prediction grid ...")
    filenames = test_gen.filenames
    n_avail   = len(filenames)

    np.random.seed(42)
    if n_avail >= 12:
        sample_idx = np.random.choice(n_avail, 12, replace=False)
    else:
        sample_idx = np.arange(n_avail)
        print(f"  WARNING: Only {n_avail} test images available; "
              "grid will have fewer than 12 panels.")

    fig, axes = plt.subplots(3, 4, figsize=(14, 10))
    fig.suptitle(
        "CNN MobileNetV2 — Sample Predictions  "
        "(Green title = Correct  |  Red title = Incorrect)",
        fontsize=12,
    )

    for ax, idx in zip(axes.flat, sample_idx):
        img_file = eval_dir / filenames[idx]
        try:
            pil_img = PilImage.open(str(img_file)).convert("RGB").resize(IMG_SIZE)
            ax.imshow(np.array(pil_img))
        except Exception:
            ax.imshow(np.zeros((*IMG_SIZE, 3), dtype=np.uint8))

        true_lbl = display_classes[y_true[idx]]
        pred_lbl = display_classes[y_pred[idx]]
        conf_pct = y_proba[idx][y_pred[idx]] * 100
        title_color = PRIMARY_COLOR if y_true[idx] == y_pred[idx] else "#C62828"
        ax.set_title(
            f"True: {true_lbl}\nPred: {pred_lbl}  ({conf_pct:.1f}%)",
            fontsize=8, color=title_color, pad=3,
        )
        ax.axis("off")

    for ax in axes.flat[len(sample_idx):]:
        ax.axis("off")

    plt.tight_layout()
    gp = OUTPUT_DIR / "cnn_sample_predictions.png"
    fig.savefig(gp, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["Sample Prediction Grid"] = gp
    print(f"    Saved: {gp}")

    return {
        "model"    : "CNN MobileNetV2",
        "accuracy" : acc,
        "macro_f1" : macro_f1,
        "outputs"  : outputs,
    }


# =============================================================================
# SECTION 5: Summary Table
# =============================================================================

def print_summary(results):
    """Print a formatted console table summarising all evaluation results."""
    print("\n" + "=" * 65)
    print("  EVALUATION SUMMARY")
    print("=" * 65)

    col_w = 30
    print(f"\n  {'Model':<{col_w}} {'Accuracy':>10}  {'Macro F1':>10}")
    print(f"  {'-' * col_w} {'----------':>10}  {'----------':>10}")
    for r in results:
        print(f"  {r['model']:<{col_w}} {r['accuracy']:>10.4f}  {r['macro_f1']:>10.4f}")

    print(f"\n  Output files:")
    print(f"  {'-' * 63}")
    for r in results:
        print(f"\n  [{r['model']}]")
        for label, path in r["outputs"].items():
            print(f"    {label:<28} {path}")

    print(f"\n  All outputs saved to: {OUTPUT_DIR}")


# =============================================================================
# SECTION 6: Entry Point
# =============================================================================

if __name__ == "__main__":
    print("=" * 65)
    print("  APRIS — Model Evaluation Script")
    print(f"  Output directory : {OUTPUT_DIR}")
    print("=" * 65)

    results = []

    xgb_result = evaluate_xgboost()
    if xgb_result:
        results.append(xgb_result)

    cnn_result = evaluate_cnn()
    if cnn_result:
        results.append(cnn_result)

    if results:
        print_summary(results)
    else:
        print("\nNo models were successfully evaluated. Check error messages above.")
        sys.exit(1)
