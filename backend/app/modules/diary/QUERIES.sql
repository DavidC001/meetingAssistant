-- Example SQL Queries for Daily Diary Feature
-- Use these queries for testing and debugging

-- =====================================================
-- QUERY EXAMPLES
-- =====================================================

-- 1. View all diary entries
SELECT 
    id,
    date,
    SUBSTRING(content, 1, 50) as content_preview,
    mood,
    highlights,
    blockers,
    created_at,
    updated_at,
    reminder_dismissed,
    is_work_day
FROM diary_entries
ORDER BY date DESC;

-- 2. View diary entries for current month
SELECT 
    id,
    date,
    mood,
    highlights,
    blockers,
    created_at
FROM diary_entries
WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
  AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY date DESC;

-- 3. Count entries by mood
SELECT 
    mood,
    COUNT(*) as count
FROM diary_entries
WHERE mood IS NOT NULL
GROUP BY mood
ORDER BY count DESC;

-- 4. Find missing work days (no diary entry)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date AS date
),
work_days AS (
    SELECT date
    FROM date_series
    WHERE EXTRACT(DOW FROM date) BETWEEN 1 AND 5  -- Mon-Fri
)
SELECT wd.date
FROM work_days wd
LEFT JOIN diary_entries de ON wd.date = de.date
WHERE de.id IS NULL
ORDER BY wd.date DESC;

-- 5. View diary entries with action item counts
SELECT 
    de.date,
    de.mood,
    COUNT(DISTINCT dais.action_item_id) as action_items_count
FROM diary_entries de
LEFT JOIN diary_action_item_snapshots dais ON de.id = dais.diary_entry_id
GROUP BY de.id, de.date, de.mood
ORDER BY de.date DESC;

-- 6. View action item snapshots for a specific date
SELECT 
    de.date,
    ai.task,
    ai.owner,
    dais.previous_status,
    dais.current_status,
    dais.status_changed_at,
    dais.notes
FROM diary_entries de
JOIN diary_action_item_snapshots dais ON de.id = dais.diary_entry_id
JOIN action_items ai ON dais.action_item_id = ai.id
WHERE de.date = '2026-01-27'  -- Change to your date
ORDER BY ai.task;

-- 7. Find entries with highlights or blockers
SELECT 
    date,
    mood,
    ARRAY_LENGTH(highlights, 1) as highlights_count,
    ARRAY_LENGTH(blockers, 1) as blockers_count
FROM diary_entries
WHERE highlights IS NOT NULL OR blockers IS NOT NULL
ORDER BY date DESC;

-- 8. Most productive days (most completed action items)
SELECT 
    de.date,
    de.mood,
    COUNT(DISTINCT dais.action_item_id) as completed_items
FROM diary_entries de
JOIN diary_action_item_snapshots dais ON de.id = dais.diary_entry_id
WHERE dais.current_status = 'completed'
GROUP BY de.id, de.date, de.mood
ORDER BY completed_items DESC
LIMIT 10;

-- 9. Entries that need attention (dismissed reminders but no content)
SELECT 
    date,
    reminder_dismissed,
    CASE 
        WHEN content IS NULL OR content = '' THEN 'Empty'
        ELSE 'Has content'
    END as content_status
FROM diary_entries
WHERE reminder_dismissed = TRUE
  AND (content IS NULL OR content = '')
ORDER BY date DESC;

-- 10. Weekly summary
SELECT 
    DATE_TRUNC('week', date) as week_start,
    COUNT(*) as entries_count,
    COUNT(CASE WHEN mood = 'productive' THEN 1 END) as productive_days,
    COUNT(CASE WHEN mood = 'challenging' THEN 1 END) as challenging_days
FROM diary_entries
WHERE date >= CURRENT_DATE - INTERVAL '12 weeks'
GROUP BY DATE_TRUNC('week', date)
ORDER BY week_start DESC;

-- =====================================================
-- SAMPLE DATA INSERTION
-- =====================================================

