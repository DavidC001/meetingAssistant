"""
Database migration script to add calendar support fields for PostgreSQL.

This script adds the new fields required for the calendar feature
to the existing PostgreSQL database.

Run this script if you have existing data and don't want to reset your database.
"""

import os
import sys
import psycopg2
from psycopg2 import sql

def get_db_connection():
    """Get PostgreSQL database connection from environment variables."""
    database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@db/mydatabase')
    
    # Parse the database URL
    # Format: postgresql://user:password@host:port/database
    if database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', '')
    
    parts = database_url.split('@')
    if len(parts) != 2:
        raise ValueError(f"Invalid DATABASE_URL format: {database_url}")
    
    user_pass = parts[0].split(':')
    host_db = parts[1].split('/')
    
    user = user_pass[0] if len(user_pass) > 0 else 'user'
    password = user_pass[1] if len(user_pass) > 1 else 'password'
    
    host_port = host_db[0].split(':')
    host = host_port[0] if len(host_port) > 0 else 'db'
    port = host_port[1] if len(host_port) > 1 else '5432'
    database = host_db[1] if len(host_db) > 1 else 'mydatabase'
    
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def column_exists(cursor, table_name, column_name):
    """Check if a column exists in a table."""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = %s AND column_name = %s
        )
    """, (table_name, column_name))
    return cursor.fetchone()[0]

def table_exists(cursor, table_name):
    """Check if a table exists."""
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_name = %s
        )
    """, (table_name,))
    return cursor.fetchone()[0]

def migrate_database():
    """Add calendar support fields to the database."""
    
    print("=" * 60)
    print("Meeting Assistant - Calendar Feature Migration (PostgreSQL)")
    print("=" * 60)
    print()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        migrations_needed = []
        
        # Check and add calendar sync fields to action_items
        print("Checking action_items table...")
        
        if not column_exists(cursor, 'action_items', 'google_calendar_event_id'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN google_calendar_event_id VARCHAR"
            )
        
        if not column_exists(cursor, 'action_items', 'synced_to_calendar'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN synced_to_calendar BOOLEAN DEFAULT FALSE"
            )
        
        if not column_exists(cursor, 'action_items', 'last_synced_at'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN last_synced_at TIMESTAMP"
            )
        
        if not column_exists(cursor, 'action_items', 'status'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN status VARCHAR DEFAULT 'pending'"
            )
        
        if not column_exists(cursor, 'action_items', 'priority'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN priority VARCHAR"
            )
        
        if not column_exists(cursor, 'action_items', 'notes'):
            migrations_needed.append(
                "ALTER TABLE action_items ADD COLUMN notes TEXT"
            )
        
        # Check and create google_calendar_credentials table
        print("Checking google_calendar_credentials table...")
        
        if not table_exists(cursor, 'google_calendar_credentials'):
            migrations_needed.append("""
                CREATE TABLE google_calendar_credentials (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR DEFAULT 'default',
                    credentials_json TEXT NOT NULL,
                    calendar_id VARCHAR DEFAULT 'primary',
                    is_active BOOLEAN DEFAULT TRUE,
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
            # Truncate long SQL for display
            display_sql = migration.strip().replace('\n', ' ')[:80]
            print(f"  [{i}/{len(migrations_needed)}] {display_sql}...")
            cursor.execute(migration)
        
        conn.commit()
        print("\n✓ Migration completed successfully!")
        print("\nNew features added:")
        print("  - Action item status tracking (pending, in_progress, completed, cancelled)")
        print("  - Priority levels (low, medium, high)")
        print("  - Notes field for additional context")
        print("  - Google Calendar synchronization support")
        print("\nNext steps:")
        print("1. Configure Google Calendar credentials in .env file:")
        print("   - GOOGLE_CLIENT_ID")
        print("   - GOOGLE_CLIENT_SECRET")
        print("   - GOOGLE_REDIRECT_URI")
        print("2. Restart the backend server")
        print("3. Navigate to the Calendar tab in the web interface")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate_database()
