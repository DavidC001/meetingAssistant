/**
 * Tests for common reusable components:
 *  ConfirmDialog, EmptyState, LoadingSkeleton, StatusChip, PageHeader, SearchInput.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusChip from '../../components/common/StatusChip';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';

describe('ConfirmDialog', () => {
  const base = {
    open: true,
    title: 'Delete?',
    message: 'Are you sure?',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  test('renders title and message', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  test('calls onConfirm when confirm button clicked', () => {
    render(<ConfirmDialog {...base} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(base.onConfirm).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when cancel button clicked', () => {
    render(<ConfirmDialog {...base} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(base.onCancel).toHaveBeenCalledTimes(1);
  });

  test('uses custom labels', () => {
    render(<ConfirmDialog {...base} confirmLabel="Yes" cancelLabel="No" />);
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  test('is not visible when open=false', () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByRole('dialog')).toBeFalsy();
  });
});

// ============================== EmptyState ==============================

describe('EmptyState', () => {
  test('renders default title', () => {
    render(<EmptyState />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  test('renders custom title and description', () => {
    render(<EmptyState title="Nothing here" description="Try adding items" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try adding items')).toBeInTheDocument();
  });

  test('renders action button and fires callback', () => {
    const handler = jest.fn();
    render(<EmptyState actionLabel="Add item" onAction={handler} />);
    const btn = screen.getByText('Add item');
    fireEvent.click(btn);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('does not render action when label or handler missing', () => {
    render(<EmptyState actionLabel="Add" />);
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument();
  });
});

// ============================== LoadingSkeleton ==============================

describe('LoadingSkeleton', () => {
  test('renders card variant (default)', () => {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(<LoadingSkeleton variant="card" count={2} />);
    // Each card has content with multiple skeleton elements
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  test('renders list variant', () => {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(<LoadingSkeleton variant="list" count={4} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const cards = container.querySelectorAll('.MuiCard-root');
    expect(cards).toHaveLength(4);
  });

  test('renders compact variant', () => {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(<LoadingSkeleton variant="compact" count={3} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const cards = container.querySelectorAll('.MuiCard-root');
    expect(cards).toHaveLength(3);
  });

  test('renders table variant', () => {
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const { container } = render(<LoadingSkeleton variant="table" count={2} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================== StatusChip ==============================

describe('StatusChip', () => {
  test('renders completed status', () => {
    render(<StatusChip status="completed" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  test('renders processing status', () => {
    render(<StatusChip status="processing" />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  test('renders pending status', () => {
    render(<StatusChip status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  test('renders failed status', () => {
    render(<StatusChip status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  test('renders unknown status as-is', () => {
    render(<StatusChip status="weird" />);
    expect(screen.getByText('weird')).toBeInTheDocument();
  });

  test('uses custom label when provided', () => {
    render(<StatusChip status="completed" customLabel="Done!" />);
    expect(screen.getByText('Done!')).toBeInTheDocument();
  });
});

// ============================== PageHeader ==============================

describe('PageHeader', () => {
  test('renders title', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Meetings" />
      </MemoryRouter>
    );
    expect(screen.getByText('Meetings')).toBeInTheDocument();
  });

  test('renders subtitle', () => {
    render(
      <MemoryRouter>
        <PageHeader title="Meetings" subtitle="All your meetings" />
      </MemoryRouter>
    );
    expect(screen.getByText('All your meetings')).toBeInTheDocument();
  });

  test('renders breadcrumbs', () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="Detail"
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'Meetings', to: '/meetings' },
            { label: 'Detail' },
          ]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Meetings')).toBeInTheDocument();
    const details = screen.getAllByText('Detail');
    expect(details.length).toBeGreaterThanOrEqual(2);
  });

  test('renders actions', () => {
    render(
      <MemoryRouter>
        <PageHeader title="T" actions={<button>Custom</button>} />
      </MemoryRouter>
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });
});

// ============================== SearchInput ==============================

describe('SearchInput', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('renders with placeholder', () => {
    render(<SearchInput placeholder="Search meetings..." />);
    expect(screen.getByPlaceholderText('Search meetings...')).toBeInTheDocument();
  });

  test('shows clear button when there is text', () => {
    render(<SearchInput value="test" />);
    expect(screen.getByLabelText('clear search')).toBeInTheDocument();
  });

  test('hides clear button when empty', () => {
    render(<SearchInput value="" />);
    expect(screen.queryByLabelText('clear search')).not.toBeInTheDocument();
  });

  test('clears input on clear click', () => {
    const onChange = jest.fn();
    render(<SearchInput value="test" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('debounces onChange calls', () => {
    const onChange = jest.fn();
    render(<SearchInput onChange={onChange} debounceMs={300} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'hello' } });

    // Not called immediately
    expect(onChange).not.toHaveBeenCalledWith('hello');

    // Called after debounce
    act(() => jest.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith('hello');
  });
});
