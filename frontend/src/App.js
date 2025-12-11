import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  CalendarMonth as CalendarIcon,
  ChatBubbleOutline as ChatIcon,
  Event as EventIcon,
  AccountTree as GraphIcon,
  FolderOpen as FolderOpenIcon,
  Search as SearchIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Article as TemplatesIcon
} from '@mui/icons-material';
import { ThemeProvider, useThemeMode } from './contexts/ThemeContext';
import MeetingsDashboard from './components/MeetingsDashboard';
import MeetingsBrowser from './components/MeetingsBrowser';
import MeetingDetails from './components/MeetingDetails';
import Settings from './components/Settings';
import Calendar from './components/Calendar';
import GlobalChat from './components/GlobalChat';
import ScheduledMeetings from './components/ScheduledMeetings';
import MeetingsGraph from './components/MeetingsGraph';
import GlobalSearch from './components/GlobalSearch';
import MeetingTemplates from './components/MeetingTemplates';

function NavigationTabs() {
  const location = useLocation();
  const [value, setValue] = React.useState(0);
  const isMobile = useMediaQuery('(max-width:900px)');

  React.useEffect(() => {
    if (location.pathname === '/') setValue(0);
    else if (location.pathname.startsWith('/meetings') && !location.pathname.startsWith('/meetings/browse')) setValue(0);
    else if (location.pathname.startsWith('/meetings/browse')) setValue(1);
    else if (location.pathname.startsWith('/global-chat')) setValue(2);
    else if (location.pathname.startsWith('/scheduled-meetings')) setValue(3);
    else if (location.pathname.startsWith('/graph')) setValue(4);
    else if (location.pathname.startsWith('/calendar')) setValue(5);
    else if (location.pathname.startsWith('/templates')) setValue(6);
    else if (location.pathname.startsWith('/settings')) setValue(7);
  }, [location.pathname]);

  return (
    <Tabs 
      value={value} 
      textColor="inherit" 
      indicatorColor="secondary" 
      variant="scrollable" 
      scrollButtons="auto"
      sx={{
        '& .MuiTab-root': {
          minWidth: isMobile ? 'auto' : 100,
          px: isMobile ? 1 : 2
        }
      }}
    >
      <Tab
        icon={<DashboardIcon />}
        label={isMobile ? undefined : "Dashboard"}
        component={Link}
        to="/"
      />
      <Tab
        icon={<FolderOpenIcon />}
        label={isMobile ? undefined : "Meetings"}
        component={Link}
        to="/meetings/browse"
      />
      <Tab
        icon={<ChatIcon />}
        label={isMobile ? undefined : "Global Chat"}
        component={Link}
        to="/global-chat"
      />
      <Tab
        icon={<EventIcon />}
        label={isMobile ? undefined : "Scheduled"}
        component={Link}
        to="/scheduled-meetings"
      />
      <Tab
        icon={<GraphIcon />}
        label={isMobile ? undefined : "Graph"}
        component={Link}
        to="/graph"
      />
      <Tab
        icon={<CalendarIcon />}
        label={isMobile ? undefined : "Calendar"}
        component={Link}
        to="/calendar"
      />
      <Tab
        icon={<TemplatesIcon />}
        label={isMobile ? undefined : "Templates"}
        component={Link}
        to="/templates"
      />
      <Tab
        icon={<SettingsIcon />}
        label={isMobile ? undefined : "Settings"}
        component={Link}
        to="/settings"
      />
    </Tabs>
  );
}

function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { mode, toggleTheme } = useThemeMode();
  const isMobile = useMediaQuery('(max-width:600px)');

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={2}>
        <Toolbar sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography 
            variant={isMobile ? "h6" : "h5"} 
            component="div" 
            sx={{ 
              flexGrow: isMobile ? 0 : 1,
              mr: isMobile ? 'auto' : 0
            }}
          >
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              {isMobile ? '📋 MA' : 'Meeting Assistant'}
            </Link>
          </Typography>
          
          {/* Search button */}
          <Tooltip title="Search (Ctrl+K)">
            <IconButton 
              color="inherit" 
              onClick={() => setSearchOpen(true)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.1)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
              }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton color="inherit" onClick={toggleTheme}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <NavigationTabs />
        </Toolbar>
      </AppBar>
      
      <Container 
        maxWidth="xl" 
        sx={{ 
          mt: { xs: 2, md: 4 }, 
          mb: 4, 
          px: { xs: 1, sm: 2, md: 3 },
          minHeight: 'calc(100vh - 120px)' 
        }}
      >
        <Routes>
          <Route path="/" element={<MeetingsDashboard />} />
          <Route path="/meetings/browse" element={<MeetingsBrowser />} />
          <Route path="/meetings/:meetingId" element={<MeetingDetails />} />
          <Route path="/global-chat" element={<GlobalChat />} />
          <Route path="/scheduled-meetings" element={<ScheduledMeetings />} />
          <Route path="/graph" element={<MeetingsGraph />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/templates" element={<MeetingTemplates />} />
        </Routes>
      </Container>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
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
