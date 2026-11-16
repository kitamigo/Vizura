import os
from urllib.parse import quote_plus
from flask import Flask, jsonify
from flask_cors import CORS
from .extensions import db, limiter, migrate

# function for URL construction
def _database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        host, name = os.environ.get("DB_HOST"), os.environ.get("DB_NAME")
        user, pw = os.environ.get("DB_USER"), os.environ.get("DB_PASSWORD")
        if not all([host, name, user, pw]):
            raise RuntimeError(
                "Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD."
            )
        assert host is not None and name is not None and user is not None and pw is not None
        url = (
            f"postgresql+psycopg2://{quote_plus(user)}:{quote_plus(pw)}"
            f"@{host}:{os.environ.get('DB_PORT', '5432')}/{name}?sslmode=require"
        )
    # use the installed psycopg2 driver for generic PostgreSQL URLs
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    elif url.startswith("postgresql+psycopg://"):
        url = "postgresql+psycopg2://" + url[len("postgresql+psycopg://"):]
    return url

# flask app factory 
def create_app(config=None):
    app = Flask(__name__)
    app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET")
    app.config["JWT_EXPIRES_DAYS"] = 7
    app.config["RATELIMIT_STORAGE_URI"] = "memory://"
    if config:
        app.config.update(config)
    if "SQLALCHEMY_DATABASE_URI" not in app.config:
        app.config["SQLALCHEMY_DATABASE_URI"] = _database_url()

    if not app.config["JWT_SECRET"]:
        raise RuntimeError("JWT_SECRET must be set.")

    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
    CORS(app, origins=origins or ["http://localhost:5173"])

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

    from . import models  # this is needed to register the models with SQLAlchemy
    from .auth import bp as auth_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    @app.get("/")
    def health():
        return jsonify({"message": "Vizura auth service running"})

    return app
