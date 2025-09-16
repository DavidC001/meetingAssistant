"""
Database migration script to add chat_messages table
Run this script to update the database schema
"""

from sqlalchemy import create_engine, text
import os

def run_migration():
    # Get database URL from environment or use default
    database_url = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    
    engine = create_engine(database_url)
    
    # Create chat_messages table
    migration_sql = """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        role VARCHAR NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings (id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_chat_messages_meeting_id ON chat_messages(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
    """
    
    with engine.begin() as conn:
        conn.execute(text(migration_sql))
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
