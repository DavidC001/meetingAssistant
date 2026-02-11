"""project meetings and tags

Revision ID: 006
Revises: 005
Create Date: 2026-02-11
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def _insert_project_meeting(connection, project_id: int, meeting_id: int) -> None:
    dialect = connection.dialect.name
    if dialect == "sqlite":
        connection.execute(
            sa.text(
                "INSERT OR IGNORE INTO project_meetings (project_id, meeting_id) " "VALUES (:project_id, :meeting_id)"
            ),
            {"project_id": project_id, "meeting_id": meeting_id},
        )
    else:
        connection.execute(
            sa.text(
                "INSERT INTO project_meetings (project_id, meeting_id) "
                "VALUES (:project_id, :meeting_id) "
                "ON CONFLICT (project_id, meeting_id) DO NOTHING"
            ),
            {"project_id": project_id, "meeting_id": meeting_id},
        )


def upgrade():
    op.create_table(
        "project_meetings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("meeting_id", sa.Integer(), sa.ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "meeting_id", name="uq_project_meeting"),
    )
    op.create_index("ix_project_meetings_project_id", "project_meetings", ["project_id"])
    op.create_index("ix_project_meetings_meeting_id", "project_meetings", ["meeting_id"])

    op.add_column("projects", sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))

    connection = op.get_bind()
    folders = connection.execute(sa.text("SELECT id, project_id, folder_name FROM project_folders")).fetchall()

    for pf in folders:
        meetings = connection.execute(
            sa.text("SELECT id FROM meetings WHERE folder = :fn"),
            {"fn": pf.folder_name},
        ).fetchall()
        for meeting in meetings:
            _insert_project_meeting(connection, pf.project_id, meeting.id)

    op.drop_table("project_folders")


def _insert_project_folder(connection, project_id: int, folder_name: str) -> None:
    dialect = connection.dialect.name
    if dialect == "sqlite":
        connection.execute(
            sa.text(
                "INSERT OR IGNORE INTO project_folders (project_id, folder_name) " "VALUES (:project_id, :folder_name)"
            ),
            {"project_id": project_id, "folder_name": folder_name},
        )
    else:
        connection.execute(
            sa.text(
                "INSERT INTO project_folders (project_id, folder_name) "
                "VALUES (:project_id, :folder_name) "
                "ON CONFLICT (project_id, folder_name) DO NOTHING"
            ),
            {"project_id": project_id, "folder_name": folder_name},
        )


def downgrade():
    op.create_table(
        "project_folders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("folder_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("project_id", "folder_name", name="uq_project_folder"),
    )
    op.create_index("ix_project_folders_project_id", "project_folders", ["project_id"])
    op.create_index("ix_project_folders_folder_name", "project_folders", ["folder_name"])

    connection = op.get_bind()
    rows = connection.execute(
        sa.text(
            "SELECT pm.project_id, m.folder "
            "FROM project_meetings pm "
            "JOIN meetings m ON m.id = pm.meeting_id "
            "WHERE m.folder IS NOT NULL"
        )
    ).fetchall()

    for row in rows:
        _insert_project_folder(connection, row.project_id, row.folder)

    op.drop_index("ix_project_meetings_project_id", table_name="project_meetings")
    op.drop_index("ix_project_meetings_meeting_id", table_name="project_meetings")
    op.drop_table("project_meetings")
    op.drop_column("projects", "tags")
