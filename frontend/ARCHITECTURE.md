# Frontend Architecture

## Pattern: Container / Presentation / Hooks

Every feature follows a three-layer pattern:

```
features/meetings/
  containers/          # Data fetching + state, renders presentation
    MeetingsListContainer.js
  presentation/        # Pure UI, receives data via props
    MeetingsList.js
  hooks/               # Reusable state/logic hooks
    useMeetingsList.js
```

### Why three layers?

| Layer        | Responsibility                                    | Has JSX? | Has state? |
|-------------|---------------------------------------------------|----------|------------|
| Container   | Fetch data, manage loading/error state, pass props | Minimal | Yes       |
| Presentation | Render UI from props, emit callbacks               | Yes      | No        |
| Hook        | Encapsulate data fetching + processing logic       | No       | Yes       |

### Rules

1. **Presentational components** never call services or hooks directly. They receive data and
   callbacks via props.

2. **Containers** compose hooks + service calls and render a presentational component.
   They handle loading, empty, and error states.

3. **Hooks** are reusable across containers. They return `{ data, loading, error, refresh }`.

### Example: adding a new feature

```
# 1. Create the hook
features/calendar/hooks/useCalendarEvents.js

# 2. Create presentational components
features/calendar/presentation/CalendarToolbar.js
features/calendar/presentation/EventDetailDialog.js

# 3. Create the container
features/calendar/containers/CalendarContainer.js

# 4. Wire up in router
```

### Service layer

All API calls go through `src/services/` — never call `axios` or `fetch` directly
in components or hooks.

```js
// services/meetingService.js
const MeetingService = {
  async getAll({ skip, limit } = {}) { ... },
  async getById(meetingId) { ... },
  async upload(file, options) { ... },
};
```

Add new endpoints to the existing service file for that domain.

### Common components

Located in `components/common/`. These are generic, reusable across features:
- `ErrorBoundary` / `ErrorState` — wrap features for error handling
- `LoadingState` / `LoadingSkeleton` — loading placeholders
- `EmptyState` — "no data" views
- `ConfirmDialog` / `FormDialog` — modal dialogs
- `FilterBar` / `SearchInput` / `ViewModeToggle` — list controls
- `PageHeader` / `PageTransition` — layout utilities
- `StatusChip` / `ProgressBar` / `SmoothProgress` — status indicators

### State conventions

| State      | Container renders               |
|-----------|---------------------------------|
| Loading   | `<LoadingState />`              |
| Error     | `<ErrorState message={...} />`  |
| Empty     | `<EmptyState />`                |
| Ready     | `<PresentationComponent />`     |

### File naming

- **PascalCase** for components: `MeetingCard.js`
- **camelCase** for hooks: `useMeetingsList.js`
- **camelCase** for services: `meetingService.js`
- **camelCase** for utilities: `dateHelpers.js`

### Testing

Each layer is tested independently:
- **Presentational**: render with mock props, assert output
- **Hooks**: `renderHook` with mocked services
- **Services**: mock `axios`, assert correct API calls

See `src/__tests__/README.md` for testing patterns.
