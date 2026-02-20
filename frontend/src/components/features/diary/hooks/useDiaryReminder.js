import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import diaryService from '../../../../services/diaryService';
import logger from '../../../../utils/logger';

const useDiaryReminder = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reminderData, setReminderData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkReminder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkReminder = async () => {
    try {
      setLoading(true);
      const response = await diaryService.checkReminder();
      if (response.should_show_reminder) {
        setReminderData(response);
        setOpen(true);
      }
    } catch (err) {
      logger.error('Error checking diary reminder:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillNow = () => {
    setOpen(false);
    navigate(`/diary?date=${reminderData.missing_date}`);
  };

  const handleRemindLater = () => {
    setOpen(false);
  };

  const handleSkipDay = async () => {
    try {
      await diaryService.dismissReminder(reminderData.missing_date);
      setOpen(false);
    } catch (err) {
      logger.error('Error dismissing reminder:', err);
      setError(err.message);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return {
    open,
    loading,
    reminderData,
    error,
    handleFillNow,
    handleRemindLater,
    handleSkipDay,
    formatDate,
  };
};

export default useDiaryReminder;
