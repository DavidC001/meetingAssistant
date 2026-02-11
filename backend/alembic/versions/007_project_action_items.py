"""project action items

Revision ID: 007
Revises: 006
Create Date: 2026-02-11
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_action_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action_item_id", sa.Integer(), sa.ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("project_id", "action_item_id"),
    )
    # Data migration: link all action items from project_meetings
    connection = op.get_bind()
    dialect = connection.dialect.name
    if dialect == "sqlite":
        connection.execute(
            sa.text(
                "INSERT OR IGNORE INTO project_action_items (project_id, action_item_id) "
                "SELECT pm.project_id, ai.id "
                "FROM project_meetings pm "
                "JOIN transcriptions t ON t.meeting_id = pm.meeting_id "
                "JOIN action_items ai ON ai.transcription_id = t.id"
            )
        )
    else:
        connection.execute(
            sa.text(
                "INSERT INTO project_action_items (project_id, action_item_id) "
                "SELECT pm.project_id, ai.id "
                "FROM project_meetings pm "
                "JOIN transcriptions t ON t.meeting_id = pm.meeting_id "
                "JOIN action_items ai ON ai.transcription_id = t.id "
                "ON CONFLICT (project_id, action_item_id) DO NOTHING"
            )
        )


def downgrade():
    op.drop_table("project_action_items")