-- Insert a sample diary entry
INSERT INTO diary_entries (date, content, mood, highlights, blockers, is_work_day)
VALUES (
    CURRENT_DATE,
    '# Daily Diary - ' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') || E'\n\n## Summary\n\nToday was productive!',
    'productive',
    '["Completed feature X", "Fixed critical bug", "Helped team member"]'::json,
    '["Slow CI/CD pipeline"]'::json,
    TRUE
)
ON CONFLICT (date) DO NOTHING;

-- Insert multiple sample entries for the past week
INSERT INTO diary_entries (date, content, mood, is_work_day)
SELECT 
    date,
    '# Daily Diary - ' || TO_CHAR(date, 'YYYY-MM-DD') || E'\n\nSample entry.',
    CASE (RANDOM() * 3)::INT
        WHEN 0 THEN 'productive'
        WHEN 1 THEN 'normal'
        WHEN 2 THEN 'challenging'
        ELSE 'productive'
    END,
    EXTRACT(DOW FROM date) BETWEEN 1 AND 5
FROM generate_series(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::interval
) AS date
WHERE EXTRACT(DOW FROM date) BETWEEN 1 AND 5  -- Only work days
ON CONFLICT (date) DO NOTHING;

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Delete old diary entries (older than 1 year)
-- DELETE FROM diary_entries WHERE date < CURRENT_DATE - INTERVAL '1 year';

-- Remove entries with no content and dismissed reminders (older than 30 days)
-- DELETE FROM diary_entries 
-- WHERE (content IS NULL OR content = '')
--   AND reminder_dismissed = TRUE
--   AND date < CURRENT_DATE - INTERVAL '30 days';

-- Reset reminder dismissal for all entries
-- UPDATE diary_entries SET reminder_dismissed = FALSE;

-- =====================================================
-- ANALYTICS QUERIES
-- =====================================================

-- Average entries per month
SELECT 
    DATE_TRUNC('month', date) as month,
    COUNT(*) as entries_count
FROM diary_entries
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Mood distribution
SELECT 
    mood,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM diary_entries
WHERE mood IS NOT NULL
GROUP BY mood
ORDER BY count DESC;

-- Completion rate (entries vs work days)
WITH work_days AS (
    SELECT COUNT(*) as total_work_days
    FROM generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE,
        '1 day'::interval
    ) AS date
    WHERE EXTRACT(DOW FROM date) BETWEEN 1 AND 5
),
entries AS (
    SELECT COUNT(*) as total_entries
    FROM diary_entries
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      AND is_work_day = TRUE
)
SELECT 
    total_entries,
    total_work_days,
    ROUND((total_entries::numeric / total_work_days::numeric) * 100, 2) as completion_percentage
FROM entries, work_days;

-- =====================================================
-- DEBUGGING QUERIES
-- =====================================================

-- Check for orphaned action item snapshots
SELECT dais.*
FROM diary_action_item_snapshots dais
LEFT JOIN diary_entries de ON dais.diary_entry_id = de.id
WHERE de.id IS NULL;

-- Check for invalid dates (non-work days marked as work days)
SELECT 
    date,
    is_work_day,
    EXTRACT(DOW FROM date) as day_of_week,
    TO_CHAR(date, 'Day') as day_name
FROM diary_entries
WHERE is_work_day = TRUE
  AND EXTRACT(DOW FROM date) NOT BETWEEN 1 AND 5;

-- Find entries created but never updated
SELECT 
    date,
    created_at,
    updated_at,
    CASE 
        WHEN created_at = updated_at THEN 'Never updated'
        ELSE 'Updated'
    END as update_status
FROM diary_entries
ORDER BY date DESC;

-- =====================================================
-- PERFORMANCE QUERIES
-- =====================================================

-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('diary_entries', 'diary_action_item_snapshots')
ORDER BY idx_scan DESC;

-- Table sizes
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('diary_entries', 'diary_action_item_snapshots')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
