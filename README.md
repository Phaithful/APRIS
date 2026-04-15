# APRIS — Adaptive Poultry Risk Intelligent System

AI-powered poultry health monitoring and disease risk prediction platform for Nigerian commercial farms.

## Architecture

| Layer | Technology | Port |
|---|---|---|
| ML Microservice | Python · FastAPI · XGBoost · TensorFlow/Keras | 8000 |
| REST API | Node.js · Express · PostgreSQL | 3001 |
| Frontend | React · Vite · Tailwind CSS | 5173 |

---

## Quick Start

Open **3 terminal windows**. Run each service in its own window.

### Terminal 1 — ML Service

```bash
cd ml_service

# Create virtual environment (first time only)
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# Install dependencies (first time only)
pip install -r requirements.txt

# Generate synthetic dataset (first time only)
python data/generate_dataset.py

# Train XGBoost models (first time only — takes 3–8 min)
python models/train_xgboost.py

# Train CNN model (first time only — takes 20–60 min depending on GPU)
python models/train_cnn.py

# Start the FastAPI server
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: http://localhost:8000/health → `{"status":"ok"}`

### Terminal 2 — Backend API

```bash
cd backend

# Copy and fill in your .env file (first time only)
cp .env.example .env
# Edit .env and set JWT_SECRET and OPENWEATHER_API_KEY

# Install PostgreSQL (see src/db/SETUP.md), then run schema:
psql -U apris_user -d apris_db -f src/db/schema.sql

# Install dependencies (first time only)
npm install

# Start the server
npm run dev
```

Verify: http://localhost:3001/api/health → `{"status":"ok"}`

### Terminal 3 — Frontend

```bash
cd frontend
npm install      # first time only
npm run dev
```

Open: http://localhost:5173

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
PORT=3001
DB_URL=postgresql://apris_user:apris_pass@localhost:5432/apris_db
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
OPENWEATHER_API_KEY=<your key from openweathermap.org>
ML_SERVICE_URL=http://localhost:8000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## CNN Image Folders

The CNN training expects images sorted by disease class at:
```
ml_service/data/images/
  cocci/       ← Coccidiosis images
  healthy/     ← Healthy droppings
  ncd/         ← Newcastle Disease
  salmo/       ← Salmonella
```

---

## ML Models Output

After training, these files are created in `ml_service/models/saved/`:
- `xgboost_risk_v1.pkl` — Risk level classifier
- `xgboost_disease_v1.pkl` — Disease probability classifier
- `scaler_v1.pkl` — Feature scaler
- `encoders_v1.pkl` — Label encoders
- `model_meta_v1.json` — Feature metadata
- `cnn_model_v1.h5` — CNN MobileNetV2 model
- `class_indices_v1.json` — Class index mapping

---

## First Use

1. Register an account at http://localhost:5173/register
2. To make yourself admin, run in psql:
   ```sql
   UPDATE users SET role='admin' WHERE email='your@email.com';
   ```
3. Add a farm in Farm Manager
4. Add a flock to the farm
5. Run a risk assessment from the Dashboard
6. Upload a dropping image in Image Analysis

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/farms | List farms |
| POST | /api/farms | Create farm |
| POST | /api/assessments | Run risk assessment |
| POST | /api/images/analyse | CNN image analysis |
| GET | /api/analytics/risk-trend | Risk score over time |
| GET | /api/alerts | User alerts |

All protected routes require JWT in httpOnly cookie (set automatically on login).
