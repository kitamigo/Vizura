# Vizura auth service (Flask)

Owns user accounts and the database schema. Signup and login live here
(`POST /api/auth/register`, `POST /api/auth/login`). The schema is defined in
`app/models.py` and built by Flask-Migrate (`migrations/`), so nobody has to run
SQL by hand. Tokens use the same `JWT_SECRET` and claims as before, so the Express API
(`server/`) verifies them unchanged.

## Run locally

```bash
cd auth-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env     # then export the values (or use your shell's env)
export FLASK_APP=wsgi.py
flask db upgrade         # builds all tables from migrations
flask run --port 5001
```

`wsgi.py` loads `.env` for local startup. Production deployments should provide
`JWT_SECRET` and `DATABASE_URL` as environment variables or App Service settings.

Point the React client at it with `VITE_AUTH_URL` (see `client/.env.example`).

## Changing the schema later

```bash
flask db migrate -m "describe change"   # review the generated file
flask db upgrade
```

Commit `migrations/`. On Azure, `startup.sh` runs `flask db upgrade` on every start, so
a deploy applies new migrations automatically.

## Deploy to Azure

```bash
az group create -n vizura-rg -l <region>
az postgres flexible-server create -g vizura-rg -n vizura-pg-<suffix> -l <region> \
  --admin-user pgadmin --admin-password '<strong-password>' \
  --sku-name Standard_B1ms --tier Burstable --version 16 --public-access 0.0.0.0
az postgres flexible-server db create -g vizura-rg -s vizura-pg-<suffix> -d vizura

cd auth-service
az webapp up -n vizura-auth-<unique> -g vizura-rg --runtime "PYTHON:3.12" --sku B1
az webapp config appsettings set -g vizura-rg -n vizura-auth-<unique> --settings \
  DATABASE_URL="postgresql+psycopg2://pgadmin:<url-encoded-password>@vizura-pg-<suffix>.postgres.database.azure.com:5432/vizura?sslmode=require" \
  JWT_SECRET="<long random string>" \
  CORS_ORIGINS="https://<your-client-origin>"
az webapp config set -g vizura-rg -n vizura-auth-<unique> --startup-file "sh startup.sh"
```

`--public-access 0.0.0.0` lets Azure services reach the database; use VNet integration
and a private endpoint for production. Use the **same** `JWT_SECRET` (and the same
database) on the Express app. Build the client with `VITE_AUTH_URL` and `VITE_API_URL`
set to the deployed URLs. Check the Azure docs for currently supported runtimes,
Postgres versions and SKUs.

## Existing database that already has these tables

The first migration would fail with "relation already exists". Mark it as applied
instead, after checking the column names match `app/models.py`:

```bash
FLASK_APP=wsgi.py flask db stamp head
```

## Notes

- Emails are lowercased in Python and enforced by a database CHECK constraint.
- Passwords are Argon2id hashes, compatible with the old Express hashes.
- Register/login are rate limited to 10 per minute per IP (in-memory; use Redis if you
  run more than one instance).
- `employees`, `payslips` and `businesses` are modeled from the columns the Express
  code queries. `leave_balances` is mentioned in a comment in `payrollEngine.js` but
  isn't queried anywhere, so it isn't modeled yet.
