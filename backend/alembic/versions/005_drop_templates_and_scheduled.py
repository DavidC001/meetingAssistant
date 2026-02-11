"""drop templates and scheduled meetings

Revision ID: 005
Revises: 004
Create Date: 2026-02-11
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("meeting_templates")
    op.drop_table("scheduled_meetings")


def downgrade():
    op.create_table(
        "meeting_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_type", sa.String(), nullable=False),
        sa.Column("default_language", sa.String(), nullable=True),
        sa.Column("default_speakers", sa.String(), nullable=True),
        sa.Column("default_folder", sa.String(), nullable=True),
        sa.Column("default_tags", sa.String(), nullable=True),
        sa.Column("expected_speakers", sa.JSON(), nullable=True),
        sa.Column("summary_sections", sa.JSON(), nullable=True),
        sa.Column("action_item_categories", sa.JSON(), nullable=True),
        sa.Column("custom_summary_prompt", sa.Text(), nullable=True),
        sa.Column("custom_action_item_prompt", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meeting_templates_name", "meeting_templates", ["name"])
    op.create_index("ix_meeting_templates_template_type", "meeting_templates", ["template_type"])
    op.create_index("ix_meeting_templates_is_default", "meeting_templates", ["is_default"])
    op.create_index("ix_meeting_templates_is_active", "meeting_templates", ["is_active"])
    op.create_index("ix_meeting_templates_usage_count", "meeting_templates", ["usage_count"])
    op.create_index("ix_meeting_templates_created_at", "meeting_templates", ["created_at"])
    op.create_index("idx_template_type_active", "meeting_templates", ["template_type", "is_active"])
    op.create_index("idx_template_usage", "meeting_templates", ["usage_count", "is_active"])

    op.create_table(
        "scheduled_meetings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scheduled_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True, server_default=sa.text("60")),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("attendees", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scheduled_meetings_scheduled_time", "scheduled_meetings", ["scheduled_time"])
    op.create_index("idx_scheduled_time_duration", "scheduled_meetings", ["scheduled_time", "duration_minutes"])
