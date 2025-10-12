import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  CalendarMonth as CalendarIcon,
  ChatBubbleOutline as ChatIcon
} from '@mui/icons-material';
import MeetingsDashboard from './components/MeetingsDashboard';
import MeetingDetails from './components/MeetingDetails';
import Settings from './components/Settings';
import Calendar from './components/Calendar';
import GlobalChat from './components/GlobalChat';

// Create a modern theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#f50057',
      light: '#ff5983',
      dark: '#c51162',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});

function NavigationTabs() {
  const location = useLocation();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (location.pathname === '/' || location.pathname.startsWith('/meetings')) setValue(0);
    else if (location.pathname.startsWith('/global-chat')) setValue(1);
    else if (location.pathname.startsWith('/calendar')) setValue(2);
    else if (location.pathname.startsWith('/settings')) setValue(3);
  }, [location.pathname]);

  return (
    <Tabs value={value} textColor="inherit" indicatorColor="secondary">
      <Tab
        icon={<DashboardIcon />}
        label="Dashboard"
        component={Link}
        to="/"
      />
      <Tab
        icon={<ChatIcon />}
        label="Global Chat"
        component={Link}
        to="/global-chat"
      />
      <Tab
        icon={<CalendarIcon />}
        label="Calendar"
        component={Link}
        to="/calendar"
      />
      <Tab
        icon={<SettingsIcon />}
        label="Settings"
        component={Link}
        to="/settings"
      />
    </Tabs>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="sticky" elevation={2}>
            <Toolbar>
              <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                  Meeting Assistant
                </Link>
              </Typography>
              <NavigationTabs />
            </Toolbar>
          </AppBar>
          
          <Container maxWidth="xl" sx={{ mt: 4, mb: 4, height: 'calc(100vh - 120px)' }}>
            <Routes>
              <Route path="/" element={<MeetingsDashboard />} />
              <Route path="/meetings/:meetingId" element={<MeetingDetails />} />
              <Route path="/global-chat" element={<GlobalChat />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
