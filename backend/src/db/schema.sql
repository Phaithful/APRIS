-- APRIS PostgreSQL Schema
-- Run: psql -U apris_user -d apris_db -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'farmer'
                      CHECK (role IN ('farmer', 'admin', 'vet')),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Farms ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    state        VARCHAR(50)  NOT NULL,
    lga          VARCHAR(100) NOT NULL,
    address      TEXT,
    latitude     DECIMAL(10, 7),
    longitude    DECIMAL(10, 7),
    housing_type VARCHAR(30) CHECK (housing_type IN ('open_sided', 'closed', 'battery_cage', 'mixed')),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Flocks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flocks (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id              UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name                 VARCHAR(100),
    species              VARCHAR(50) CHECK (species IN ('broiler', 'layer', 'cockerel', 'turkey', 'duck')),
    flock_size           INTEGER NOT NULL CHECK (flock_size > 0),
    age_weeks            INTEGER NOT NULL CHECK (age_weeks >= 0),
    hatch_date           DATE,
    vaccinated           BOOLEAN NOT NULL DEFAULT false,
    vaccination_notes    TEXT,
    current_mortality_rate DECIMAL(5, 2) DEFAULT 0,
    feed_intake_pct      DECIMAL(5, 2) DEFAULT 100,
    is_active            BOOLEAN NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Risk Assessments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_assessments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id              UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    flock_id             UUID REFERENCES flocks(id) ON DELETE SET NULL,
    risk_level           VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score           INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    temperature          DECIMAL(5, 2),
    humidity             DECIMAL(5, 2),
    rainfall             DECIMAL(6, 2),
    season               VARCHAR(20),
    region               VARCHAR(30),
    nearby_outbreak      BOOLEAN DEFAULT false,
    wild_bird_proximity  BOOLEAN DEFAULT false,
    weather_snapshot     JSONB,
    xgboost_model_version VARCHAR(20) DEFAULT 'v1',
    mortality_rate_pct   DECIMAL(5, 2) DEFAULT 0,
    assessed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Disease Predictions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disease_predictions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id  UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    disease_name   VARCHAR(100) NOT NULL,
    probability    DECIMAL(5, 4) NOT NULL,
    severity       VARCHAR(20),
    rank           INTEGER NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Mitigations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mitigations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
    action        TEXT NOT NULL,
    urgency_rank  INTEGER NOT NULL,
    category      VARCHAR(30) CHECK (category IN ('biosecurity', 'environment', 'treatment', 'vet_alert', 'nutrition')),
    disease_ref   VARCHAR(100),
    is_completed  BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Image Analyses ─────────────────────────────────────────────────────────────
-- CNN redesign: predicted_class stores disease name (healthy/coccidiosis/salmonella/ncd)
CREATE TABLE IF NOT EXISTS image_analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id          UUID REFERENCES farms(id) ON DELETE SET NULL,
    flock_id         UUID REFERENCES flocks(id) ON DELETE SET NULL,
    assessment_id    UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
    image_filename   VARCHAR(255),
    image_path       TEXT,
    predicted_class  VARCHAR(30) CHECK (predicted_class IN ('healthy', 'coccidiosis', 'salmonella', 'ncd')),
    severity         VARCHAR(20),
    severity_level   INTEGER,
    confidence       DECIMAL(5, 4),
    cnn_model_version VARCHAR(20) DEFAULT 'v1',
    notes            TEXT,
    analysed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Alerts ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id      UUID REFERENCES farms(id) ON DELETE CASCADE,
    flock_id     UUID REFERENCES flocks(id) ON DELETE SET NULL,
    assessment_id UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
    image_id     UUID REFERENCES image_analyses(id) ON DELETE SET NULL,
    type         VARCHAR(30) NOT NULL CHECK (type IN ('high_risk', 'critical_risk', 'image_disease', 'mortality', 'system')),
    severity     VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'high', 'critical')),
    title        VARCHAR(200) NOT NULL,
    message      TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_flocks_farm_id ON flocks(farm_id);
CREATE INDEX IF NOT EXISTS idx_assessments_farm_id ON risk_assessments(farm_id);
CREATE INDEX IF NOT EXISTS idx_assessments_flock_id ON risk_assessments(flock_id);
CREATE INDEX IF NOT EXISTS idx_assessments_assessed_at ON risk_assessments(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_predictions_assessment ON disease_predictions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_mitigations_assessment ON mitigations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_image_analyses_farm ON image_analyses(farm_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(user_id, is_read);

-- ── Password Reset OTPs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash   VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON password_reset_otps(user_id);
