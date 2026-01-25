import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import {
  Box,
  Container,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ThemeProvider } from './contexts/ThemeContext';
import MeetingsDashboard from './components/MeetingsDashboard';
import MeetingsBrowser from './components/MeetingsBrowser';
import MeetingDetails from './components/MeetingDetails';
import Settings from './components/Settings';
import Calendar from './components/Calendar';
import GlobalChat from './components/GlobalChat';
import ScheduledMeetings from './components/ScheduledMeetings';
import MeetingsGraph from './components/MeetingsGraph';
import MeetingTemplates from './components/MeetingTemplates';
import KanbanBoard from './components/KanbanBoard';
import Sidebar from './components/layout/Sidebar';
import AppHeader from './components/layout/AppHeader';
import PageTransition from './components/common/PageTransition';

function AppContent() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  // Determine sidebar variant and collapsed state
  const sidebarVariant = isMobile ? 'temporary' : 'permanent';
  const sidebarCollapsed = isTablet;

  const drawerWidth = sidebarCollapsed ? 72 : 280;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Header */}
      <AppHeader onMenuClick={handleDrawerToggle} />

      {/* Sidebar Navigation */}
      <Sidebar
        open={mobileOpen}
        onClose={handleDrawerClose}
        variant={sidebarVariant}
        collapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: { xs: '56px', md: '64px' }, // Account for AppBar height
          pl: isMobile ? 0 : `${drawerWidth}px`,
          transition: theme.transitions.create(['padding-left'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            mt: { xs: 2, md: 4 },
            mb: 4,
            px: { xs: 2, sm: 3, md: 4 },
          }}
        >
          <Routes>
            <Route path="/" element={<PageTransition><MeetingsDashboard /></PageTransition>} />
            <Route path="/meetings/browse" element={<PageTransition><MeetingsBrowser /></PageTransition>} />
            <Route path="/meetings/:meetingId" element={<PageTransition><MeetingDetails /></PageTransition>} />
            <Route path="/global-chat" element={<PageTransition><GlobalChat /></PageTransition>} />
            <Route path="/scheduled-meetings" element={<PageTransition><ScheduledMeetings /></PageTransition>} />
            <Route path="/graph" element={<PageTransition><MeetingsGraph /></PageTransition>} />
            <Route path="/calendar" element={<PageTransition><Calendar /></PageTransition>} />
            <Route path="/kanban" element={<PageTransition><KanbanBoard /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
            <Route path="/templates" element={<PageTransition><MeetingTemplates /></PageTransition>} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
