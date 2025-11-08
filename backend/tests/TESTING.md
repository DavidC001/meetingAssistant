# Testing Transcript Formatter

## Running the Tests

### Using pytest directly
```bash
cd backend
python -m pytest tests/test_transcript_formatter.py -v
```

### Run specific test
```bash
python -m pytest tests/test_transcript_formatter.py::test_format_transcript_grouped_basic -v
```

### Run with coverage
```bash
python -m pytest tests/test_transcript_formatter.py --cov=app.core.transcript_formatter --cov-report=html
```

## Test Coverage

The test suite covers:

### Format Transcript Grouped
- ✅ Basic grouping of consecutive speakers
- ✅ Multiple speaker changes
- ✅ Empty results
- ✅ Empty text filtering
- ✅ Unordered results (sorting)
- ✅ Real-world example from issue

### Convert Old Transcript Format
- ✅ Basic conversion with timestamps
- ✅ Multiple speaker groups
- ✅ Already-new format (passthrough)
- ✅ Empty input
- ✅ Whitespace handling

### Update Speaker Name
- ✅ Simple format updates
- ✅ Old format with timestamps
- ✅ Multiple occurrences
- ✅ Empty inputs
- ✅ Special characters in names

## Manual Testing

### Test New Transcript Generation
1. Upload a new meeting file
2. Wait for processing
3. View transcript - should be in new format (no timestamps)
4. Verify consecutive same-speaker utterances are grouped

### Test Speaker Renaming
1. Open a meeting with transcript
2. Rename a speaker (e.g., SPEAKER_00 → John Doe)
3. Verify all occurrences in transcript are updated
4. Check action items are also updated

### Test Migration Script
1. Backup database first!
2. Run with --dry-run to preview
3. Verify output shows correct transformations
4. Run without --dry-run to apply
5. Verify transcripts in UI look correct

### Test Chat Functionality
1. Open chat with a migrated meeting
2. Ask questions about the content
3. Verify responses are accurate
4. Check that references make sense

## Expected Results

### Format Validation
New transcripts should follow this pattern:
```
SpeakerName: Text here. More text. Even more text.
DifferentSpeaker: Their text here.
SpeakerName: Back to first speaker.
```

### No Timestamps
Lines should NOT contain patterns like:
- `(0.03s - 2.88s)`
- `(123.45s - 678.90s)`

### Grouped Speakers
Consecutive lines from the same speaker should be combined:
```
❌ WRONG:
Speaker1: First.
Speaker1: Second.
Speaker1: Third.

✅ CORRECT:
Speaker1: First. Second. Third.
```

## Troubleshooting

### Import Errors
If you get import errors:
```bash
# Make sure you're in the backend directory
cd backend

# Set PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Or on Windows
set PYTHONPATH=%PYTHONPATH%;%cd%
```

### Missing Dependencies
```bash
pip install pytest pytest-cov
```

### Database Connection Issues
The unit tests don't require database connection - they test the formatting logic in isolation.

For integration testing with database, use the migration script in dry-run mode.
