'use client';

import { useState, useCallback, useEffect } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { TravelPin, TravelTrip, TravelExpense } from './types';

export class TravelAuthError extends Error {
  constructor() { super('Not logged in'); this.name = 'TravelAuthError'; }
}

function checkResponse(res: Response, action: string): void {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new TravelAuthError();
    throw new Error(`Failed to ${action}`);
  }
}

async function fetchAll(): Promise<{ pins: TravelPin[]; trips: TravelTrip[]; expenses: TravelExpense[] }> {
  const [pinsRes, tripsRes, expensesRes] = await Promise.all([
    fetch('/api/travel/pins'),
    fetch('/api/travel/trips'),
    fetch('/api/travel/expenses'),
  ]);
  const pins = pinsRes.ok ? ((await pinsRes.json()).pins ?? []) : [];
  const trips = tripsRes.ok ? ((await tripsRes.json()).trips ?? []) : [];
  const expenses = expensesRes.ok ? ((await expensesRes.json()).expenses ?? []) : [];
  return { pins, trips, expenses };
}

export function useTravelData() {
  const [pins, setPins] = useState<TravelPin[]>([]);
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  const [expenses, setExpenses] = useState<TravelExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetchAll();
    setPins(data.pins);
    setTrips(data.trips);
    setExpenses(data.expenses);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, 300_000);

  // ── Pins ──────────────────────────────────────────────────────────────────

  const addPin = useCallback(async (payload: Omit<TravelPin, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    const res = await fetch('/api/travel/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create pin');
    const pin = await res.json() as TravelPin;
    setPins((prev) => [pin, ...prev]);
    return pin;
  }, []);

  const updatePin = useCallback(async (id: string, payload: Partial<TravelPin>) => {
    const res = await fetch(`/api/travel/pins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update pin');
    const updated = await res.json() as TravelPin;
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
    return updated;
  }, []);

  const deletePin = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/pins/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete pin');
    setPins((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
  }, []);

  // ── Trips ─────────────────────────────────────────────────────────────────

  const addTrip = useCallback(async (payload: Omit<TravelTrip, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'stops'>) => {
    const res = await fetch('/api/travel/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create trip');
    const trip = await res.json() as TravelTrip;
    setTrips((prev) => [trip, ...prev]);
    return trip;
  }, []);

  const updateTrip = useCallback(async (id: string, payload: Partial<TravelTrip>) => {
    const res = await fetch(`/api/travel/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update trip');
    const updated = await res.json() as TravelTrip;
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    return updated;
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/trips/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete trip');
    setTrips((prev) => prev.filter((t) => t.id !== id));
    // Cascade: remove pins and expenses that belonged to this trip from local state
    setPins((prev) => prev.filter((p) => p.tripId !== id));
    setExpenses((prev) => prev.filter((e) => e.tripId !== id));
  }, []);

  // ── Expenses ──────────────────────────────────────────────────────────────
  // Amount is sent to the API as a number (Zod expects `z.number()`), unlike
  // `TravelExpense.amount` which comes back as a string (decimal columns from pg).

  const addExpense = useCallback(async (payload: Omit<TravelExpense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'amount'> & { amount: number }) => {
    const res = await fetch('/api/travel/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'create expense');
    const expense = await res.json() as TravelExpense;
    setExpenses((prev) => [...prev, expense]);
    return expense;
  }, []);

  const updateExpense = useCallback(async (id: string, payload: Partial<Omit<TravelExpense, 'amount'>> & { amount?: number }) => {
    const res = await fetch(`/api/travel/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    checkResponse(res, 'update expense');
    const updated = await res.json() as TravelExpense;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
    return updated;
  }, []);

  const deleteExpense = useCallback(async (id: string) => {
    const res = await fetch(`/api/travel/expenses/${id}`, { method: 'DELETE' });
    checkResponse(res, 'delete expense');
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    pins, trips, expenses, loading,
    addPin, updatePin, deletePin,
    addTrip, updateTrip, deleteTrip,
    addExpense, updateExpense, deleteExpense,
    refresh: load,
  };
}
