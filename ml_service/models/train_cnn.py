"""
APRIS — CNN Training Pipeline (MobileNetV2 Transfer Learning)
Classifies poultry dropping images into 4 disease classes:
  cocci (Coccidiosis), healthy, ncd (Newcastle Disease), salmo (Salmonella)

Image folders expected at: ml_service/data/images/
  cocci/    healthy/    ncd/    salmo/
"""

import json
import os
from pathlib import Path

import numpy as np
from sklearn.utils.class_weight import compute_class_weight

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.preprocessing.image import ImageDataGenerator

IMAGE_DIR = Path(__file__).parent.parent / "data" / "images"
SAVE_DIR = Path(__file__).parent / "saved"
SAVE_DIR.mkdir(exist_ok=True)

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS_FROZEN = 30
EPOCHS_FINETUNE = 10
FINE_TUNE_AT = 100  # unfreeze layers from this index onwards


def build_model(num_classes=4):
    base_model = MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation="relu")(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    model = models.Model(inputs, outputs)
    return model, base_model


if __name__ == "__main__":
    print(f"TensorFlow version: {tf.__version__}")
    print(f"Image directory: {IMAGE_DIR}")

    # --- Data generators ---
    train_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
        zoom_range=0.15,
        horizontal_flip=True,
        brightness_range=[0.8, 1.2],
        width_shift_range=0.1,
        height_shift_range=0.1,
        validation_split=0.2,
    )
    val_datagen = ImageDataGenerator(
        rescale=1.0 / 255,
        validation_split=0.2,
    )

    train_gen = train_datagen.flow_from_directory(
        IMAGE_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="training",
        seed=42,
    )
    val_gen = val_datagen.flow_from_directory(
        IMAGE_DIR,
        target_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="validation",
        seed=42,
    )

    print(f"\nClass indices: {train_gen.class_indices}")
    print(f"Training samples: {train_gen.samples}")
    print(f"Validation samples: {val_gen.samples}")

    # --- Class weights for imbalanced ncd ---
    class_labels = train_gen.classes
    unique_classes = np.unique(class_labels)
    weights = compute_class_weight(
        class_weight="balanced",
        classes=unique_classes,
        y=class_labels,
    )
    class_weight_dict = dict(zip(unique_classes.tolist(), weights.tolist()))
    print(f"\nClass weights: {class_weight_dict}")

    # --- Build model ---
    model, base_model = build_model(num_classes=len(train_gen.class_indices))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    callbacks = [
        EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
        ModelCheckpoint(
            str(SAVE_DIR / "cnn_best.keras"),
            save_best_only=True,
            monitor="val_accuracy",
        ),
    ]

    # --- Phase 1: Train with frozen base ---
    print(f"\n--- Phase 1: Training with frozen base ({EPOCHS_FROZEN} epochs) ---")
    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS_FROZEN,
        callbacks=callbacks,
        class_weight=class_weight_dict,
    )

    # --- Phase 2: Fine-tune top layers ---
    print(f"\n--- Phase 2: Fine-tuning last layers (from index {FINE_TUNE_AT}) ---")
    base_model.trainable = True
    for layer in base_model.layers[:FINE_TUNE_AT]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    ft_callbacks = [
        EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
    ]

    model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS_FINETUNE,
        callbacks=ft_callbacks,
        class_weight=class_weight_dict,
    )

    # --- Evaluate ---
    print("\n--- Evaluation on validation set ---")
    loss, acc = model.evaluate(val_gen, verbose=1)
    print(f"Validation loss: {loss:.4f}, accuracy: {acc:.4f}")

    # --- Save ---
    model.save(str(SAVE_DIR / "cnn_model_v1.h5"))
    print(f"\nModel saved to {SAVE_DIR / 'cnn_model_v1.h5'}")

    # Save class indices for inference
    # Keras alphabetical ordering: cocci=0, healthy=1, ncd=2, salmo=3
    # Map to display names used in DISEASE_SEVERITY lookup
    folder_to_display = {
        "cocci": "coccidiosis",
        "healthy": "healthy",
        "ncd": "ncd",
        "salmo": "salmonella",
    }
    class_indices = train_gen.class_indices  # {"cocci": 0, ...}
    # Build index→display_name map
    idx_to_name = {
        v: folder_to_display[k]
        for k, v in class_indices.items()
    }
    save_data = {
        "class_indices": class_indices,
        "idx_to_display": {str(k): v for k, v in idx_to_name.items()},
        "model_version": "v1",
    }
    with open(SAVE_DIR / "class_indices_v1.json", "w") as f:
        json.dump(save_data, f, indent=2)

    print(f"Class indices saved to {SAVE_DIR / 'class_indices_v1.json'}")
    print("\nTraining complete.")
