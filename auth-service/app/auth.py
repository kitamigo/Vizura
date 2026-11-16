# references - (ADD TO REPORT DONT FORGET)
# https://flask.palletsprojects.com/en/stable/blueprints/
# https://argon2-cffi.readthedocs.io/en/stable/api.html
# https://pyjwt.readthedocs.io/en/stable/usage.html

import datetime as dt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import IntegrityError
from .extensions import db, limiter
from .models import Business, User

bp = Blueprint("auth", __name__)
ph = PasswordHasher()  # argon2id

def _token(user):
    now = dt.datetime.now(dt.timezone.utc)
    # this is a simple JWT, not a JWE - payload is not encrypted, just signed
    payload = {
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
        "iat": now,
        "exp": now + dt.timedelta(days=current_app.config["JWT_EXPIRES_DAYS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET"], algorithm="HS256")

def _clean(value):
    return value.strip() if isinstance(value, str) else None

@bp.post("/register")
@limiter.limit("10 per minute")
def register():
    # reads and validates the new account details
    data = request.get_json(silent=True) or {}
    email = _clean(data.get("email"))
    password = data.get("password")
    role = "admin"
    business_name = _clean(data.get("business_name"))

    if not email or not isinstance(password, str) or not password:
        return jsonify(message="Email and password are required"), 400
    if len(password) < 8:
        return jsonify(message="Password must be at least 8 characters"), 400

    if User.query.filter_by(email=email.lower()).first():
        return jsonify(message="Email already in use"), 400

    user = User()
    user.first_name = _clean(data.get("first_name"))
    user.last_name = _clean(data.get("last_name"))
    user.email = email
    # stores only a secure password hash
    user.password_hash = ph.hash(password)
    user.role = role
    db.session.add(user)
    try:
        db.session.flush()
        if role == "admin" and business_name:
            business = Business()
            business.user_id = user.user_id
            business.business_name = business_name
            db.session.add(business)
        db.session.commit()
    except IntegrityError:  
        db.session.rollback()
        return jsonify(message="Email already in use"), 400

    return jsonify(
        message=f"Welcome to Vizura, {user.first_name or 'there'}!",
        token=_token(user),
        user=user.public(),
    ), 201

@bp.post("/login")
@limiter.limit("10 per minute")

def login():
    data = request.get_json(silent=True) or {}
    email, password = _clean(data.get("email")), data.get("password")
    invalid = (jsonify(message="Invalid email or password"), 401)
    if not email or not isinstance(password, str):
        return invalid
# error handling
    user = User.query.filter_by(email=email.lower()).first()
    if not user:
        return invalid
    try:
        ph.verify(user.password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return invalid

    if ph.check_needs_rehash(user.password_hash):
        user.password_hash = ph.hash(password)
        db.session.commit()

    return jsonify(
        message=f"Welcome back, {user.first_name or 'there'}!",
        token=_token(user),
        user=user.public(),
    ), 200