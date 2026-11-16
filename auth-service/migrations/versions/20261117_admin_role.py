"""allow admin accounts and make registration admin-only

Revision ID: 20261117_admin_role
Revises: fed79199d1e0
"""
from alembic import op


revision = "20261117_admin_role"
down_revision = "fed79199d1e0"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'manager', 'employee')",
    )


def downgrade():
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('manager', 'employee')",
    )
