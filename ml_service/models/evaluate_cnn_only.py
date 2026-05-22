"""
APRIS — CNN-Only Evaluation Script
===================================
Run this when you need CNN evaluation outputs independently.

Usage:
    python ml_service/models/evaluate_cnn_only.py   (from project root)
"""

import sys
from pathlib import Path

# TF must be imported before matplotlib to avoid runtime crashes on Windows
import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")  # suppress excessive TF logs

import tensorflow as tf
import keras

# Now safe to import matplotlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import json
import warnings
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
import seaborn as sns

warnings.filterwarnings("ignore")

SCRIPT_DIR = Path(__file__).resolve().parent
SAVED_DIR  = SCRIPT_DIR / "saved"
DATA_DIR   = SCRIPT_DIR.parent / "data"
IMAGES_DIR = DATA_DIR / "images"
OUTPUT_DIR = SCRIPT_DIR / "evaluation_outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PRIMARY_COLOR = "#2E7D52"
DPI           = 150

_CNN_DISPLAY_MAP = {
    "cocci"      : "Coccidiosis",
    "healthy"    : "Healthy",
    "ncd"        : "Newcastle Disease",
    "salmo"      : "Salmonella",
    "coccidiosis": "Coccidiosis",
    "salmonella" : "Salmonella",
}


def _load_cnn_model(path):
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


def find_file(*candidates):
    for path in candidates:
        if Path(path).exists():
            return Path(path)
    return None


