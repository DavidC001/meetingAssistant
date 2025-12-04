/**
 * SearchInput Component
 * 
 * Reusable search input with debounce functionality.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

const SearchInput = ({
  value: externalValue,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  size = 'small',
  fullWidth = true,
  autoFocus = false,
  ...props
}) => {
  const [internalValue, setInternalValue] = useState(externalValue || '');
  
  // Sync with external value
  useEffect(() => {
    if (externalValue !== undefined) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);
  
  // Debounced onChange
  useEffect(() => {
    if (!onChange) return;
    
    const handler = setTimeout(() => {
      onChange(internalValue);
    }, debounceMs);
    
    return () => clearTimeout(handler);
  }, [internalValue, debounceMs, onChange]);
  
  const handleChange = useCallback((e) => {
    setInternalValue(e.target.value);
  }, []);
  
  const handleClear = useCallback(() => {
    setInternalValue('');
    if (onChange) {
      onChange('');
    }
  }, [onChange]);
  
  return (
    <TextField
      value={internalValue}
      onChange={handleChange}
      placeholder={placeholder}
      size={size}
      fullWidth={fullWidth}
      autoFocus={autoFocus}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="action" />
          </InputAdornment>
        ),
        endAdornment: internalValue ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={handleClear}
              edge="end"
              aria-label="clear search"
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      {...props}
    />
  );
};

export default SearchInput;
