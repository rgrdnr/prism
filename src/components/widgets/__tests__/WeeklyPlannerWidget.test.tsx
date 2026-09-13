/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
    title,
    loading,
  }: {
    children: React.ReactNode;
    title?: string;
    loading?: boolean;
  }) {
    if (loading) return <div data-testid="loading-state">Loading</div>;
    return (
      <div data-testid="widget-container">
        {title && <div data-testid="widget-title">{title}</div>}
        {children}
      </div>
    );
  },
  WidgetEmpty: function MockWidgetEmpty({ message }: { message: string }) {
    return <div data-testid="empty-state">{message}</div>;
  },
}));

// Stub out the drag-capable card so the test isn't coupled to @dnd-kit's
// DndContext requirements — this widget never passes a dragId anyway.
jest.mock('@/components/calendar/cells/WeekItemCard', () => ({
  WeekItemCard: function MockWeekItemCard({
    title,
    timeLabel,
  }: {
    title: string;
    timeLabel?: string;
  }) {
    return (
      <div data-testid="week-item">
        <span>{title}</span>
        {timeLabel && <span>{timeLabel}</span>}
      </div>
    );
  },
}));

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/New_York' }),
}));

const mockUseWeekViewData = jest.fn();
jest.mock('@/lib/hooks/useWeekViewData', () => ({
  useWeekViewData: (...args: unknown[]) => mockUseWeekViewData(...args),
}));

import { WeeklyPlannerWidget } from '../WeeklyPlannerWidget';

function dayBucket(overrides: Partial<{
  date: Date;
  dayOfWeek: string;
  allDayEvents: unknown[];
  timedEvents: unknown[];
  meals: unknown[];
}> = {}) {
  return {
    date: new Date('2026-01-05T00:00:00Z'),
    dayOfWeek: 'monday',
    allDayEvents: [],
    timedEvents: [],
    meals: [],
    chores: [],
    tasks: [],
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('WeeklyPlannerWidget', () => {
  it('shows the empty state when nothing is planned in the window', () => {
    mockUseWeekViewData.mockReturnValue({ days: [dayBucket(), dayBucket()], loading: false, error: null });
    render(<WeeklyPlannerWidget />);
    expect(screen.queryByTestId('empty-state')).not.toBeNull();
  });

  it('renders a meal for its day', () => {
    mockUseWeekViewData.mockReturnValue({
      days: [dayBucket({ meals: [{ id: 'm1', name: 'Tacos', mealType: 'dinner' }] })],
      loading: false,
      error: null,
    });
    render(<WeeklyPlannerWidget />);
    expect(screen.queryByText('Tacos')).not.toBeNull();
  });

  it('only renders events flagged showOnPlanner, not every event on the day', () => {
    mockUseWeekViewData.mockReturnValue({
      days: [dayBucket({
        timedEvents: [
          { id: 'e1', title: 'Highlighted meeting', allDay: false, showOnPlanner: true, color: '#3B82F6', startTime: new Date(), endTime: new Date() },
          { id: 'e2', title: 'Background clutter', allDay: false, showOnPlanner: false, color: '#3B82F6', startTime: new Date(), endTime: new Date() },
        ],
      })],
      loading: false,
      error: null,
    });
    render(<WeeklyPlannerWidget />);
    expect(screen.queryByText('Highlighted meeting')).not.toBeNull();
    expect(screen.queryByText('Background clutter')).toBeNull();
  });

  it('passes the loading state through to WidgetContainer', () => {
    mockUseWeekViewData.mockReturnValue({ days: [], loading: true, error: null });
    render(<WeeklyPlannerWidget />);
    expect(screen.queryByTestId('loading-state')).not.toBeNull();
  });
});
