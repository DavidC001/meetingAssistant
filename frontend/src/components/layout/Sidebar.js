/**
 * Sidebar Navigation Component
 * 
 * Responsive collapsible sidebar with grouped navigation items:
 * - Persistent on desktop (≥1200px)
 * - Collapsible to icons-only on medium screens (900-1199px)
 * - Hidden behind hamburger menu on mobile (<900px)
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  FolderOpen as FolderOpenIcon,
  ChatBubbleOutline as ChatIcon,
  Event as EventIcon,
  AccountTree as GraphIcon,
  CalendarMonth as CalendarIcon,
  Article as TemplatesIcon,
  Settings as SettingsIcon,
  ViewKanban as KanbanIcon,
} from '@mui/icons-material';

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 72;

const navigationGroups = [
  {
    label: 'Core',
    items: [
      { path: '/', label: 'Dashboard', icon: DashboardIcon },
      { path: '/meetings/browse', label: 'Meetings Browser', icon: FolderOpenIcon },
    ],
  },
  {
    label: 'AI Tools',
    items: [
      { path: '/global-chat', label: 'Global Chat', icon: ChatIcon },
      { path: '/graph', label: 'Graph View', icon: GraphIcon },
    ],
  },
  {
    label: 'Planning',
    items: [
      { path: '/calendar', label: 'Calendar', icon: CalendarIcon },
      { path: '/scheduled-meetings', label: 'Scheduled', icon: EventIcon },
      { path: '/kanban', label: 'Action Items', icon: KanbanIcon },
      { path: '/templates', label: 'Templates', icon: TemplatesIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const Sidebar = ({ open, onClose, variant = 'permanent', collapsed = false }) => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        pt: 2,
      }}
    >
      {navigationGroups.map((group, groupIndex) => (
        <Box key={groupIndex}>
          {!collapsed && (
            <Typography
              variant="caption"
              sx={{
                px: 3,
                py: 1,
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontSize: '0.75rem',
              }}
            >
              {group.label}
            </Typography>
          )}
          
          <List sx={{ px: 1 }}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              const listItemButton = (
                <ListItemButton
                  component={Link}
                  to={item.path}
                  onClick={isMobile ? onClose : undefined}
                  selected={active}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 4,
                      height: '60%',
                      backgroundColor: active ? 'primary.main' : 'transparent',
                      borderRadius: '0 4px 4px 0',
                      transition: 'background-color 0.2s',
                    },
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.mode === 'light' 
                        ? 'rgba(25, 118, 210, 0.08)' 
                        : 'rgba(144, 202, 249, 0.16)',
                      '&:hover': {
                        backgroundColor: theme.palette.mode === 'light'
                          ? 'rgba(25, 118, 210, 0.12)'
                          : 'rgba(144, 202, 249, 0.24)',
                      },
                    },
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: active ? 'primary.main' : 'text.secondary',
                      minWidth: collapsed ? 0 : 40,
                    }}
                  >
                    <Icon />
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active ? 600 : 400,
                        fontSize: '0.95rem',
                      }}
                    />
                  )}
                </ListItemButton>
              );

              return (
                <ListItem key={item.path} disablePadding>
                  {collapsed ? (
                    <Tooltip title={item.label} placement="right" arrow>
                      {listItemButton}
                    </Tooltip>
                  ) : (
                    listItemButton
                  )}
                </ListItem>
              );
            })}
          </List>
          
          {groupIndex < navigationGroups.length - 1 && (
            <Divider sx={{ my: 1, mx: 2 }} />
          )}
        </Box>
      ))}
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          overflowX: 'hidden',
          mt: variant === 'permanent' ? '64px' : 0,
          height: variant === 'permanent' ? 'calc(100% - 64px)' : '100%',
        },
      }}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
