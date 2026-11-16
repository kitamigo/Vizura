#!/bin/sh
# Azure App Service startup command: apply migrations, then serve.
# Users never touch the database; the schema is built from migrations/.
set -e
FLASK_APP=wsgi.py flask db upgrade
exec gunicorn --bind=0.0.0.0:${PORT:-8000} --timeout 600 wsgi:app
