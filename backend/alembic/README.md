# Alembic Database Migrations

This directory contains Alembic database migrations for the Meeting Assistant application.

## Setup

Alembic is already configured and ready to use. The configuration file is `alembic.ini` in the backend directory.

## Using Alembic in Docker

Since the application runs in Docker, all Alembic commands should be executed inside the container.

### Generate a New Migration

To auto-generate a migration based on model changes:

```bash
docker compose exec backend alembic revision --autogenerate -m "Description of changes"
```

### Apply Migrations

To apply all pending migrations:

```bash
docker compose exec backend alembic upgrade head
```

### View Migration History

To see the current migration status:

```bash
docker compose exec backend alembic current
```

To see the migration history:

```bash
docker compose exec backend alembic history --verbose
```

### Rollback Migrations

To downgrade one migration:

```bash
docker compose exec backend alembic downgrade -1
```

To downgrade to a specific revision:

```bash
docker compose exec backend alembic downgrade <revision_id>
```

## Migration Workflow

1. **Make model changes** in `app/modules/*/models.py`
2. **Generate migration**:
   ```bash
   docker compose exec backend alembic revision --autogenerate -m "Add new field to meetings"
   ```
3. **Review the generated migration** in `alembic/versions/`
4. **Edit if necessary** - Alembic may not detect all changes (e.g., data migrations)
5. **Test the migration**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```
6. **Test the downgrade**:
   ```bash
   docker compose exec backend alembic downgrade -1
   docker compose exec backend alembic upgrade head
   ```

## Best Practices

### 1. Always Review Generated Migrations

Alembic's autogenerate is powerful but not perfect. Always review generated migrations for:
- Data type changes
- Index changes
- Constraint changes
- Data migrations (not auto-generated)

### 2. One Migration Per Logical Change

Keep migrations focused on a single logical change for easier rollback and debugging.

### 3. Test Both Upgrade and Downgrade

Always test that your migration can be applied and rolled back successfully.

### 4. Handle Data Migrations Carefully

For data migrations (transforming existing data), use `op.execute()` with raw SQL:

```python
def upgrade():
    # Schema change
    op.add_column('meetings', sa.Column('new_field', sa.String()))

    # Data migration
    op.execute("UPDATE meetings SET new_field = 'default' WHERE new_field IS NULL")

def downgrade():
    op.drop_column('meetings', 'new_field')
```

### 5. Use Batch Operations for SQLite

If testing with SQLite, use batch operations for ALTER TABLE:

```python
with op.batch_alter_table('meetings') as batch_op:
    batch_op.add_column(sa.Column('new_field', sa.String()))
```

## Integration with Startup

The application currently uses `Base.metadata.create_all()` in `main.py` for initial table creation. Once you have migrations:

1. Remove inline migrations from `main.py`
2. Run `alembic upgrade head` during deployment
3. Consider adding a health check endpoint that verifies migration status

## Troubleshooting

### "Target database is not up to date"

This means there are pending migrations. Run:
```bash
docker compose exec backend alembic upgrade head
```

### "Can't locate revision identified by..."

The revision history may be out of sync. Check:
```bash
docker compose exec backend alembic current
docker compose exec backend alembic history
```

### Merge Conflicts in Migration Files

If two developers create migrations simultaneously:
```bash
docker compose exec backend alembic merge <rev1> <rev2> -m "Merge migrations"
```

## Migration Naming Convention

Alembic auto-generates migration filenames with timestamps. The format is:
```
YYYY_MM_DD_HHMM-<revision>_<slug>.py
```

Example:
```
2026_01_28_1430-a1b2c3d4e5f6_add_user_mappings_table.py
```

## Production Deployment

For production deployments:

1. **Never use autogenerate in production** - Generate migrations in development
2. **Test migrations in staging** first
3. **Backup database** before applying migrations
4. **Use transactions** for schema changes (default in PostgreSQL)
5. **Monitor migration duration** for large tables

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [Auto Generating Migrations](https://alembic.sqlalchemy.org/en/latest/autogenerate.html)
