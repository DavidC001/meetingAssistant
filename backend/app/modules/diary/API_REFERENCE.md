# Daily Diary API Quick Reference

## Base URL
All endpoints are prefixed with `/api/v1/diary`

---

## Endpoints

### 1. List Diary Entries
**GET** `/entries`

Query Parameters:
- `start_date` (optional): Start date (YYYY-MM-DD)
- `end_date` (optional): End date (YYYY-MM-DD)
- `page` (optional): Page number (default: 1)
- `page_size` (optional): Items per page (default: 50, max: 100)

Response:
```json
{
  "entries": [
    {
      "id": 1,
      "date": "2026-01-27",
      "content": "# Daily Notes...",
      "mood": "productive",
      "highlights": ["Completed feature X"],
      "blockers": ["Waiting for review"],
      "created_at": "2026-01-27T10:00:00Z",
      "updated_at": "2026-01-27T18:00:00Z",
      "reminder_dismissed": false,
      "is_work_day": true
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

---

### 2. Get Diary Entry
**GET** `/entries/{date}`

Path Parameters:
- `date`: Date in YYYY-MM-DD format

Query Parameters:
- `include_action_items` (optional): Include action items summary (default: true)

Response:
```json
{
  "id": 1,
  "date": "2026-01-27",
  "content": "# Daily Notes...",
  "mood": "productive",
  "highlights": ["Completed feature X"],
  "blockers": [],
  "created_at": "2026-01-27T10:00:00Z",
  "updated_at": "2026-01-27T18:00:00Z",
  "reminder_dismissed": false,
  "is_work_day": true,
  "action_items_summary": {
    "date": "2026-01-27",
    "in_progress_items": [...],
    "completed_items": [...],
    "created_items": [...],
    "status_changes": [...]
  }
}
```

---

### 3. Create Diary Entry
**POST** `/entries`

Query Parameters:
- `auto_generate` (optional): Auto-generate content from action items (default: false)

Request Body:
```json
{
  "date": "2026-01-27",
  "content": "# Daily Notes\n\nToday was productive!",
  "mood": "productive",
  "highlights": ["Completed feature X", "Fixed bug Y"],
  "blockers": ["Waiting for API review"]
}
```

Response: Same as Get Diary Entry (without action_items_summary)

Status: `201 Created`

---

### 4. Update Diary Entry
**PUT** `/entries/{date}`

Path Parameters:
- `date`: Date in YYYY-MM-DD format

Request Body:
```json
{
  "content": "# Updated Notes",
  "mood": "challenging",
  "highlights": ["New highlight"],
  "blockers": ["New blocker"],
  "reminder_dismissed": false
}
```

Note: All fields are optional. Only provided fields will be updated.

Response: Updated diary entry

---

### 5. Delete Diary Entry
**DELETE** `/entries/{date}`

Path Parameters:
- `date`: Date in YYYY-MM-DD format

Status: `204 No Content`

---

### 6. Check Reminder
**GET** `/reminder`

Response:
```json
{
  "should_show_reminder": true,
  "missing_date": "2026-01-26",
  "previous_work_day": "2026-01-26",
  "action_items_summary": {
    "date": "2026-01-26",
    "in_progress_items": [
      {
        "id": 45,
        "task": "Review PR #123",
        "owner": "David",
        "status": "in-progress",
        "priority": "high",
        "due_date": null
      }
    ],
    "completed_items": [
      {
        "id": 42,
        "task": "Write documentation",
        "owner": "David",
        "status": "completed",
        "priority": "medium",
        "due_date": null
      }
    ],
    "created_items": [],
    "status_changes": [
      {
        "action_item": {
          "id": 42,
          "task": "Write documentation",
          "owner": "David",
          "status": "completed",
          "priority": "medium",
          "due_date": null
        },
        "from_status": "in-progress",
        "to_status": "completed",
        "changed_at": "2026-01-26T16:30:00Z"
      }
    ]
  }
}
```

When no reminder should be shown:
```json
{
  "should_show_reminder": false,
  "missing_date": null,
  "previous_work_day": null,
  "action_items_summary": null
}
```

---

### 7. Dismiss Reminder
**POST** `/reminder/dismiss`

Request Body:
```json
{
  "date": "2026-01-26"
}
```

Status: `204 No Content`

---

### 8. Get Action Items Summary
**GET** `/entries/{date}/action-items-summary`

Path Parameters:
- `date`: Date in YYYY-MM-DD format

Response:
```json
{
  "date": "2026-01-27",
  "in_progress_items": [
    {
      "id": 45,
      "task": "Review PR #123",
      "owner": "David",
      "status": "in-progress",
      "priority": "high",
      "due_date": "2026-01-30"
    }
  ],
  "completed_items": [
    {
      "id": 42,
      "task": "Write documentation",
      "owner": "David",
      "status": "completed",
      "priority": "medium",
      "due_date": null
    }
  ],
  "created_items": [
    {
      "id": 50,
      "task": "New task",
      "owner": "David",
      "status": "pending",
      "priority": "low",
      "due_date": null
    }
  ],
  "status_changes": [
    {
      "action_item": {
        "id": 42,
        "task": "Write documentation",
        "owner": "David",
        "status": "completed",
        "priority": "medium",
        "due_date": null
      },
      "from_status": "in-progress",
      "to_status": "completed",
      "changed_at": "2026-01-27T15:30:00Z"
    }
  ]
}
```

---

### 9. Snapshot Action Items
**POST** `/entries/{date}/snapshot-action-items`

Path Parameters:
- `date`: Date in YYYY-MM-DD format

Response:
```json
{
  "message": "Snapshot created successfully",
  "entry_id": 1
}
```

Status: `201 Created`

---

## Error Responses

### 404 Not Found
```json
{
  "detail": "Diary entry not found for this date"
}
```

### 400 Bad Request
```json
{
  "detail": "Diary entry already exists for 2026-01-27"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "date"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## Frontend Service Usage

```javascript
import diaryService from './services/diaryService';

// Get entries
const { entries, total } = await diaryService.getEntries({
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  page: 1,
  pageSize: 50
});

// Get single entry
const entry = await diaryService.getEntry('2026-01-27');

// Create entry
const newEntry = await diaryService.createEntry({
  date: '2026-01-27',
  content: 'Daily notes...',
  mood: 'productive',
  highlights: ['Accomplishment 1'],
  blockers: ['Challenge 1']
});

// Create with auto-generate
const autoEntry = await diaryService.createEntry({
  date: '2026-01-27',
  mood: 'productive'
}, true); // auto-generate = true

// Update entry
const updated = await diaryService.updateEntry('2026-01-27', {
  content: 'Updated notes...',
  mood: 'challenging'
});

// Delete entry
await diaryService.deleteEntry('2026-01-27');

// Check reminder
const reminder = await diaryService.checkReminder();

// Dismiss reminder
await diaryService.dismissReminder('2026-01-26');

// Get action items summary
const summary = await diaryService.getActionItemsSummary('2026-01-27');
```

---

## Mood Values

Suggested mood values (customizable):
- `productive` - 😊 Productive
- `normal` - 😐 Normal
- `challenging` - 😓 Challenging
- `frustrated` - 😤 Frustrated

---

## Date Format

All dates must be in **ISO 8601** format: `YYYY-MM-DD`

Examples:
- `2026-01-27`
- `2026-12-31`
- `2026-02-14`

---

## Work Days

Default work days: **Monday to Friday** (weekday 0-4)

To check if a date is a work day, the backend uses Python's `date.weekday()`:
- 0 = Monday
- 1 = Tuesday
- 2 = Wednesday
- 3 = Thursday
- 4 = Friday
- 5 = Saturday
- 6 = Sunday

---

## Reminder Logic

The reminder is shown when:
1. Current day is a work day (Mon-Fri)
2. Previous work day has no diary entry OR has empty content
3. Reminder hasn't been dismissed for that day

The reminder checks on app load via the DiaryReminder component.
