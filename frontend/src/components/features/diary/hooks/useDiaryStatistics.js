import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import diaryService from '../../../../services/diaryService';

const useDiaryStatistics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, timelineData] = await Promise.all([
        diaryService.getStatisticsSummary(dateRange.start, dateRange.end),
        diaryService.getStatisticsTimeline(dateRange.start, dateRange.end),
      ]);
      setStatistics(statsData);
      setTimeline(timelineData.timeline || []);
    } catch (err) {
      setError(err.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange({ ...dateRange, [field]: value });
  };

  return {
    loading,
    error,
    statistics,
    timeline,
    dateRange,
    loadStatistics,
    handleDateRangeChange,
    navigate,
  };
};

export default useDiaryStatistics;
