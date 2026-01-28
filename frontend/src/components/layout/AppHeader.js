/**
 * AppHeader Component
 *
 * Simplified AppBar with:
 * - Logo
 * - Global Search trigger
 * - Theme toggle
 * - Mobile menu button
 */

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Search as SearchIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../../contexts/ThemeContext';
import GlobalSearch from '../GlobalSearch';

const AppHeader = ({ onMenuClick }) => {
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeMode();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchOpen = () => {
    setSearchOpen(true);
  };

  const handleSearchClose = () => {
    setSearchOpen(false);
  };

  // Listen for Ctrl+K keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        handleSearchOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          height: { xs: 56, md: 64 },
          transition: theme.transitions.create(['box-shadow'], {
            duration: theme.transitions.duration.short,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }}>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={onMenuClick}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo and Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 700,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                letterSpacing: '0.5px',
              }}
            >
              Meeting Assistant
            </Typography>
          </Box>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Global Search Button */}
          <Tooltip title="Search (Ctrl+K)">
            <IconButton
              color="inherit"
              onClick={handleSearchOpen}
              sx={{
                mr: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <SearchIcon />
            </IconButton>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              sx={{
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onClose={handleSearchClose} />
    </>
  );
};

export default AppHeader;
