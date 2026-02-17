import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import logger from '../../utils/logger';
/**
 * Lightweight Error Boundary for smaller components
 * Shows an inline alert instead of a full-page error
 *
 * Usage:
 *   <ErrorBoundaryAlert>
 *     <SmallComponent />
 *   </ErrorBoundaryAlert>
 */
class ErrorBoundaryAlert extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundaryAlert caught:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          severity="error"
          sx={{ m: 2 }}
          action={
            this.props.resetable !== false && (
              <Button size="small" onClick={this.handleReset} startIcon={<RefreshIcon />}>
                Retry
              </Button>
            )
          }
        >
          <AlertTitle>{this.props.title || 'Error'}</AlertTitle>
          {this.props.message || 'Failed to render this component'}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <Box
              component="pre"
              sx={{
                mt: 1,
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: 100,
              }}
            >
              {this.state.error.toString()}
            </Box>
          )}
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryAlert;
