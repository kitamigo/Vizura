#!/bin/sh
# updates the database schema and starts the auth service
set -e
FLASK_APP=wsgi.py flask db upgrade
exec gunicorn --bind=0.0.0.0:${PORT:-8000} --timeout 600 wsgi:app
