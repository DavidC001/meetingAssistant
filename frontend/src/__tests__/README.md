# Frontend Testing Guide

## Overview

This directory contains all tests for the Meeting Assistant frontend React application.

## Test Structure

```
src/
├── components/
│   ├── common/
│   │   ├── __tests__/
│   │   │   └── ErrorBoundary.test.js
│   │   ├── ErrorBoundary.js
│   │   └── ...
│   └── features/
│       └── meetings/
│           ├── __tests__/
│           │   └── MeetingCard.test.js
│           └── MeetingCard.js
├── utils/
│   ├── __tests__/
│   │   └── errorHandler.test.js
│   └── errorHandler.js
├── services/
│   ├── __tests__/
│   │   └── MeetingService.test.js
│   └── MeetingService.js
└── setupTests.js
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode

```bash
npm test -- --watch
```

### Run tests with coverage

```bash
npm run test:coverage
```

### Run tests in CI mode

```bash
npm run test:ci
```

### Run specific test file

```bash
npm test -- ErrorBoundary.test.js
```

### Run tests matching pattern

```bash
npm test -- --testNamePattern="renders"
```

## Test Types

### Component Tests

Test React components in isolation:

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import MeetingCard from '../MeetingCard';

describe('MeetingCard', () => {
  it('renders meeting title', () => {
    const meeting = { id: 1, title: 'Test Meeting' };
    render(<MeetingCard meeting={meeting} />);

    expect(screen.getByText('Test Meeting')).toBeInTheDocument();
  });
});
```

### Hook Tests

Test custom hooks:

```javascript
import { renderHook, act } from '@testing-library/react';
import { useMeetings } from '../hooks/useMeetings';

describe('useMeetings', () => {
  it('fetches meetings on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useMeetings());

    await waitForNextUpdate();

    expect(result.current.meetings).toHaveLength(3);
  });
});
```

### Service Tests

Test API service functions:

```javascript
import MeetingService from '../MeetingService';
import axios from 'axios';

jest.mock('axios');

describe('MeetingService', () => {
  it('fetches all meetings', async () => {
    const mockMeetings = [{ id: 1, title: 'Meeting 1' }];
    axios.get.mockResolvedValue({ data: mockMeetings });

    const meetings = await MeetingService.getAll();

    expect(meetings).toEqual(mockMeetings);
    expect(axios.get).toHaveBeenCalledWith('/api/v1/meetings');
  });
});
```

### Utility Tests

Test utility functions:

```javascript
import { formatDate } from '../utils/dateUtils';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('January 15, 2024');
  });
});
```

## Testing Library Queries

### Priority Order

1. **getByRole** - Most accessible, preferred method
2. **getByLabelText** - Forms and inputs
3. **getByPlaceholderText** - Last resort for inputs
4. **getByText** - Non-interactive content
5. **getByTestId** - Last resort when nothing else works

### Query Types

- **getBy...** - Returns element or throws error
- **queryBy...** - Returns element or null (for asserting non-existence)
- **findBy...** - Returns promise, waits for element

### Examples

```javascript
// Preferred: By role
const button = screen.getByRole('button', { name: /submit/i });

// By label (for inputs)
const input = screen.getByLabelText(/email/i);

// By text
const heading = screen.getByText(/welcome/i);

// Query for non-existence
expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

// Find async elements
const message = await screen.findByText(/success/i);
```

## User Interactions

### Click Events

```javascript
import { fireEvent } from '@testing-library/react';

const button = screen.getByRole('button');
fireEvent.click(button);
```

### User Event (Recommended)

```javascript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
const button = screen.getByRole('button');
await user.click(button);
```

### Form Inputs

```javascript
const input = screen.getByLabelText(/username/i);
await user.type(input, 'testuser');

expect(input).toHaveValue('testuser');
```

## Mocking

### Mock API Calls

```javascript
import axios from 'axios';

jest.mock('axios');

test('fetches data', async () => {
  axios.get.mockResolvedValue({ data: { message: 'Success' } });

  // Test code
});
```

### Mock React Router

```javascript
import { MemoryRouter } from 'react-router-dom';

render(
  <MemoryRouter initialEntries={['/meetings/123']}>
    <MeetingDetails />
  </MemoryRouter>
);
```

### Mock Context

```javascript
import { ThemeContext } from '../contexts/ThemeContext';

const mockTheme = { mode: 'dark', toggle: jest.fn() };

render(
  <ThemeContext.Provider value={mockTheme}>
    <Component />
  </ThemeContext.Provider>
);
```

### Mock localStorage

```javascript
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

test('saves to localStorage', () => {
  // Component saves data
  saveSettings({ theme: 'dark' });

  expect(localStorage.setItem).toHaveBeenCalledWith('settings', JSON.stringify({ theme: 'dark' }));
});
```

## Best Practices

### 1. Test User Behavior, Not Implementation

```javascript
// ❌ Bad: Testing implementation details
expect(component.state.isLoading).toBe(false);

// ✅ Good: Testing user-visible behavior
expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
```

### 2. Use Accessible Queries

```javascript
// ❌ Bad: Using test IDs
screen.getByTestId('submit-button');

// ✅ Good: Using accessible queries
screen.getByRole('button', { name: /submit/i });
```

### 3. Avoid Snapshot Tests for UI

Snapshot tests are brittle and hard to maintain. Use targeted assertions instead.

### 4. Test Error States

```javascript
test('displays error message', async () => {
  axios.get.mockRejectedValue(new Error('Network error'));

  render(<Component />);

  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### 5. Clean Up After Tests

```javascript
afterEach(() => {
  jest.clearAllMocks();
  cleanup(); // Automatically done by @testing-library/react
});
```

## Coverage Goals

- **Overall**: 70% code coverage
- **Critical Components**: 90% coverage (authentication, data entry)
- **Utilities**: 90% coverage
- **Services**: 85% coverage
- **UI Components**: 70% coverage

## Common Issues

### Act Warning

```javascript
// If you see "act" warnings, wrap state updates:
await act(async () => {
  result.current.updateState();
});
```

### Async Updates

```javascript
// Wait for async updates
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});
```

### Material-UI Components

```javascript
// Test Material-UI select
const select = screen.getByLabelText(/category/i);
fireEvent.mouseDown(select);
const option = screen.getByRole('option', { name: /work/i });
fireEvent.click(option);
```

## Resources

- [React Testing Library](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
