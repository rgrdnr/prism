'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { format, isSameDay, isBefore, startOfDay } from 'date-fns';
import { addMonths } from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Star,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { PageWrapper, SubpageHeader, FilterBar } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PageLoader } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AddEventModal } from '@/components/modals/AddEventModal';
import { MealModal } from '@/app/meals/MealsView';
import { WeekItemCard } from '@/components/calendar/cells/WeekItemCard';
import { useRecipes } from '@/lib/hooks/useRecipes';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTimeRange, isCalendarEventPast } from '@/lib/utils/timeFormat';
import { contrastText } from '@/lib/utils/color';
import { cn } from '@/lib/utils';
import { DAYS_OF_WEEK, DAYS_OF_WEEK_MON_FIRST, DAY_LABELS } from '@/lib/constants/days';
import { MiniMonth } from './MiniMonth';
import { usePlannerViewData } from './usePlannerViewData';

// Matches OverlayItemsCell's MEAL_FALLBACK_COLOR so a meal reads the same
// color here as it does on the Calendar page when no one's cooking it yet.
const MEAL_FALLBACK_COLOR = '#10b981';

// Literal class strings (not built dynamically) so Tailwind's JIT picks them up.
const DAY_GRID_COLS: Record<4 | 5 | 7, string> = {
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  7: 'lg:grid-cols-7',
};
import type { CalendarEvent } from '@/types/calendar';

