"""
APRIS — Synthetic XGBoost Training Dataset Generator v2
Generates 31,500 balanced records (3,500 per disease class).
Each disease class has its own feature sampler so every class
is well-represented in the final dataset.
"""

import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)

N_PER_CLASS = 3500

SEASONS = ["dry", "wet", "harmattan"]
REGIONS = ["north", "south_west", "south_east", "south_south"]
HOUSING = ["open_sided", "closed", "battery_cage"]


def _base(n):
    """Fully random base feature dict for n records."""
    return {
        "temperature_c": np.random.uniform(18, 42, n),
        "humidity_pct": np.random.uniform(30, 95, n),
        "rainfall_mm": np.random.uniform(0, 200, n),
        "season": np.random.choice(SEASONS, n),
        "region": np.random.choice(REGIONS, n),
        "flock_age_weeks": np.random.randint(1, 73, n).astype(float),
        "flock_size": np.random.randint(500, 50001, n).astype(float),
        "housing_type": np.random.choice(HOUSING, n),
        "vaccinated": np.random.choice([0, 1], n, p=[0.35, 0.65]).astype(float),
        "nearby_outbreak": np.random.choice([0, 1], n, p=[0.85, 0.15]).astype(float),
        "wild_bird_proximity": np.random.choice([0, 1], n, p=[0.70, 0.30]).astype(float),
        "mortality_rate_pct": np.random.uniform(0, 15, n),
        "feed_intake_pct": np.random.uniform(40, 100, n),
    }


def gen_heat_stress(n):
    d = _base(n)
    critical = np.random.random(n) < 0.40
    d["temperature_c"] = np.where(critical,
                                   np.random.uniform(38, 42, n),
                                   np.random.uniform(35, 38, n))
    d["humidity_pct"] = np.random.uniform(75, 95, n)
    risk = np.where(critical, "critical", "high")
    return pd.DataFrame(d), risk, "Heat Stress Syndrome"


def gen_avian_influenza(n):
    d = _base(n)
    d["wild_bird_proximity"] = np.ones(n)
    d["nearby_outbreak"] = np.ones(n)
    d["season"] = np.array(["harmattan"] * n)
    risk = np.full(n, "critical", dtype=object)
    return pd.DataFrame(d), risk, "Avian Influenza"


def gen_newcastle(n):
    d = _base(n)
    d["vaccinated"] = np.zeros(n)
    d["flock_age_weeks"] = np.random.randint(4, 9, n).astype(float)
    d["rainfall_mm"] = np.random.uniform(80, 200, n)
    risk = np.full(n, "high", dtype=object)
    return pd.DataFrame(d), risk, "Newcastle Disease"


def gen_coccidiosis(n):
    d = _base(n)
    d["humidity_pct"] = np.random.uniform(80, 95, n)
    d["housing_type"] = np.array(["open_sided"] * n)
    d["rainfall_mm"] = np.random.uniform(60, 200, n)
    risk = np.where(d["humidity_pct"] > 88, "high", "medium")
    return pd.DataFrame(d), risk, "Coccidiosis"


def gen_gumboro(n):
    d = _base(n)
    d["flock_age_weeks"] = np.random.randint(3, 7, n).astype(float)
    d["vaccinated"] = np.zeros(n)
    d["flock_size"] = np.random.randint(15001, 50001, n).astype(float)
    risk = np.full(n, "high", dtype=object)
    return pd.DataFrame(d), risk, "Gumboro Disease"


def gen_mareks(n):
    d = _base(n)
    d["vaccinated"] = np.zeros(n)
    d["flock_age_weeks"] = np.random.randint(1, 3, n).astype(float)
    d["flock_size"] = np.random.randint(8001, 50001, n).astype(float)
    risk = np.full(n, "medium", dtype=object)
    return pd.DataFrame(d), risk, "Marek's Disease"


