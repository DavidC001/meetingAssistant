"""dedupe transcriptions per meeting and canonicalise action item status

Reprocessing a meeting used to INSERT a second transcription row rather than reusing the
existing one, so some meetings accumulated two or three. Because Meeting.transcription is
uselist=False the ORM cascade only ever reached one of them, and deleting such a meeting
failed on transcriptions_meeting_id_fkey.

This migration keeps the newest transcription per meeting, re-parents the action items from
the older rows onto it (so edited statuses are preserved rather than deleted), removes the
now-empty older rows, and adds a unique constraint so a meeting can never have more than one
transcription again.

It also folds the hyphenated "in-progress" status into the underscore "in_progress" form.
Both spellings had reached the column, and queries were split between them -- the diary
looked for "in-progress" while the calendar, gantt and upcoming queries looked for
"in_progress" -- so each view saw only part of the data.

Revision ID: 009
Revises: 008
Create Date: 2026-09-02
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()

    # Re-parent action items from superseded transcriptions onto the newest one for the
    # same meeting. Done before deleting anything so no user-edited item is lost.
    connection.execute(
        sa.text(
            """
            UPDATE action_items a
            SET transcription_id = newest.keep_id
            FROM (
                SELECT t.id AS old_id,
                       first_value(t.id) OVER (
                           PARTITION BY t.meeting_id ORDER BY t.id DESC
                       ) AS keep_id
                FROM transcriptions t
                WHERE t.meeting_id IS NOT NULL
            ) AS newest
            WHERE a.transcription_id = newest.old_id
              AND newest.old_id <> newest.keep_id
        """
        )
    )

    # The older rows are now empty of action items; drop them.
    connection.execute(
        sa.text(
            """
            DELETE FROM transcriptions t
            WHERE t.meeting_id IS NOT NULL
              AND t.id <> (
                  SELECT max(t2.id) FROM transcriptions t2 WHERE t2.meeting_id = t.meeting_id
              )
        """
        )
    )

    # Guarantee one transcription per meeting from here on. NULL meeting_id is still allowed
    # and is not constrained (NULLs are distinct under a unique constraint in Postgres).
    op.create_unique_constraint("uq_transcriptions_meeting_id", "transcriptions", ["meeting_id"])

    # Fold the display spelling back into the stored one.
    connection.execute(sa.text("UPDATE action_items SET status = 'in_progress' WHERE status = 'in-progress'"))


def downgrade() -> None:
    op.drop_constraint("uq_transcriptions_meeting_id", "transcriptions", type_="unique")
    # The merged action items and deleted duplicate transcriptions are not restorable, and
    # the two status spellings are not distinguishable after the fact, so neither is reversed.