export function PlannerView() {
  const {
    today,
    currentWeek,
    weekOfString,
    goalsWeekDates,
    daysToShow,
    setDaysToShow,
    goToPreviousWeek,
    goToNextWeek,
    goToThisWeek,
    isCurrentWeek,
    days,
    daysLoading,
    refreshDays,
    showAllEvents,
    setShowAllEvents,
    toggleEventHighlight,
    calendarGroups,
    selectedCalendarIds,
    toggleCalendar,
    filterEvents,
    note,
    noteSaving,
    saveNote,
    habits,
    isChecked,
    addHabit,
    removeHabit,
    toggleHabitCheck,
    showAddMeal,
    setShowAddMeal,
    showAddEvent,
    setShowAddEvent,
    activeDay,
    editingMeal,
    setEditingMeal,
    editingEvent,
    setEditingEvent,
    addMeal,
    editMeal,
    deleteMeal,
    deleteEvent,
    openAddMeal,
    openAddEvent,
    openEditEvent,
    confirmDialogProps,
  } = usePlannerViewData();

  const { recipes } = useRecipes({ limit: 100 });
  const { timeFormat, displayTimezone } = useTimeFormat();

  const [noteDraft, setNoteDraft] = useState('');
  useEffect(() => setNoteDraft(note?.content || ''), [note?.content]);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNoteChange = (value: string) => {
    setNoteDraft(value);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => saveNote(value), 800);
  };

  const [newHabitLabel, setNewHabitLabel] = useState('');
  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitLabel.trim()) return;
    addHabit(newHabitLabel.trim());
    setNewHabitLabel('');
  };

  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<CalendarDays className="h-5 w-5 text-primary" />}
          title="Weekly Planner"
        />

        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2 border-b border-border bg-card/50">
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek} aria-label="Previous week" className="h-8 w-8">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold min-w-[220px] text-center">
            {format(days[0]?.date ?? currentWeek, 'MMM d')} – {format(days[days.length - 1]?.date ?? currentWeek, 'MMM d, yyyy')}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} aria-label="Next week" className="h-8 w-8">
            <ChevronRight className="h-5 w-5" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="link" size="sm" onClick={goToThisWeek} className="h-auto p-0 text-xs ml-1">
              This week
            </Button>
          )}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
            {([4, 5, 7] as const).map((count) => (
              <Button
                key={count}
                variant={daysToShow === count ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDaysToShow(count)}
                className="h-7 w-9 text-xs px-0"
                title={count === 7 ? 'Full week (Mon–Sun)' : `Next ${count} days, starting today`}
              >
                {count}d
              </Button>
            ))}
          </div>
        </div>

        {calendarGroups.length > 0 && (
          <FilterBar>
            <span className="text-sm text-muted-foreground shrink-0">Show:</span>
            <Button
              variant={selectedCalendarIds.has('all') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleCalendar('all')}
              className="h-7 text-xs"
            >
              All
            </Button>
            {calendarGroups.map((group) => {
              const isSelected = selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all');
              return (
                <Button
                  key={group.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCalendar(group.id)}
                  className={cn('h-7 text-xs gap-1.5', isSelected && 'border-transparent')}
                  style={isSelected ? { backgroundColor: group.color, color: contrastText(group.color) } : undefined}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.55)' : group.color }} />
                  {group.name}
                </Button>
              );
            })}
          </FilterBar>
        )}

        <FilterBar>
          <span className="text-sm text-muted-foreground">
            {showAllEvents
              ? 'Showing every event — star one to make it a Planner highlight.'
              : 'Showing only starred highlights.'}
          </span>
          <Button
            variant={showAllEvents ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAllEvents(!showAllEvents)}
            className="h-7 text-xs gap-1.5 ml-auto"
          >
            {showAllEvents ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAllEvents ? 'Highlights only' : 'Show all events'}
          </Button>
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {daysLoading ? (
            <PageLoader />
          ) : (
            <div className="max-w-[1600px] mx-auto space-y-6">
              {/* Day grid: full Monday-Sunday week at 7, a rolling window starting today at 4/5 */}
              <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2', DAY_GRID_COLS[daysToShow])}>
                {days.map((bucket) => {
                  const isToday = isSameDay(bucket.date, today);
                  const isPastDay = isBefore(bucket.date, startOfDay(today)) && !isToday;
                  const dayEventsAll = filterEvents([...bucket.allDayEvents, ...bucket.timedEvents]);
                  const dayEvents = showAllEvents ? dayEventsAll : dayEventsAll.filter((e) => e.showOnPlanner);
                  return (
                    <div
                      key={bucket.date.toISOString()}
                      className={cn(
                        'flex flex-col rounded-lg border border-border bg-card/60 min-h-[220px]',
                        isToday && 'ring-2 ring-primary',
                        isPastDay && 'opacity-55 saturate-[0.7]',
                      )}
                    >
                      <div className="px-2 py-1.5 border-b border-border text-center">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {DAY_LABELS[bucket.dayOfWeek]}
                        </div>
                        <div className="text-sm font-bold">{format(bucket.date, 'MMM d')}</div>
                      </div>

                      {/* Meal(s) for the day */}
                      <div className="px-2 py-1.5 border-b border-border/60 space-y-1">
                        {bucket.meals.length === 0 ? (
                          <button
                            onClick={() => openAddMeal(bucket.date)}
                            className="w-full text-left text-xs text-muted-foreground italic hover:text-foreground flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add meal
                          </button>
                        ) : (
                          <>
                            {bucket.meals.map((meal) => (
                              <div key={meal.id} className="group relative">
                                <WeekItemCard
                                  variant="meal"
                                  size="sm"
                                  stripeColor={meal.cookedBy?.color || meal.createdBy?.color || MEAL_FALLBACK_COLOR}
                                  title={meal.name}
                                  timeLabel={meal.mealType}
                                  subtitle={meal.cookedBy?.name ? `Cooked by ${meal.cookedBy.name}` : undefined}
                                  muted={Boolean(meal.cookedAt)}
                                  onClick={() => setEditingMeal(meal)}
                                />
                                <button
                                  onClick={() => deleteMeal(meal.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive bg-card/80 rounded p-0.5"
                                  aria-label="Delete meal"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => openAddMeal(bucket.date)}
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Add
                            </button>
                          </>
                        )}
                      </div>

                      {/* Activities / events for the day */}
                      <div className="flex-1 px-2 py-1.5 space-y-1">
                        {dayEvents.map((event) => {
                          const highlighted = !!event.showOnPlanner;
                          // Whole past days are already dimmed by the card container;
                          // this additionally fades an event on *today* once its own
                          // end time has passed, so "done for today" reads at a glance.
                          const isPastEvent = isToday && isCalendarEventPast(
                            event.startTime,
                            event.endTime,
                            event.allDay,
                            today,
                            displayTimezone,
                          );
                          return (
                            <div key={event.id} className={cn('flex items-stretch gap-1', isPastEvent && 'opacity-50')}>
                              <button
                                onClick={() => setEventToEdit(event)}
                                className={cn(
                                  'flex-1 min-w-0 text-left text-xs px-1.5 py-1 rounded truncate block text-white hover:opacity-90',
                                  !highlighted && 'opacity-50 border border-dashed border-white/50',
                                )}
                                style={{ backgroundColor: event.color || '#3B82F6' }}
                                title={event.title}
                              >
                                <span className="font-medium truncate block">{event.title}</span>
                                {!event.allDay && (
                                  <span className={cn('block text-[10px]', highlighted ? 'opacity-85' : 'opacity-70')}>
                                    {formatDisplayTimeRange(
                                      event.startTime,
                                      event.endTime ?? new Date(event.startTime.getTime() + 3600000),
                                      timeFormat,
                                      displayTimezone,
                                    )}
                                  </span>
                                )}
                              </button>
                              {showAllEvents && (
                                <button
                                  onClick={() => toggleEventHighlight(event.id, !highlighted)}
                                  className={cn(
                                    'shrink-0 w-6 flex items-center justify-center rounded hover:bg-accent',
                                    highlighted ? 'text-amber-500' : 'text-muted-foreground',
                                  )}
                                  title={highlighted ? 'Remove from Planner highlights' : 'Show on Planner'}
                                  aria-label={highlighted ? 'Remove from Planner highlights' : 'Show on Planner'}
                                >
                                  <Star className="h-3.5 w-3.5" fill={highlighted ? 'currentColor' : 'none'} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => openAddEvent(bucket.date)}
                          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add activity
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weekly goals / habit tracker */}
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <h2 className="text-sm font-bold mb-2">Goals</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left font-medium text-muted-foreground pb-1 pr-2">Goal</th>
                        {DAYS_OF_WEEK_MON_FIRST.map((d) => (
                          <th key={d} className="text-center font-medium text-muted-foreground pb-1 w-9">
                            {DAY_LABELS[d].slice(0, 1)}
                          </th>
                        ))}
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {habits.map((habit) => (
                        <tr key={habit.id} className="border-t border-border/60 group">
                          <td className="py-1 pr-2">{habit.label}</td>
                          {goalsWeekDates.map((date) => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            return (
                              <td key={dateStr} className="text-center py-1">
                                <Checkbox
                                  checked={isChecked(habit, dateStr)}
                                  onCheckedChange={(checked) =>
                                    toggleHabitCheck(habit.id, dateStr, checked === true)
                                  }
                                />
                              </td>
                            );
                          })}
                          <td className="text-center">
                            <button
                              onClick={() => removeHabit(habit.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                              aria-label="Remove goal"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <form onSubmit={handleAddHabit} className="flex items-center gap-2 mt-2">
                  <Input
                    value={newHabitLabel}
                    onChange={(e) => setNewHabitLabel(e.target.value)}
                    placeholder="Add a weekly goal…"
                    className="h-8 text-sm max-w-xs"
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={!newHabitLabel.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </form>
              </div>

              {/* Notes + mini calendars */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-card/60 p-3">
                  <h2 className="text-sm font-bold mb-2">Notes</h2>
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder="Shopping list, reminders, anything for the week…"
                    className="min-h-[140px] text-sm"
                  />
                  {noteSaving && <div className="text-[11px] text-muted-foreground mt-1">Saving…</div>}
                </div>
                <div className="rounded-lg border border-border bg-card/60 p-3 flex gap-4">
                  <MiniMonth month={currentWeek} today={today} />
                  <MiniMonth month={addMonths(currentWeek, 1)} today={today} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddMeal && activeDay && (
        <MealModal
          weekOf={weekOfString}
          defaultDay={activeDay ? DAYS_OF_WEEK[activeDay.getDay()] : 'monday'}
          dayOptions={DAYS_OF_WEEK_MON_FIRST}
          recipes={recipes}
          onClose={() => setShowAddMeal(false)}
          onSave={(meal) => { addMeal(meal); setShowAddMeal(false); }}
        />
      )}

      {editingMeal && (
        <MealModal
          weekOf={weekOfString}
          meal={editingMeal}
          dayOptions={DAYS_OF_WEEK_MON_FIRST}
          recipes={recipes}
          onClose={() => setEditingMeal(null)}
          onSave={(updates) => { editMeal(editingMeal.id, updates); setEditingMeal(null); }}
        />
      )}

      <AddEventModal
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        defaultDate={activeDay ?? undefined}
        defaultShowOnPlanner
        onEventCreated={() => refreshDays()}
      />

      {eventToEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEventToEdit(null)}>
          <div className="bg-card rounded-lg p-4 max-w-sm w-full mx-4 shadow-lg border border-border" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">{eventToEdit.title}</h2>
            {eventToEdit.location && <p className="text-sm text-muted-foreground mb-3">{eventToEdit.location}</p>}
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { toggleEventHighlight(eventToEdit.id, !eventToEdit.showOnPlanner); setEventToEdit(null); }}
              >
                <Star className="h-3.5 w-3.5 mr-1" fill={eventToEdit.showOnPlanner ? 'currentColor' : 'none'} />
                {eventToEdit.showOnPlanner ? 'Unstar' : 'Star'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { openEditEvent(eventToEdit); setEventToEdit(null); }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEventToEdit(null)}>Close</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { deleteEvent(eventToEdit.id); setEventToEdit(null); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddEventModal
        open={!!editingEvent}
        onOpenChange={(open) => { if (!open) setEditingEvent(null); }}
        event={editingEvent ? {
          id: editingEvent.id,
          title: editingEvent.title,
          description: editingEvent.description,
          location: editingEvent.location,
          startTime: editingEvent.startTime,
          endTime: editingEvent.endTime,
          allDay: editingEvent.allDay,
          color: editingEvent.color,
          recurring: editingEvent.recurring ?? false,
          recurrenceRule: editingEvent.recurrenceRule ?? undefined,
          reminderMinutes: editingEvent.reminderMinutes ?? undefined,
          showOnPlanner: editingEvent.showOnPlanner,
          calendarSourceId: editingEvent.calendarId !== 'local' ? editingEvent.calendarId : undefined,
        } : undefined}
        onEventCreated={() => { refreshDays(); setEditingEvent(null); }}
      />

      <ConfirmDialog {...confirmDialogProps} />
    </PageWrapper>
  );
}
