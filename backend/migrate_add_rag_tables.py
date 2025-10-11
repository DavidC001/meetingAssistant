"""Migration script to add RAG-related tables and columns."""

from __future__ import annotations

import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/meeting_assistant")


def execute_sql(conn, statement: str) -> None:
    conn.execute(text(statement))


def migrate():
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        print("Ensuring pgvector extension is installed...")
        execute_sql(conn, "CREATE EXTENSION IF NOT EXISTS vector;")

        print("Creating embedding_configurations table if needed...")
        execute_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS embedding_configurations (
                id SERIAL PRIMARY KEY,
                provider VARCHAR(128) NOT NULL,
                model_name VARCHAR(255) NOT NULL,
                dimension INTEGER NOT NULL,
                base_url TEXT,
                api_key_id INTEGER REFERENCES api_keys(id),
                settings JSONB,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
        )

        print("Creating worker_configuration table if needed...")
        execute_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS worker_configuration (
                id SERIAL PRIMARY KEY,
                max_workers INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
        )

        print("Creating global chat tables if needed...")
        execute_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS global_chat_sessions (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL DEFAULT 'New chat',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
        )
        execute_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS global_chat_messages (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES global_chat_sessions(id) ON DELETE CASCADE,
                role VARCHAR(32) NOT NULL,
                content TEXT NOT NULL,
                sources JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
        )

        print("Creating document_chunks table if needed...")
        execute_sql(
            conn,
            """
            CREATE TABLE IF NOT EXISTS document_chunks (
                id SERIAL PRIMARY KEY,
                meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                attachment_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL,
                content TEXT NOT NULL,
                content_type VARCHAR(64) NOT NULL,
                chunk_index INTEGER NOT NULL,
                metadata JSONB,
                embedding VECTOR,
                embedding_config_id INTEGER NOT NULL REFERENCES embedding_configurations(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
        )
        execute_sql(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_document_chunks_meeting ON document_chunks(meeting_id);"
        )
        execute_sql(
            conn,
            "CREATE INDEX IF NOT EXISTS idx_document_chunks_content_type ON document_chunks(content_type);"
        )

        print("Updating meetings table with embedding status columns...")
        execute_sql(
            conn,
            """
            ALTER TABLE meetings
                ADD COLUMN IF NOT EXISTS embeddings_computed BOOLEAN NOT NULL DEFAULT FALSE;
            """,
        )
        execute_sql(
            conn,
            """
            ALTER TABLE meetings
                ADD COLUMN IF NOT EXISTS embeddings_updated_at TIMESTAMPTZ;
            """,
        )
        execute_sql(
            conn,
            """
            ALTER TABLE meetings
                ADD COLUMN IF NOT EXISTS embedding_config_id INTEGER REFERENCES embedding_configurations(id);
            """,
        )

        conn.commit()
        print("Migration completed successfully.")


if __name__ == "__main__":
    migrate()

