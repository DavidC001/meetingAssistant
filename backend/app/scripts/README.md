# Backend Scripts

This directory contains utility scripts for database migrations and system maintenance.

## Available Scripts

### Demo Transcript Format
**File**: `demo_transcript_format.py`

Shows a before/after comparison of the transcript format improvement.

```bash
python -m backend.app.scripts.demo_transcript_format
```

**Purpose**: Visualize the changes before running migration

### Migrate Transcript Format
**File**: `migrate_transcript_format.py`

Migrates existing transcripts from old format (with timestamps) to new format (grouped speakers).

```bash
# Preview changes (recommended first step)
python -m backend.app.scripts.migrate_transcript_format --dry-run

# Run actual migration
python -m backend.app.scripts.migrate_transcript_format
```

**Important**:
- Always backup database first!
- Run dry-run mode first to preview changes
- See `docs/TRANSCRIPT_MIGRATION_QUICKSTART.md` for detailed instructions

## Adding New Scripts

When adding a new script to this directory:

1. **Create the script file**
   ```python
   """
   Brief description of what the script does.

   Usage:
       python -m backend.app.scripts.your_script_name
   """
   ```

2. **Add proper imports**
   ```python
   import sys
   from pathlib import Path

   # Add project root to path
   project_root = Path(__file__).parent.parent.parent.parent
   sys.path.insert(0, str(project_root))

   from backend.app.database import SessionLocal
   # ... other imports
   ```

3. **Include error handling**
   - Use try/except for database operations
   - Provide clear error messages
   - Include rollback logic where appropriate

4. **Add logging**
   ```python
   import logging
   logging.basicConfig(level=logging.INFO)
   logger = logging.getLogger(__name__)
   ```

5. **Support command-line arguments**
   ```python
   import argparse
   parser = argparse.ArgumentParser(description='...')
   parser.add_argument('--dry-run', action='store_true')
   args = parser.parse_args()
   ```

6. **Document the script**
   - Update this README
   - Add detailed documentation in `docs/`
   - Include usage examples

## Best Practices

### Database Operations
- Always provide a dry-run mode
- Include detailed logging
- Use transactions (commit/rollback)
- Close database connections properly

### Safety
- Warn about destructive operations
- Recommend backups
- Validate inputs
- Fail gracefully

### User Experience
- Show progress for long operations
- Provide clear success/error messages
- Include examples in help text
- Display summary statistics

## Running Scripts

### From Backend Directory
```bash
cd backend
python -m app.scripts.script_name
```

### With Docker
```bash
docker-compose exec backend python -m app.scripts.script_name
```

### With Environment Variables
```bash
export DATABASE_URL="postgresql://user:pass@host/db"
python -m backend.app.scripts.script_name
```

## Troubleshooting

### Import Errors
```bash
# Ensure you're in the right directory
cd backend

# Set PYTHONPATH if needed
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

### Database Connection Issues
Check your environment variables:
- `DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

### Permission Issues
Ensure the database user has appropriate permissions for the operations being performed.

## Further Reading

- [Transcript Format Improvement](../../docs/TRANSCRIPT_FORMAT_IMPROVEMENT.md)
- [Migration Quickstart](../../docs/TRANSCRIPT_MIGRATION_QUICKSTART.md)
- [Deployment Checklist](../../docs/DEPLOYMENT_CHECKLIST_TRANSCRIPT_FORMAT.md)
