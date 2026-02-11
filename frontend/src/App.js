import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Container, useMediaQuery, useTheme } from '@mui/material';
import { ThemeProvider } from './contexts/ThemeContext';
import {
  MeetingsDashboard,
  MeetingsBrowser,
  MeetingDetails,
  MeetingsGraph,
} from './components/features/meetings';
import { Settings } from './components/features/settings';
import { Calendar } from './components/features/calendar';
import { GlobalChat } from './components/features/chat';
import { KanbanBoard } from './components/features/kanban';
import { Diary, DiaryReminder, DiaryStatistics } from './components/features/diary';
import {
  ProjectsManager,
  ProjectDashboard,
  ProjectMeetings,
  ProjectActionItems,
  ProjectTeam,
  ProjectAnalytics,
  ProjectChat,
  ProjectNotes,
  ProjectMilestones,
  ProjectSettings,
} from './components/features/projects';
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
          {/* Diary Reminder Modal */}
          <DiaryReminder />

          <Routes>
            <Route
              path="/"
              element={
                <PageTransition>
                  <MeetingsDashboard />
                </PageTransition>
              }
            />
            <Route
              path="/meetings/browse"
              element={
                <PageTransition>
                  <MeetingsBrowser />
                </PageTransition>
              }
            />
            <Route
              path="/meetings/:meetingId"
              element={
                <PageTransition>
                  <MeetingDetails />
                </PageTransition>
              }
            />
            <Route
              path="/global-chat"
              element={
                <PageTransition>
                  <GlobalChat />
                </PageTransition>
              }
            />
            <Route
              path="/graph"
              element={
                <PageTransition>
                  <MeetingsGraph />
                </PageTransition>
              }
            />
            <Route
              path="/calendar"
              element={
                <PageTransition>
                  <Calendar />
                </PageTransition>
              }
            />
            <Route
              path="/kanban"
              element={
                <PageTransition>
                  <KanbanBoard allowEdit allowDelete />
                </PageTransition>
              }
            />
            <Route
              path="/diary"
              element={
                <PageTransition>
                  <Diary />
                </PageTransition>
              }
            />
            <Route
              path="/diary/statistics"
              element={
                <PageTransition>
                  <DiaryStatistics />
                </PageTransition>
              }
            />
            <Route
              path="/projects"
              element={
                <PageTransition>
                  <ProjectsManager />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <PageTransition>
                  <ProjectDashboard />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/meetings"
              element={
                <PageTransition>
                  <ProjectMeetings />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/action-items"
              element={
                <PageTransition>
                  <ProjectActionItems />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/team"
              element={
                <PageTransition>
                  <ProjectTeam />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/chat"
              element={
                <PageTransition>
                  <ProjectChat />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/analytics"
              element={
                <PageTransition>
                  <ProjectAnalytics />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/settings"
              element={
                <PageTransition>
                  <ProjectSettings />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/notes"
              element={
                <PageTransition>
                  <ProjectNotes />
                </PageTransition>
              }
            />
            <Route
              path="/projects/:projectId/milestones"
              element={
                <PageTransition>
                  <ProjectMilestones />
                </PageTransition>
              }
            />
            <Route
              path="/settings"
              element={
                <PageTransition>
                  <Settings />
                </PageTransition>
              }
            />
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
