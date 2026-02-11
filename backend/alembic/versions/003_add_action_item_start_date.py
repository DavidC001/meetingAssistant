"""add start_date to action_items

Revision ID: 003
Revises: 002
Create Date: 2026-02-05 00:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("action_items", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("action_items", "start_date")
