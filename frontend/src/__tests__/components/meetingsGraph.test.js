/**
 * Regression test for the graph sizing bug: MeetingsGraphContainer used to render
 * <ForceGraph2D> with no width/height props, so react-force-graph fell back to
 * window.innerWidth/window.innerHeight instead of the container's actual size,
 * drawing the graph outside its visible box (see commit 38ac30f).
 *
 * These tests mock react-force-graph-2d and useGraphData so they can assert on
 * exactly what props MeetingsGraphContainer passes down.
 *
 * Note: the render function passed to React.forwardRef must NOT itself be a
 * jest.fn() — Jest's mock-function wrapping changes the function's declared
 * arity, which stops React from ever committing the element to the DOM (the
 * function still gets called, but the result is silently discarded). Track
 * calls via a plain jest.fn() invoked from inside a normal render function
 * instead.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// MeetingsGraphContainer pulls in the meetings `presentation` barrel, which also
// re-exports NotesEditor -> react-markdown (ESM-only, not transformed by Jest).
// Stub both so the barrel loads without hitting the real ESM package.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}));

jest.mock('react-force-graph-2d', () => {
  const ReactLib = require('react');
  const onRender = jest.fn();
  const Comp = ReactLib.forwardRef(function FakeForceGraph2D(props, ref) {
    onRender(props);
    ReactLib.useImperativeHandle(ref, () => ({
      zoomToFit: () => {},
      pauseAnimation: () => {},
      resumeAnimation: () => {},
      d3ReheatSimulation: () => {},
      zoom: () => 1,
      graphData: () => ({ nodes: [] }),
    }));
    return ReactLib.createElement('div', { 'data-testid': 'force-graph' });
  });
  Comp.__propCalls = onRender;
  return { __esModule: true, default: Comp };
});

jest.mock('../../components/features/meetings/hooks', () => ({
  useGraphData: () => ({
    graphData: {
      nodes: [{ id: 'm1', type: 'meeting', label: 'Meeting 1' }],
      links: [],
    },
    stats: { meetings: 1, people: 0, folders: 0, tags: 0 },
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

const ForceGraph2D = require('react-force-graph-2d').default;
const graphPropCalls = ForceGraph2D.__propCalls;
const MeetingsGraphContainer =
  require('../../components/features/meetings/containers/MeetingsGraphContainer').default;

describe('MeetingsGraphContainer sizing', () => {
  let resizeObserverInstances;
  let OriginalResizeObserver;

  beforeEach(() => {
    resizeObserverInstances = [];
    OriginalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        resizeObserverInstances.push(this);
      }
      observe(target) {
        this.target = target;
      }
      unobserve() {}
      disconnect() {}
    };
    graphPropCalls.mockClear();
  });

  afterEach(() => {
    global.ResizeObserver = OriginalResizeObserver;
  });

  test('does not render the graph before the container is measured', () => {
    render(<MeetingsGraphContainer />);
    expect(screen.queryByTestId('force-graph')).not.toBeInTheDocument();
  });

  test('passes the measured container size to ForceGraph2D, not window size', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;
    window.innerWidth = 1920;
    window.innerHeight = 1080;

    render(<MeetingsGraphContainer />);
    const el = resizeObserverInstances[0].target;

    Object.defineProperty(el, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true });

    act(() => {
      resizeObserverInstances[0].callback();
    });

    expect(await screen.findByTestId('force-graph')).toBeInTheDocument();

    const lastCallProps = graphPropCalls.mock.calls.at(-1)[0];
    expect(lastCallProps.width).toBe(500);
    expect(lastCallProps.height).toBe(400);
    expect(lastCallProps.width).not.toBe(1920);
    expect(lastCallProps.height).not.toBe(1080);

    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
  });
});
