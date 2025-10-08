"""
Database migration script to add calendar support fields.

This script adds the new fields required for the calendar feature
to the existing database.

Run this script if you have existing data and don't want to reset your database.
"""

import sqlite3
import sys
from pathlib import Path

def migrate_database(db_path: str = "meeting_assistant.db"):
    """Add calendar support fields to the database."""
    
    db_file = Path(db_path)
    if not db_file.exists():
        print(f"Database file not found: {db_path}")
        print("No migration needed - database will be created with new schema.")
        return
    
    print(f"Migrating database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if migrations are needed
        cursor.execute("PRAGMA table_info(action_items)")
        columns = [col[1] for col in cursor.fetchall()]
        
        migrations_needed = []
        
        # Add calendar sync fields to action_items
        if 'google_calendar_event_id' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN google_calendar_event_id VARCHAR"
            )
        
        if 'synced_to_calendar' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN synced_to_calendar BOOLEAN DEFAULT 0"
            )
        
        if 'last_synced_at' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN last_synced_at TIMESTAMP"
            )
        
        if 'status' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN status VARCHAR DEFAULT 'pending'"
            )
        
        if 'priority' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN priority VARCHAR"
            )
        
        if 'notes' not in columns:
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN notes TEXT"
            )
        
        # Create google_calendar_credentials table if it doesn't exist
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='google_calendar_credentials'
        """)
        
        if not cursor.fetchone():
            migrations_needed.append("""
                CREATE TABLE google_calendar_credentials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id VARCHAR DEFAULT 'default',
                    credentials_json TEXT NOT NULL,
                    calendar_id VARCHAR DEFAULT 'primary',
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        
        if not migrations_needed:
            print("✓ Database is already up to date. No migration needed.")
            return
        
        # Execute migrations
        print(f"\nApplying {len(migrations_needed)} migrations:")
        for i, migration in enumerate(migrations_needed, 1):
            print(f"  [{i}/{len(migrations_needed)}] {migration[:80]}...")
            cursor.execute(migration)
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        print("\nNew features added:")
        print("  - Action item status tracking (pending, in_progress, completed, cancelled)")
        print("  - Priority levels (low, medium, high)")
        print("  - Notes field for additional context")
        print("  - Google Calendar sync support")
        print("  - Calendar credentials storage")
        
    except sqlite3.Error as e:
        print(f"\n✗ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    
    finally:
        conn.close()

if __name__ == "__main__":
    # Determine database path
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    else:
        db_path = "meeting_assistant.db"
    
    print("=" * 60)
    print("Meeting Assistant - Calendar Feature Migration")
    print("=" * 60)
    print()
    
    migrate_database(db_path)
    
    print()
    print("Next steps:")
    print("1. Configure Google Calendar credentials in .env file")
    print("2. Restart the backend server")
    print("3. Navigate to the Calendar tab in the web interface")
    print()
