"""add title to meetings

Revision ID: 008
Revises: 007
Create Date: 2026-09-01
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("title", sa.String(), nullable=True))
    op.create_index("ix_meetings_title", "meetings", ["title"])

    # Meetings that already finished processing before this feature existed never get an
    # LLM-generated title (the pipeline only fills it in during analysis), so backfill their
    # title from filename — the display name the app already used for them everywhere. Meetings
    # still pending/processing/failed are left NULL so the pipeline can give them a real title
    # once (re)processed.
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE meetings SET title = filename WHERE status = 'completed' AND title IS NULL"))


def downgrade() -> None:
    op.drop_index("ix_meetings_title", table_name="meetings")
    op.drop_column("meetings", "title")
