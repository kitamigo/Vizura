"""Schema for Vizura. Column names match what the Express server queries."""
from sqlalchemy import CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import validates
from .extensions import db

ROLES = ("admin", "manager", "employee")

# stores account details and access roles
class User(db.Model):
    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    email = db.Column(db.String(320), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="employee")
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    __table_args__ = (
        CheckConstraint("email = lower(email)", name="ck_users_email_lowercase"),
        CheckConstraint("role IN ('admin', 'manager', 'employee')", name="ck_users_role"),
    )

    @validates("email")
    def _normalize_email(self, key, value):
        return value.strip().lower()

    def public(self):
        # returns safe user fields for api responses
        return {
            "user_id": self.user_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "email": self.email,
            "role": self.role,
        }


# stores businesses owned by users
class Business(db.Model):
    __tablename__ = "businesses"

    business_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    business_name = db.Column(db.String(200), nullable=False)
    public_holiday_region = db.Column(db.String(100))


# stores employee details linked to a business
class Employee(db.Model):
    __tablename__ = "employees"

    employee_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.business_id", ondelete="CASCADE"), nullable=False)
    hourly_rate = db.Column(db.Numeric(10, 2), nullable=False)
    contract_type = db.Column(db.String(30))
    tax_code = db.Column(db.String(10))
    kiwisaver_rate = db.Column(db.Numeric(5, 4))
    ird_number = db.Column(db.String(15))


# stores payroll results for employees
class Payslip(db.Model):
    __tablename__ = "payslips"

    payslip_id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.employee_id", ondelete="CASCADE"), nullable=False)
    business_id = db.Column(db.Integer, db.ForeignKey("businesses.business_id", ondelete="CASCADE"), nullable=False)
    pay_period_start = db.Column(db.Date, nullable=False)
    pay_period_end = db.Column(db.Date, nullable=False)
    gross_pay = db.Column(db.Numeric(12, 2), nullable=False)
    paye_tax = db.Column(db.Numeric(12, 2), nullable=False)
    kiwisaver_employee = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    kiwisaver_employer = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    total_deductions = db.Column(db.Numeric(12, 2), nullable=False)
    net_pay = db.Column(db.Numeric(12, 2), nullable=False)
    ytd_gross = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    ytd_paye = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    ytd_kiwisaver = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    breakdown = db.Column(db.JSON().with_variant(JSONB(), "postgresql"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())