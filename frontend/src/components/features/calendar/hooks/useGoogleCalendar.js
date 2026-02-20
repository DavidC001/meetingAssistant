import { useState, useCallback } from 'react';
import CalendarService from '../../../../services/calendarService';
import logger from '../../../../utils/logger';

/**
 * Manages Google Calendar connection state: auth, connect, disconnect, and sync-all.
 *
 * @param {Object}   params
 * @param {string}   params.filterUserName    - Name used to filter tasks when syncing
 * @param {boolean}  params.syncOnlyMyTasks   - Whether to restrict sync to current user
 * @param {Function} params.showSnackbar      - Callback(message, severity) for notifications
 * @param {Function} params.onSyncComplete    - Callback invoked after sync/disconnect to refresh events
 */
export function useGoogleCalendar({
  filterUserName,
  syncOnlyMyTasks,
  showSnackbar,
  onSyncComplete,
}) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const data = await CalendarService.getGoogleStatus();
      setGoogleConnected(data.is_connected);
      setGoogleEmail(data.email || '');
    } catch (error) {
      logger.error('Error fetching Google Calendar status:', error);
    }
  }, []);

  const handleGoogleConnect = useCallback(async () => {
    try {
      const data = await CalendarService.getGoogleAuthUrl();
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const authWindow = window.open(
        data.auth_url,
        'Google Calendar Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event) => {
        if (event.data.type === 'google-oauth-success') {
          try {
            await CalendarService.authorizeGoogle(event.data.code);
            showSnackbar('Connected to Google Calendar', 'success');
            fetchGoogleStatus();
            authWindow.close();
          } catch (error) {
            logger.error('Error authorizing:', error);
            showSnackbar('Error connecting to Google Calendar', 'error');
          }
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      logger.error('Error getting auth URL:', error);
      showSnackbar('Error initiating Google Calendar connection', 'error');
    }
  }, [fetchGoogleStatus, showSnackbar]);

  const handleGoogleDisconnect = useCallback(async () => {
    try {
      await CalendarService.disconnectGoogle();
      setGoogleConnected(false);
      setGoogleEmail('');
      showSnackbar('Disconnected from Google Calendar', 'success');
      onSyncComplete?.();
    } catch (error) {
      logger.error('Error disconnecting:', error);
      showSnackbar('Error disconnecting from Google Calendar', 'error');
    }
  }, [showSnackbar, onSyncComplete]);

  const handleSyncAll = useCallback(async () => {
    if (!googleConnected) {
      showSnackbar('Please connect to Google Calendar first', 'warning');
      return;
    }
    if (syncOnlyMyTasks && !filterUserName) {
      showSnackbar('Please enter your name to sync your tasks', 'warning');
      return;
    }
    setSyncing(true);
    try {
      const data = await CalendarService.syncAllPending();
      const { synced, skipped, failed } = data;
      let message = `Synced ${synced} item(s) to Google Calendar`;
      if (skipped > 0) message += ` (${skipped} skipped - not assigned to you)`;
      if (failed > 0) message += ` (${failed} failed)`;
      showSnackbar(message, synced > 0 ? 'success' : 'info');
      onSyncComplete?.();
      setSyncDialogOpen(false);
    } catch (error) {
      logger.error('Error syncing all items:', error);
      const errorMsg = error.response?.data?.detail || 'Error syncing items to Google Calendar';
      showSnackbar(errorMsg, 'error');
    } finally {
      setSyncing(false);
    }
  }, [googleConnected, syncOnlyMyTasks, filterUserName, showSnackbar, onSyncComplete]);

  return {
    googleConnected,
    googleEmail,
    syncDialogOpen,
    setSyncDialogOpen,
    syncing,
    fetchGoogleStatus,
    handleGoogleConnect,
    handleGoogleDisconnect,
    handleSyncAll,
  };
}
