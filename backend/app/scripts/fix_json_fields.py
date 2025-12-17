"""
Script to fix JSON fields that were incorrectly imported as strings.

This script fixes the settings field in embedding_configurations that
may have been stored as JSON strings instead of proper JSON objects.
"""

import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from modules.settings.models import EmbeddingConfiguration


def fix_json_fields():
    """Fix JSON fields stored as strings."""
    db = SessionLocal()
    try:
        # Get all embedding configurations
        configs = db.query(EmbeddingConfiguration).all()
        
        fixed_count = 0
        for config in configs:
            if config.settings and isinstance(config.settings, str):
                try:
                    # Try to parse the string as JSON
                    parsed = json.loads(config.settings)
                    config.settings = parsed
                    fixed_count += 1
                    print(f"Fixed config {config.id}: {config.provider}/{config.model_name}")
                except json.JSONDecodeError:
                    print(f"Warning: Could not parse settings for config {config.id}")
                except Exception as e:
                    print(f"Error fixing config {config.id}: {e}")
        
        if fixed_count > 0:
            db.commit()
            print(f"\nFixed {fixed_count} embedding configuration(s)")
        else:
            print("No configurations needed fixing")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Fixing JSON fields in database...")
    fix_json_fields()
