"""
Demo script to show the difference between old and new transcript formats.
Run this to see a before/after comparison.

Usage:
    python -m backend.app.scripts.demo_transcript_format
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

try:
    # Try Docker/production import path first
    from app.core.transcript_formatter import (
        format_transcript_grouped,
        convert_old_transcript_format
    )
except ImportError:
    # Fallback to development import path
    from backend.app.core.transcript_formatter import (
        format_transcript_grouped,
        convert_old_transcript_format
    )


def print_comparison():
    """Show side-by-side comparison of old vs new format."""
    
    # Sample data from the original issue
    results = [
        {"speaker": "Fausto Giunchiglia", "start": 0.03, "end": 2.88, "text": "E' una figata, capito? E' girag."},
        {"speaker": "Fausto Giunchiglia", "start": 3.54, "end": 6.12, "text": "che è il tirac, il moderno."},
        {"speaker": "Fausto Giunchiglia", "start": 6.41, "end": 9.23, "text": "Lo decomponiamo in questa maniera, vai su."},
        {"speaker": "Fausto Giunchiglia", "start": 10.24, "end": 10.98, "text": "Prezzi giù."},
        {"speaker": "Fausto Giunchiglia", "start": 11.74, "end": 12.47, "text": "Grazie mille"},
        {"speaker": "Fausto Giunchiglia", "start": 12.81, "end": 13.29, "text": "rispondi"},
        {"speaker": "Fausto Giunchiglia", "start": 14.61, "end": 16.08, "text": "Ora, perché questo è importante?"},
        {"speaker": "Fausto Giunchiglia", "start": 16.38, "end": 17.73, "text": "Perché abbiamo quattro tasche."},
        {"speaker": "Fausto Giunchiglia", "start": 18.95, "end": 19.13, "text": "Grazie."},
        {"speaker": "Fausto Giunchiglia", "start": 20.26, "end": 20.84, "text": "Capisci?"},
    ]
    
    # Generate old format (what the system used to produce)
    old_format = "\n".join([
        f"{r['speaker']} ({r['start']:.2f}s - {r['end']:.2f}s): {r['text']}"
        for r in results
    ])
    
    # Generate new format
    new_format = format_transcript_grouped(results)
    
    # Print comparison
    print("=" * 80)
    print("TRANSCRIPT FORMAT COMPARISON")
    print("=" * 80)
    print()
    
    print("OLD FORMAT (with timestamps, repeated speakers):")
    print("-" * 80)
    print(old_format)
    print()
    
    print("NEW FORMAT (no timestamps, grouped speakers):")
    print("-" * 80)
    print(new_format)
    print()
    
    # Calculate statistics
    old_lines = len(old_format.split('\n'))
    new_lines = len(new_format.split('\n'))
    old_chars = len(old_format)
    new_chars = len(new_format)
    reduction = ((old_chars - new_chars) / old_chars) * 100
    
    print("=" * 80)
    print("STATISTICS")
    print("=" * 80)
    print(f"Old format: {old_lines} lines, {old_chars} characters")
    print(f"New format: {new_lines} lines, {new_chars} characters")
    print(f"Reduction:  {old_lines - new_lines} lines, {old_chars - new_chars} characters ({reduction:.1f}%)")
    print()
    
    # Show benefits
    print("=" * 80)
    print("BENEFITS")
    print("=" * 80)
    print("✅ Cleaner and more readable for users")
    print("✅ Less cluttered interface")
    print(f"✅ {reduction:.1f}% reduction in text size")
    print("✅ Better for LLM processing (fewer tokens)")
    print("✅ Improved embedding quality (more coherent chunks)")
    print("✅ Easier to scan and understand")
    print()


def demo_conversion():
    """Show conversion of existing transcript."""
    
    old_transcript = """John Doe (0.00s - 2.50s): Hello everyone, welcome to the meeting.
John Doe (2.60s - 5.20s): Today we'll discuss the project timeline.
Jane Smith (5.50s - 8.00s): Thanks John.
Jane Smith (8.10s - 11.30s): I've prepared some slides for our review.
John Doe (11.50s - 14.00s): Great, let's take a look."""
    
    new_transcript = convert_old_transcript_format(old_transcript)
    
    print("=" * 80)
    print("MIGRATION EXAMPLE")
    print("=" * 80)
    print()
    
    print("BEFORE (existing transcript):")
    print("-" * 80)
    print(old_transcript)
    print()
    
    print("AFTER (migrated transcript):")
    print("-" * 80)
    print(new_transcript)
    print()


def main():
    """Main entry point."""
    print()
    print("🎯 Transcript Format Improvement Demo")
    print()
    
    print_comparison()
    print()
    
    demo_conversion()
    
    print("=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print()
    print("1. Review the documentation:")
    print("   - docs/TRANSCRIPT_FORMAT_SUMMARY.md")
    print("   - docs/TRANSCRIPT_MIGRATION_QUICKSTART.md")
    print()
    print("2. Test the migration (dry run):")
    print("   python -m backend.app.scripts.migrate_transcript_format --dry-run")
    print()
    print("3. Run the actual migration:")
    print("   python -m backend.app.scripts.migrate_transcript_format")
    print()
    print("4. Verify results in the UI")
    print()


if __name__ == "__main__":
    main()
