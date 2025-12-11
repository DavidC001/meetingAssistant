import React from 'react';
import { Box, Chip, Stack, Typography, Tooltip } from '@mui/material';
import {
  Summarize as SummarizeIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Lightbulb as LightbulbIcon,
  Timeline as TimelineIcon,
  Search as SearchIcon
} from '@mui/icons-material';

const QUICK_PROMPTS = [
  {
    label: "Summarize key points",
    prompt: "Please summarize the key points discussed in this meeting.",
    icon: <SummarizeIcon fontSize="small" />,
    color: "primary"
  },
  {
    label: "List action items",
    prompt: "What are all the action items from this meeting? Please list them with owners and due dates if mentioned.",
    icon: <AssignmentIcon fontSize="small" />,
    color: "success"
  },
  {
    label: "Key decisions",
    prompt: "What were the key decisions made during this meeting?",
    icon: <LightbulbIcon fontSize="small" />,
    color: "warning"
  },
  {
    label: "Topics discussed",
    prompt: "What are the main topics that were discussed in this meeting?",
    icon: <TimelineIcon fontSize="small" />,
    color: "info"
  },
  {
    label: "Speaker summary",
    prompt: "Can you summarize what each speaker contributed to the meeting?",
    icon: <PersonIcon fontSize="small" />,
    color: "secondary"
  },
  {
    label: "Follow-ups needed",
    prompt: "What follow-up items or unanswered questions need to be addressed after this meeting?",
    icon: <SearchIcon fontSize="small" />,
    color: "default"
  }
];

const GLOBAL_QUICK_PROMPTS = [
  {
    label: "Find action items",
    prompt: "Show me all pending action items across my meetings.",
    icon: <AssignmentIcon fontSize="small" />,
    color: "success"
  },
  {
    label: "Recent decisions",
    prompt: "What were the key decisions made in recent meetings?",
    icon: <LightbulbIcon fontSize="small" />,
    color: "warning"
  },
  {
    label: "Project updates",
    prompt: "Summarize recent updates and progress mentioned in meetings.",
    icon: <TimelineIcon fontSize="small" />,
    color: "info"
  },
  {
    label: "Team discussions",
    prompt: "What topics have been frequently discussed across meetings?",
    icon: <SearchIcon fontSize="small" />,
    color: "primary"
  }
];

const QuickActions = ({ onSelectPrompt, isGlobal = false }) => {
  const prompts = isGlobal ? GLOBAL_QUICK_PROMPTS : QUICK_PROMPTS;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Quick prompts:
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {prompts.map((item, index) => (
          <Tooltip key={index} title={item.prompt} placement="top">
            <Chip
              icon={item.icon}
              label={item.label}
              size="small"
              color={item.color}
              variant="outlined"
              onClick={() => onSelectPrompt(item.prompt)}
              sx={{ 
                cursor: 'pointer',
                mb: 1,
                '&:hover': {
                  bgcolor: `${item.color}.lighter`,
                  borderColor: `${item.color}.main`
                }
              }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
};

export default QuickActions;
