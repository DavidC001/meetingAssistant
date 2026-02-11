"""add project folders junction table

Revision ID: 002
Revises: 001
Create Date: 2026-02-03 19:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create project_folders junction table
    op.create_table(
        "project_folders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("folder_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "folder_name", name="uq_project_folder"),
    )
    op.create_index("ix_project_folders_project_id", "project_folders", ["project_id"])
    op.create_index("ix_project_folders_folder_name", "project_folders", ["folder_name"])

    # Migrate existing data from projects.folder to project_folders
    op.execute(
        """
        INSERT INTO project_folders (project_id, folder_name, created_at)
        SELECT id, folder, created_at FROM projects WHERE folder IS NOT NULL
    """
    )

    # Drop the unique constraint on folder column
    op.drop_constraint("projects_folder_key", "projects", type_="unique")

    # Drop the folder column from projects table
    op.drop_column("projects", "folder")


def downgrade() -> None:
    # Add folder column back
    op.add_column("projects", sa.Column("folder", sa.String(), nullable=True))

    # Migrate data back (taking the first folder for each project)
    op.execute(
        """
        UPDATE projects p
        SET folder = (
            SELECT folder_name FROM project_folders pf
            WHERE pf.project_id = p.id
            ORDER BY pf.created_at
            LIMIT 1
        )
    """
    )

    # Make folder non-nullable and add unique constraint
    op.alter_column("projects", "folder", nullable=False)
    op.create_unique_constraint("projects_folder_key", "projects", ["folder"])

    # Drop project_folders table
    op.drop_index("ix_project_folders_folder_name", "project_folders")
    op.drop_index("ix_project_folders_project_id", "project_folders")
    op.drop_table("project_folders")
