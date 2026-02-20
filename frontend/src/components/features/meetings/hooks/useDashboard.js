import { useState, useEffect, useCallback } from 'react';
import { MeetingService } from '../../../../services';

/**
 * Data hook for the MeetingsDashboard.
 * Handles fetching meetings, computing stats, and clock updates.
 */
export const useDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    today: 0,
    thisWeek: 0,
  });

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const meetings = await MeetingService.getAll();

      const recent = meetings
        .filter((m) => m.status === 'completed')
        .sort(
          (a, b) =>
            new Date(b.meeting_date || b.created_at) - new Date(a.meeting_date || a.created_at)
        )
        .slice(0, 5);

      setRecentMeetings(recent);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      setStats({
        total: meetings.length,
        completed: meetings.filter((m) => m.status === 'completed').length,
        processing: meetings.filter((m) => m.status === 'processing').length,
        failed: meetings.filter((m) => m.status === 'failed').length,
        today: meetings.filter((m) => new Date(m.meeting_date || m.created_at) >= todayStart)
          .length,
        thisWeek: meetings.filter((m) => new Date(m.meeting_date || m.created_at) >= weekStart)
          .length,
      });
    } catch {
      // errors are silent — stats stay at defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey, fetchDashboardData]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const formatCurrentTime = () =>
    currentTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return { recentMeetings, loading, stats, formatCurrentTime, refresh };
};
