"""add project note attachments and chunks

Revision ID: 004
Revises: 003
Create Date: 2026-02-07
"""

import pgvector.sqlalchemy
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_note_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("note_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("filepath", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_id"], ["project_notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_note_attachments_project_id", "project_note_attachments", ["project_id"])
    op.create_index("ix_project_note_attachments_note_id", "project_note_attachments", ["note_id"])

    op.create_table(
        "project_document_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("note_id", sa.Integer(), nullable=True),
        sa.Column("attachment_id", sa.Integer(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_metadata", JSONB, nullable=True),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(), nullable=False),
        sa.Column("embedding_config_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["note_id"], ["project_notes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["attachment_id"], ["project_note_attachments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["embedding_config_id"], ["embedding_configurations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_document_chunks_project_id", "project_document_chunks", ["project_id"])
    op.create_index("ix_project_document_chunks_note_id", "project_document_chunks", ["note_id"])
    op.create_index("ix_project_document_chunks_attachment_id", "project_document_chunks", ["attachment_id"])


def downgrade():
    op.drop_index("ix_project_document_chunks_attachment_id", table_name="project_document_chunks")
    op.drop_index("ix_project_document_chunks_note_id", table_name="project_document_chunks")
    op.drop_index("ix_project_document_chunks_project_id", table_name="project_document_chunks")
    op.drop_table("project_document_chunks")

    op.drop_index("ix_project_note_attachments_note_id", table_name="project_note_attachments")
    op.drop_index("ix_project_note_attachments_project_id", table_name="project_note_attachments")
    op.drop_table("project_note_attachments")
