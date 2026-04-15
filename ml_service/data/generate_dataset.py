"""
APRIS — Synthetic XGBoost Training Dataset Generator
Generates 8,000 labelled records using veterinary domain knowledge rules.
All rules are grounded in published literature (cited in project report).
"""

import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)
N = 8000

SEASONS = ["dry", "wet", "harmattan"]
REGIONS = ["north", "south_west", "south_east", "south_south"]
HOUSING = ["open_sided", "closed", "battery_cage"]
DISEASES = [
    "Avian Influenza",
    "Newcastle Disease",
    "Gumboro Disease",
    "Marek's Disease",
    "Infectious Bronchitis",
    "Fowl Typhoid",
    "Coccidiosis",
    "Heat Stress Syndrome",
    "Fowl Pox",
]


def generate_base_features(n):
    return {
        "temperature_c": np.random.uniform(18, 42, n),
        "humidity_pct": np.random.uniform(30, 95, n),
        "rainfall_mm": np.random.uniform(0, 200, n),
        "season": np.random.choice(SEASONS, n),
        "region": np.random.choice(REGIONS, n),
        "flock_age_weeks": np.random.randint(1, 73, n),
        "flock_size": np.random.randint(500, 50001, n),
        "housing_type": np.random.choice(HOUSING, n),
        "vaccinated": np.random.choice([0, 1], n, p=[0.35, 0.65]),
        "nearby_outbreak": np.random.choice([0, 1], n, p=[0.85, 0.15]),
        "wild_bird_proximity": np.random.choice([0, 1], n, p=[0.70, 0.30]),
        "mortality_rate_pct": np.random.uniform(0, 15, n),
        "feed_intake_pct": np.random.uniform(40, 100, n),
    }


def apply_rules(df):
    risk = np.full(n, "low", dtype=object)
    disease = np.full(n, "Fowl Pox", dtype=object)  # default baseline

    # Rule 1: Heat Stress — Lara & Rostagno (2013)
    heat = (df["temperature_c"] > 35) & (df["humidity_pct"] > 75)
    risk[heat] = np.where(
        df.loc[heat, "temperature_c"] > 38, "critical", "high"
    )
    disease[heat] = "Heat Stress Syndrome"

    # Rule 2: Avian Influenza — FAO EMPRES West Africa
    ai = (
        (df["wild_bird_proximity"] == 1)
        & (df["nearby_outbreak"] == 1)
        & (df["season"] == "harmattan")
    )
    risk[ai] = "critical"
    disease[ai] = "Avian Influenza"

    # Rule 3: Newcastle Disease — OIE Technical Disease Card
    nd = (
        (df["vaccinated"] == 0)
        & df["flock_age_weeks"].between(4, 8)
        & (df["rainfall_mm"] > 80)
    )
    risk[nd] = "high"
    disease[nd] = "Newcastle Disease"

    # Rule 4: Coccidiosis — Chapman (2008)
    cocci = (
        (df["humidity_pct"] > 80)
        & (df["housing_type"] == "open_sided")
        & (df["rainfall_mm"] > 60)
    )
    risk[cocci] = np.where(df.loc[cocci, "humidity_pct"] > 88, "high", "medium")
    disease[cocci] = "Coccidiosis"

    # Rule 5: Gumboro Disease (IBD)
    gumboro = (
        df["flock_age_weeks"].between(3, 6)
        & (df["vaccinated"] == 0)
        & (df["flock_size"] > 15000)
    )
    risk[gumboro] = "high"
    disease[gumboro] = "Gumboro Disease"

    # Rule 6: Marek's Disease — young unvaccinated
    mareks = (
        (df["vaccinated"] == 0)
        & (df["flock_age_weeks"] < 3)
        & (df["flock_size"] > 8000)
    )
    risk[mareks] = "medium"
    disease[mareks] = "Marek's Disease"

    # Rule 7: Infectious Bronchitis — cold + young flocks
    ib = (
        (df["temperature_c"] < 22)
        & (df["flock_age_weeks"] < 10)
        & (df["humidity_pct"] > 65)
    )
    risk[ib] = np.where(df.loc[ib, "vaccinated"] == 0, "high", "medium")
    disease[ib] = "Infectious Bronchitis"

    # Rule 8: Fowl Typhoid — high mortality + low feed + large flock
    ft = (
        (df["mortality_rate_pct"] > 5)
        & (df["feed_intake_pct"] < 60)
        & (df["flock_size"] > 10000)
    )
    risk[ft] = "high"
    disease[ft] = "Fowl Typhoid"

    # Rule 9: Baseline medium risk — elevated mortality or low feed
    base_medium = (
        ((df["mortality_rate_pct"] > 3) | (df["feed_intake_pct"] < 70))
        & (risk == "low")
    )
    risk[base_medium] = "medium"

    return risk, disease


def add_noise(df, numeric_cols, noise_pct=0.12):
    """Add Gaussian noise (±12%) to numeric columns to prevent memorisation."""
    for col in numeric_cols:
        noise = np.random.normal(0, noise_pct * df[col].std(), len(df))
        df[col] = df[col] + noise
    # Clip to valid ranges
    df["temperature_c"] = df["temperature_c"].clip(18, 42)
    df["humidity_pct"] = df["humidity_pct"].clip(30, 95)
    df["rainfall_mm"] = df["rainfall_mm"].clip(0, 200)
    df["mortality_rate_pct"] = df["mortality_rate_pct"].clip(0, 15)
    df["feed_intake_pct"] = df["feed_intake_pct"].clip(40, 100)
    return df


if __name__ == "__main__":
    n = N
    print(f"Generating {n} records...")

    base = generate_base_features(n)
    df = pd.DataFrame(base)

    risk_labels, disease_labels = apply_rules(df)
    df["risk_level"] = risk_labels
    df["disease_label"] = disease_labels

    numeric_cols = [
        "temperature_c", "humidity_pct", "rainfall_mm",
        "mortality_rate_pct", "feed_intake_pct",
    ]
    df = add_noise(df, numeric_cols)

    out_path = Path(__file__).parent / "poultry_dataset.csv"
    df.to_csv(out_path, index=False)

    print(f"Dataset saved to {out_path}")
    print("\nRisk level distribution:")
    print(df["risk_level"].value_counts())
    print("\nDisease label distribution:")
    print(df["disease_label"].value_counts())
    print(f"\nShape: {df.shape}")
