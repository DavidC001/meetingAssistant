"""
Migration script to add notes field to meetings table.
"""
import os
import sys
from sqlalchemy import create_engine, text

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/mydatabase")

def migrate():
    """Add notes column to meetings table."""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='meetings' AND column_name='notes';
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            print("Adding notes column to meetings table...")
            conn.execute(text("""
                ALTER TABLE meetings 
                ADD COLUMN notes TEXT;
            """))
            conn.commit()
            print("✓ Successfully added notes column")
        else:
            print("✓ Notes column already exists")
    
    print("\nMigration completed!")

if __name__ == "__main__":
    migrate()
