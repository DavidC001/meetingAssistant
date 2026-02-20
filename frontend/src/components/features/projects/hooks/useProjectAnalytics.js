import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectService } from '../../../../services';

const useProjectAnalytics = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectResponse, analyticsResponse, activityResponse] = await Promise.all([
        projectService.getProject(projectId),
        projectService.getAnalytics(projectId),
        projectService.getActivity(projectId, 10),
      ]);
      setProject(projectResponse.data);
      setAnalytics(analyticsResponse.data);
      setActivity(activityResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '0';
    return Number(hours).toFixed(1);
  };

  const completionRate = () => {
    if (!analytics || analytics.total_action_items === 0) return 0;
    return Math.round((analytics.completed_action_items / analytics.total_action_items) * 100);
  };

  const milestoneCompletionRate = () => {
    if (!analytics?.milestone_progress?.total) return 0;
    return Math.round(analytics.milestone_progress.completion_rate || 0);
  };

  const meetingsByMonth = (analytics?.meetings_by_month || []).slice(-6);

  return {
    projectId,
    project,
    analytics,
    activity,
    loading,
    error,
    loadAnalytics,
    formatHours,
    completionRate,
    milestoneCompletionRate,
    meetingsByMonth,
    navigate,
  };
};

export default useProjectAnalytics;