def gen_infectious_bronchitis(n):
    d = _base(n)
    d["temperature_c"] = np.random.uniform(18, 22, n)
    d["flock_age_weeks"] = np.random.randint(1, 10, n).astype(float)
    d["humidity_pct"] = np.random.uniform(65, 95, n)
    unvaccinated = np.random.random(n) < 0.55
    d["vaccinated"] = np.where(unvaccinated, 0.0, 1.0)
    risk = np.where(unvaccinated, "high", "medium")
    return pd.DataFrame(d), risk, "Infectious Bronchitis"


def gen_fowl_typhoid(n):
    d = _base(n)
    d["mortality_rate_pct"] = np.random.uniform(5, 15, n)
    d["feed_intake_pct"] = np.random.uniform(40, 60, n)
    d["flock_size"] = np.random.randint(10001, 50001, n).astype(float)
    risk = np.full(n, "high", dtype=object)
    return pd.DataFrame(d), risk, "Fowl Typhoid"


def gen_fowl_pox(n):
    """Fowl Pox: dry/harmattan season, open housing, low mortality, older flocks."""
    d = _base(n)
    d["season"] = np.random.choice(["dry", "harmattan"], n)
    d["housing_type"] = np.random.choice(["open_sided", "battery_cage"], n)
    d["mortality_rate_pct"] = np.random.uniform(0, 4, n)
    d["feed_intake_pct"] = np.random.uniform(60, 100, n)
    d["flock_age_weeks"] = np.random.randint(4, 73, n).astype(float)
    d["nearby_outbreak"] = np.random.choice([0, 1], n, p=[0.80, 0.20]).astype(float)
    medium_mask = (d["mortality_rate_pct"] > 2) | (d["feed_intake_pct"] < 75)
    risk = np.where(medium_mask, "medium", "low")
    return pd.DataFrame(d), risk, "Fowl Pox"


def add_noise(df, noise_pct=0.10):
    continuous = [
        "temperature_c", "humidity_pct", "rainfall_mm",
        "mortality_rate_pct", "feed_intake_pct",
        "flock_age_weeks", "flock_size",
    ]
    bounds = {
        "temperature_c": (18, 42),
        "humidity_pct": (30, 95),
        "rainfall_mm": (0, 200),
        "mortality_rate_pct": (0, 15),
        "feed_intake_pct": (40, 100),
        "flock_age_weeks": (1, 72),
        "flock_size": (500, 50000),
    }
    for col in continuous:
        noise = np.random.normal(0, noise_pct * df[col].std(), len(df))
        df[col] = (df[col] + noise).clip(*bounds[col])
    df["flock_age_weeks"] = df["flock_age_weeks"].round().clip(1, 72)
    df["flock_size"] = df["flock_size"].round().clip(500, 50000)
    return df


if __name__ == "__main__":
    generators = [
        gen_heat_stress,
        gen_avian_influenza,
        gen_newcastle,
        gen_coccidiosis,
        gen_gumboro,
        gen_mareks,
        gen_infectious_bronchitis,
        gen_fowl_typhoid,
        gen_fowl_pox,
    ]

    frames = []
    print(f"Generating {N_PER_CLASS} records per disease ({len(generators)} classes)...\n")
    for gen_fn in generators:
        df_part, risk, disease = gen_fn(N_PER_CLASS)
        df_part["risk_level"] = risk
        df_part["disease_label"] = disease
        frames.append(df_part)
        risk_dist = pd.Series(risk).value_counts().to_dict()
        print(f"  {disease}: {N_PER_CLASS} records  risk={risk_dist}")

    df = pd.concat(frames, ignore_index=True)
    df = add_noise(df, noise_pct=0.10)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    out_path = Path(__file__).parent / "poultry_dataset.csv"
    df.to_csv(out_path, index=False)

    print(f"\nDataset saved to {out_path}")
    print(f"Shape: {df.shape}")
    print("\nRisk level distribution:")
    print(df["risk_level"].value_counts())
    print("\nDisease label distribution:")
    print(df["disease_label"].value_counts())
