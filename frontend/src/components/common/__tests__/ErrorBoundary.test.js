/* eslint-disable no-console */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('displays custom title when provided', () => {
    const customTitle = 'Custom Error Title';

    render(
      <ErrorBoundary title={customTitle}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(customTitle)).toBeInTheDocument();
  });

  it('displays custom message when provided', () => {
    const customMessage = 'Custom error message';

    render(
      <ErrorBoundary message={customMessage}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('shows Try Again button by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('hides Try Again button when resetable is false', () => {
    render(
      <ErrorBoundary resetable={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('calls onReset callback when Try Again is clicked', () => {
    const onReset = jest.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(onReset).toHaveBeenCalled();
  });

  it('recovers from error when Try Again is clicked', () => {
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      return (
        <ErrorBoundary onReset={() => setShouldThrow(false)}>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />);

    // Initially shows error
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    // Should show normal content
    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders custom fallback component when provided', () => {
    const CustomFallback = () => <div>Custom Fallback</div>;

    render(
      <ErrorBoundary fallback={<CustomFallback />}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Test error/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('tracks error count', () => {
    const TestComponent = () => {
      const [errorTrigger, setErrorTrigger] = React.useState(0);

      return (
        <ErrorBoundary onReset={() => setErrorTrigger(0)}>
          <button onClick={() => setErrorTrigger((prev) => prev + 1)}>Trigger</button>
          <ThrowError shouldThrow={errorTrigger > 0} />
        </ErrorBoundary>
      );
    };

    render(<TestComponent />);

    // Trigger first error
    fireEvent.click(screen.getByText('Trigger'));

    // Click Try Again
    fireEvent.click(screen.getByText('Try Again'));

    // Trigger second error
    fireEvent.click(screen.getByText('Trigger'));

    // Should show error count
    expect(screen.getByText(/occurred 2 times/i)).toBeInTheDocument();
  });
});
