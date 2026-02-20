/**
 * TranscriptViewer Component
 * Displays meeting transcript with speaker labels and timestamps
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { formatDuration } from '../../../../utils';

/**
 * TranscriptViewer Component
 * @param {Object} props
 * @param {Array} props.segments - Transcript segments with speaker and text
 * @param {boolean} props.isLoading - Whether transcript is loading
 */
export const TranscriptViewer = ({ segments = [], isLoading = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSegment, setExpandedSegment] = useState(null);

  const filteredSegments = segments.filter(
    (segment) =>
      segment.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      segment.speaker?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Transcript
          </Typography>
          <Typography color="textSecondary" sx={{ py: 4, textAlign: 'center' }}>
            Loading transcript...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!segments.length) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            Transcript
          </Typography>
          <Alert severity="info">Transcript will be available once processing is complete.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          Transcript ({segments.length} segments)
        </Typography>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Transcript Segments */}
        <Stack spacing={2}>
          {filteredSegments.length === 0 ? (
            <Typography color="textSecondary" sx={{ textAlign: 'center', py: 2 }}>
              No segments match your search.
            </Typography>
          ) : (
            filteredSegments.map((segment, idx) => (
              <Paper
                key={idx}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
                onClick={() => setExpandedSegment(expandedSegment === idx ? null : idx)}
              >
                {/* Speaker and Timestamp */}
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ display: 'flex', alignItems: 'center', mb: 1 }}
                >
                  {segment.speaker && (
                    <Chip label={segment.speaker} size="small" variant="outlined" color="primary" />
                  )}
                  {segment.timestamp !== undefined && (
                    <Typography variant="caption" color="textSecondary">
                      {formatDuration(segment.timestamp)}
                    </Typography>
                  )}
                </Stack>

                {/* Transcript Text */}
                <Typography
                  variant="body2"
                  sx={{
                    display: expandedSegment === idx ? 'block' : '-webkit-box',
                    WebkitLineClamp: expandedSegment === idx ? 'unset' : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {segment.text}
                </Typography>

                {/* Toggle indicator */}
                {segment.text?.length > 200 && (
                  <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
                    {expandedSegment === idx ? 'Show less' : 'Show more'}
                  </Typography>
                )}
              </Paper>
            ))
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default TranscriptViewer;
