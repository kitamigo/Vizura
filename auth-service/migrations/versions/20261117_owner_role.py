"""add owner accounts for public registration

Revision ID: 20261117_owner_role
Revises: 20261117_admin_role
"""
from alembic import op


revision = "20261117_owner_role"
down_revision = "20261117_admin_role"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('owner', 'admin', 'manager', 'employee')",
    )


def downgrade():
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'manager', 'employee')",
    )
