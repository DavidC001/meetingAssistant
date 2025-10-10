"""
Migration script to add audio_filepath column to meetings table.
This field stores the path to the MP3 audio file for playback.
"""

import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration():
    """Add audio_filepath column to meetings table if it doesn't exist."""
    
    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        return False
    
    print(f"Connecting to database...")
    engine = create_engine(database_url)
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='meetings' AND column_name='audio_filepath';
            """))
            
            if result.fetchone():
                print("Column 'audio_filepath' already exists in meetings table.")
                return True
            
            # Add the column
            print("Adding 'audio_filepath' column to meetings table...")
            conn.execute(text("""
                ALTER TABLE meetings 
                ADD COLUMN audio_filepath VARCHAR(255) NULL;
            """))
            conn.commit()
            
            print("✓ Migration completed successfully!")
            print("  - Added 'audio_filepath' column to meetings table")
            return True
            
    except Exception as e:
        print(f"ERROR during migration: {e}")
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    print("=" * 60)
    print("Audio Filepath Migration")
    print("=" * 60)
    
    success = run_migration()
    
    if success:
        print("\n✓ Migration completed successfully!")
    else:
        print("\n✗ Migration failed!")
        sys.exit(1)
