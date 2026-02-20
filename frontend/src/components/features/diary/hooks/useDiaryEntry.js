import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import diaryService from '../../../../services/diaryService';
import logger from '../../../../utils/logger';

const useDiaryEntry = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(
    searchParams.get('date') ? new Date(searchParams.get('date')) : new Date()
  );
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Form fields
  const [content, setContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [productivity, setProductivity] = useState('');

  // Time tracking
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');

  // Action items
  const [actionItemsExpanded, setActionItemsExpanded] = useState(true);
  const [actionItemsSummary, setActionItemsSummary] = useState(null);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [filterUserName, setFilterUserName] = useState(() => {
    return localStorage.getItem('diaryUserName') || '';
  });

  // DnD
  const [draggedItem, setDraggedItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollIntervalRef = useRef(null);

  // Delete confirm dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('diaryUserName', filterUserName);
  }, [filterUserName]);

  useEffect(() => {
    loadEntry();
    return () => {
      document.removeEventListener('dragover', handleDragOverWithScroll);
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const formatDateForApi = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const loadEntry = async () => {
    try {
      setLoading(true);
      setError(null);
      const dateStr = formatDateForApi(currentDate);
      try {
        const data = await diaryService.getEntry(dateStr, true);
        setEntry(data);
        setContent(data.content || '');
        setProductivity(data.mood || '');
        setArrivalTime(data.arrival_time || '');
        setDepartureTime(data.departure_time || '');
        setHoursWorked(data.hours_worked || '');
        setActionItemsSummary(data.action_items_summary || null);
      } catch (err) {
        if (err.response?.status === 404) {
          setEntry(null);
          const template = await diaryService.getTemplate(dateStr);
          setContent(template);
          setProductivity('');
          setArrivalTime('');
          setDepartureTime('');
          setHoursWorked('');
          try {
            const summary = await diaryService.getActionItemsSummary(dateStr);
            setActionItemsSummary(summary);
          } catch {
            setActionItemsSummary(null);
          }
        } else {
          throw err;
        }
      }
    } catch (err) {
      logger.error('Error loading diary entry:', err);
      setError(err.message || 'Failed to load diary entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      const dateStr = formatDateForApi(currentDate);
      const entryData = {
        date: dateStr,
        content,
        mood: productivity || null,
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        hours_worked: hoursWorked ? parseFloat(hoursWorked) : null,
      };
      if (entry) {
        await diaryService.updateEntry(dateStr, entryData);
        setSuccessMessage('Diary entry updated successfully');
      } else {
        await diaryService.createEntry(entryData);
        setSuccessMessage('Diary entry created successfully');
      }
      await loadEntry();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error('Error saving diary entry:', err);
      setError(err.message || 'Failed to save diary entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleteConfirmOpen(false);
    try {
      setSaving(true);
      setError(null);
      const dateStr = formatDateForApi(currentDate);
      await diaryService.deleteEntry(dateStr);
      setSuccessMessage('Diary entry deleted successfully');
      setEntry(null);
      setContent('');
      setProductivity('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error('Error deleting diary entry:', err);
      setError(err.message || 'Failed to delete diary entry');
    } finally {
      setSaving(false);
    }
  };

  const handlePreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    setSearchParams({ date: formatDateForApi(newDate) });
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
    setSearchParams({ date: formatDateForApi(newDate) });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSearchParams({ date: formatDateForApi(today) });
  };

  const handleDragOverWithScroll = (e) => {
    const scrollThreshold = 100;
    const scrollSpeed = 10;
    const viewportHeight = window.innerHeight;
    const mouseY = e.clientY;
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    if (mouseY < scrollThreshold) {
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, -scrollSpeed);
      }, 20);
    } else if (mouseY > viewportHeight - scrollThreshold) {
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy(0, scrollSpeed);
      }, 20);
    }
  };

  const handleActionItemDragStart = (e, item) => {
    setDraggedItem(item);
    setIsDragging(true);
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
    document.addEventListener('dragover', handleDragOverWithScroll);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setIsDragging(false);
    document.removeEventListener('dragover', handleDragOverWithScroll);
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const handleContentDrop = (e) => {
    e.preventDefault();
    const itemData = e.dataTransfer.getData('application/json');
    if (itemData) {
      const item = JSON.parse(itemData);
      const checkbox = item.status === 'completed' ? 'x' : ' ';
      const reference = `- [${checkbox}] **${item.task}** _(Action Item #${item.id})_`;
      const workedOnPattern = /## Worked on:/i;
      const match = content.match(workedOnPattern);
      if (match) {
        const insertPosition = match.index + match[0].length;
        const afterWorkedOn = content.substring(insertPosition);
        const nextSectionMatch = afterWorkedOn.match(/\n##/);
        const endOfWorkedOn = nextSectionMatch
          ? insertPosition + nextSectionMatch.index
          : content.length;
        let workedOnContent = content.substring(insertPosition, endOfWorkedOn);
        workedOnContent = workedOnContent.replace(
          /\n_Drag action items here from the right panel_/i,
          ''
        );
        const newContent =
          content.substring(0, insertPosition) +
          '\n' +
          reference +
          workedOnContent +
          content.substring(endOfWorkedOn);
        setContent(newContent);
      } else {
        setContent(content + '\n' + reference);
      }
    }
  };

  const handleContentDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const calculateHours = () => {
    if (arrivalTime && departureTime) {
      const [arrHours, arrMins] = arrivalTime.split(':').map(Number);
      const [depHours, depMins] = departureTime.split(':').map(Number);
      const diffMinutes = depHours * 60 + depMins - (arrHours * 60 + arrMins);
      setHoursWorked((diffMinutes / 60).toFixed(2));
    }
  };

  const filterActionItems = (items) => {
    if (!showOnlyMyTasks || !filterUserName) return items;
    return items.filter(
      (item) =>
        item.owner && item.owner.toLowerCase().trim() === filterUserName.toLowerCase().trim()
    );
  };

  return {
    // State
    currentDate,
    entry,
    loading,
    saving,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    content,
    setContent,
    previewMode,
    setPreviewMode,
    productivity,
    setProductivity,
    arrivalTime,
    setArrivalTime,
    departureTime,
    setDepartureTime,
    hoursWorked,
    setHoursWorked,
    actionItemsExpanded,
    setActionItemsExpanded,
    actionItemsSummary,
    showOnlyMyTasks,
    setShowOnlyMyTasks,
    filterUserName,
    setFilterUserName,
    draggedItem,
    isDragging,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    // Derived
    displayDate: formatDisplayDate(currentDate),
    // Handlers
    handleSave,
    handleDeleteConfirmed,
    handlePreviousDay,
    handleNextDay,
    handleToday,
    handleActionItemDragStart,
    handleDragEnd,
    handleContentDrop,
    handleContentDragOver,
    calculateHours,
    filterActionItems,
  };
};

export default useDiaryEntry;
