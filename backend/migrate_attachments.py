"""
Migration script to add the attachments table to the database.

This script adds support for file attachments to meetings.
"""

import os
import sys
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.database import engine
from app.models import Base

def create_attachments_table():
    """Create the attachments table if it doesn't exist."""
    
    # Check if table already exists
    with engine.connect() as conn:
        result = conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attachments')"
        ))
        exists = result.scalar()
        
        if exists:
            print("✓ Attachments table already exists. Skipping creation.")
            return
    
    # Create the attachments table
    print("Creating attachments table...")
    
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE attachments (
                id SERIAL PRIMARY KEY,
                meeting_id INTEGER NOT NULL,
                filename VARCHAR NOT NULL,
                filepath VARCHAR NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type VARCHAR NOT NULL,
                uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                CONSTRAINT fk_meeting
                    FOREIGN KEY(meeting_id)
                    REFERENCES meetings(id)
                    ON DELETE CASCADE
            )
        """))
        
        # Create index for faster lookups
        conn.execute(text("""
            CREATE INDEX idx_attachments_meeting_id ON attachments(meeting_id)
        """))
    
    print("✓ Attachments table created successfully!")

def create_attachments_directory():
    """Create the attachments directory if it doesn't exist."""
    
    uploads_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
    attachments_dir = uploads_dir / "attachments"
    
    attachments_dir.mkdir(parents=True, exist_ok=True)
    print(f"✓ Attachments directory created at: {attachments_dir}")

if __name__ == "__main__":
    print("Starting attachments migration...")
    print("-" * 50)
    
    try:
        create_attachments_table()
        create_attachments_directory()
        
        print("-" * 50)
        print("✓ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n✗ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
