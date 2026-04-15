# PostgreSQL Setup — APRIS

## 1. Install PostgreSQL 15

Download from https://www.postgresql.org/download/windows/
Install with default settings. Note the password you set for the `postgres` superuser.

## 2. Add PostgreSQL to PATH

After installation, add this to your system PATH (adjust version/drive if needed):
```
C:\Program Files\PostgreSQL\15\bin
```

Then restart your terminal.

## 3. Create the APRIS database and user

Open a terminal and run:

```bash
psql -U postgres
```

Then in the psql prompt:

```sql
CREATE DATABASE apris_db;
CREATE USER apris_user WITH PASSWORD 'apris_pass';
GRANT ALL PRIVILEGES ON DATABASE apris_db TO apris_user;
\c apris_db
GRANT ALL ON SCHEMA public TO apris_user;
\q
```

## 4. Run the schema

```bash
psql -U apris_user -d apris_db -f src/db/schema.sql
```

## 5. Verify

```bash
psql -U apris_user -d apris_db -c "\dt"
```

You should see 6 tables: users, farms, flocks, risk_assessments, disease_predictions, mitigations, image_analyses.

## Connection string

```
postgresql://apris_user:apris_pass@localhost:5432/apris_db
```

Set this as `DB_URL` in your `.env` file.