def evaluate_cnn():
    print("\n" + "=" * 65)
    print("  CNN MODEL EVALUATION")
    print("=" * 65)

    from tensorflow.keras.preprocessing.image import ImageDataGenerator
    from PIL import Image as PilImage

    cnn_path = find_file(
        SAVED_DIR / "cnn_best.keras",
        SAVED_DIR / "cnn_model_v1.h5",
        SAVED_DIR / "cnn_best.h5",
    )
    ci_path = find_file(SAVED_DIR / "class_indices_v1.json")

    if not cnn_path:
        print("  ERROR: CNN model file not found.")
        return None

    print(f"  CNN model: {cnn_path.name}")
    try:
        cnn_model = _load_cnn_model(cnn_path)
        print("  Model loaded successfully.")
    except Exception as exc:
        print(f"  ERROR loading CNN model: {exc}")
        return None

    hist_path = find_file(
        SAVED_DIR / "cnn_history.json",
        SAVED_DIR / "cnn_history.pkl",
        SAVED_DIR / "training_history.json",
        SAVED_DIR / "training_history.pkl",
    )
    if not hist_path:
        print("  WARNING: Training history not found — history plot will be skipped.")

    idx_to_display = {}
    if ci_path:
        with open(ci_path, encoding="utf-8") as fh:
            ci_data = json.load(fh)
        for idx_str, raw_name in ci_data.get("idx_to_display", {}).items():
            idx_to_display[int(idx_str)] = _CNN_DISPLAY_MAP.get(
                raw_name.lower(), raw_name.title()
            )

    if not IMAGES_DIR.exists():
        print(f"  ERROR: Images directory not found at {IMAGES_DIR}")
        return None

    IMG_SIZE   = (224, 224)
    BATCH_SIZE = 32

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
        print(f"  No test/ subfolder — using 20% validation split of {IMAGES_DIR}")
        datagen  = ImageDataGenerator(rescale=1.0 / 255, validation_split=0.2)
        test_gen = datagen.flow_from_directory(
            str(eval_dir),
            target_size=IMG_SIZE, batch_size=BATCH_SIZE,
            class_mode="categorical", shuffle=False,
            subset="validation", seed=42,
        )

    if test_gen.samples == 0:
        print("  ERROR: No images found.")
        return None

    print(f"  Test samples: {test_gen.samples}")
    print(f"  Class indices: {test_gen.class_indices}")

    if not idx_to_display:
        idx_to_display = {
            idx: _CNN_DISPLAY_MAP.get(name, name.title())
            for name, idx in test_gen.class_indices.items()
        }
    display_classes = [idx_to_display[i] for i in range(len(test_gen.class_indices))]

    print("  Running predictions ...")
    preds   = cnn_model.predict(test_gen, verbose=1)
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

    # --- Training History ---
    if hist_path:
        print("  [0/3] Generating training history plot ...")
        try:
            import joblib
            if hist_path.suffix == ".json":
                with open(hist_path, encoding="utf-8") as fh:
                    history_data = json.load(fh)
            else:
                history_data = joblib.load(hist_path)

            acc_key     = "accuracy"     if "accuracy"     in history_data else "acc"
            val_acc_key = "val_accuracy" if "val_accuracy" in history_data else "val_acc"
            epochs_x    = range(1, len(history_data[acc_key]) + 1)

            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
            ax1.plot(epochs_x, history_data[acc_key],   color=PRIMARY_COLOR, lw=2, label="Training Accuracy")
            ax1.plot(epochs_x, history_data[val_acc_key], color="#C62828",   lw=2, linestyle="--", label="Validation Accuracy")
            ax1.set_title("Accuracy over Epochs", fontsize=12)
            ax1.set_xlabel("Epoch"); ax1.set_ylabel("Accuracy"); ax1.legend(); ax1.grid(alpha=0.3)

            ax2.plot(epochs_x, history_data["loss"],     color=PRIMARY_COLOR, lw=2, label="Training Loss")
            ax2.plot(epochs_x, history_data["val_loss"], color="#C62828",   lw=2, linestyle="--", label="Validation Loss")
            ax2.set_title("Loss over Epochs", fontsize=12)
            ax2.set_xlabel("Epoch"); ax2.set_ylabel("Loss"); ax2.legend(); ax2.grid(alpha=0.3)

            fig.suptitle("CNN MobileNetV2 — Training History", fontsize=14)
            plt.tight_layout()
            hp = OUTPUT_DIR / "cnn_training_history.png"
            fig.savefig(hp, dpi=DPI, bbox_inches="tight")
            plt.close(fig)
            outputs["Training History"] = hp
            print(f"    Saved: {hp}")
        except Exception as exc:
            print(f"  WARNING: Could not generate training history plot: {exc}")

    # --- Confusion Matrix ---
    print("  [1/3] Generating confusion matrix ...")
    cm      = confusion_matrix(y_true, y_pred)
    cm_norm = cm.astype(float) / cm.sum(axis=1, keepdims=True)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm_norm, annot=True, fmt=".2f", cmap="Greens",
        xticklabels=display_classes, yticklabels=display_classes,
        linewidths=0.5, ax=ax,
        cbar_kws={"label": "Normalised Proportion"},
    )
    ax.set_title("CNN MobileNetV2 — Normalised Confusion Matrix", fontsize=13, pad=12)
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label", fontsize=11)
    plt.tight_layout()
    cm_path = OUTPUT_DIR / "cnn_confusion_matrix.png"
    fig.savefig(cm_path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    outputs["Confusion Matrix"] = cm_path
    print(f"    Saved: {cm_path}")

    # --- Classification Report ---
    print("  [2/3] Saving classification report ...")
    split_desc = "dedicated test/ subfolder" if test_dir.exists() else "20% validation split"
    report_body = (
        "APRIS CNN MobileNetV2 — Evaluation Report\n"
        f"Test images : {test_gen.samples}  ({split_desc})\n"
        f"Accuracy    : {acc:.4f}   Macro F1 : {macro_f1:.4f}\n\n"
        "Classification Report:\n" + report_str
    )
    cr_path = OUTPUT_DIR / "cnn_classification_report.txt"
    with open(cr_path, "w", encoding="utf-8") as fh:
        fh.write(report_body)
    print(f"    Saved: {cr_path}")
    outputs["Classification Report"] = cr_path

    # --- Sample Prediction Grid ---
    print("  [3/3] Generating sample prediction grid ...")
    filenames = test_gen.filenames
    n_avail   = len(filenames)

    np.random.seed(42)
    sample_idx = np.random.choice(n_avail, min(12, n_avail), replace=False)

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

        true_lbl    = display_classes[y_true[idx]]
        pred_lbl    = display_classes[y_pred[idx]]
        conf_pct    = y_proba[idx][y_pred[idx]] * 100
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

    return {"model": "CNN MobileNetV2", "accuracy": acc, "macro_f1": macro_f1, "outputs": outputs}


if __name__ == "__main__":
    print("=" * 65)
    print("  APRIS — CNN Model Evaluation")
    print(f"  Output directory : {OUTPUT_DIR}")
    print("=" * 65)

    result = evaluate_cnn()
    if result:
        print("\n" + "=" * 65)
        print("  SUMMARY")
        print("=" * 65)
        print(f"\n  Model    : {result['model']}")
        print(f"  Accuracy : {result['accuracy']:.4f}")
        print(f"  Macro F1 : {result['macro_f1']:.4f}")
        print(f"\n  Output files:")
        for label, path in result["outputs"].items():
            print(f"    {label:<28} {path}")
        print(f"\n  All outputs saved to: {OUTPUT_DIR}")
    else:
        print("\nCNN evaluation failed. Check error messages above.")
        sys.exit(1)
