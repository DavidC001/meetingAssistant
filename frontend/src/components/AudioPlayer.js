import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  Paper,
  Chip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as MuteIcon,
  Speed as SpeedIcon,
  SkipNext as Skip10Icon,
  SkipPrevious as Back10Icon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const AudioPlayer = ({ src, onTimeUpdate, speakers = [] }) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (onTimeUpdate) onTimeUpdate(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onTimeUpdate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (_, value) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (_, value) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value;
    setVolume(value);
    setIsMuted(value === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const handleSpeedChange = (speed) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    setPlaybackSpeed(speed);
    setSpeedMenuAnchor(null);
  };

  const skip = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), duration);
  };

  // Seek to specific time (can be called from parent)
  const seekTo = (time) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  // Expose seekTo to parent
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.seekTo = seekTo;
    }
  }, []);

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        bgcolor: 'background.paper',
        borderRadius: 2
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Waveform placeholder / Progress bar */}
      <Box 
        sx={{ 
          height: 60, 
          bgcolor: 'action.hover', 
          borderRadius: 1, 
          mb: 2,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          handleSeek(null, percent * duration);
        }}
      >
        {/* Progress indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${(currentTime / duration) * 100}%`,
            bgcolor: 'primary.light',
            opacity: 0.3,
            transition: 'width 0.1s linear'
          }}
        />
        
        {/* Playhead */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: `${(currentTime / duration) * 100}%`,
            width: 2,
            height: '100%',
            bgcolor: 'primary.main',
            transition: 'left 0.1s linear'
          }}
        />
        
        {/* Center text */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Click anywhere to seek
          </Typography>
        </Box>
      </Box>

      {/* Controls */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {/* Skip back */}
        <Tooltip title="Back 10s">
          <IconButton onClick={() => skip(-10)} size="small">
            <Back10Icon />
          </IconButton>
        </Tooltip>

        {/* Play/Pause */}
        <IconButton 
          onClick={togglePlay} 
          color="primary"
          sx={{ 
            bgcolor: 'primary.main',
            color: 'white',
            '&:hover': { bgcolor: 'primary.dark' }
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>

        {/* Skip forward */}
        <Tooltip title="Forward 10s">
          <IconButton onClick={() => skip(10)} size="small">
            <Skip10Icon />
          </IconButton>
        </Tooltip>

        {/* Time display */}
        <Typography variant="body2" sx={{ minWidth: 100, textAlign: 'center' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>

        {/* Progress slider */}
        <Slider
          size="small"
          value={currentTime}
          max={duration || 100}
          onChange={handleSeek}
          sx={{ flex: 1, mx: 2 }}
        />

        {/* Playback speed */}
        <Tooltip title="Playback speed">
          <Chip
            icon={<SpeedIcon />}
            label={`${playbackSpeed}x`}
            size="small"
            variant="outlined"
            onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
            sx={{ cursor: 'pointer' }}
          />
        </Tooltip>
        <Menu
          anchorEl={speedMenuAnchor}
          open={Boolean(speedMenuAnchor)}
          onClose={() => setSpeedMenuAnchor(null)}
        >
          {PLAYBACK_SPEEDS.map(speed => (
            <MenuItem 
              key={speed} 
              onClick={() => handleSpeedChange(speed)}
              selected={speed === playbackSpeed}
            >
              {speed}x
            </MenuItem>
          ))}
        </Menu>

        {/* Volume */}
        <Tooltip title={isMuted ? "Unmute" : "Mute"}>
          <IconButton onClick={toggleMute} size="small">
            {isMuted ? <MuteIcon /> : <VolumeIcon />}
          </IconButton>
        </Tooltip>
        <Slider
          size="small"
          value={isMuted ? 0 : volume}
          max={1}
          step={0.1}
          onChange={handleVolumeChange}
          sx={{ width: 80 }}
        />
      </Stack>

      {/* Keyboard shortcuts hint */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
        Space: Play/Pause • ← →: Seek • ↑ ↓: Volume
      </Typography>
    </Paper>
  );
};

export default AudioPlayer;
