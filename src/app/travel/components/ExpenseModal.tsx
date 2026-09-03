'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EXPENSE_CATEGORY_CONFIG } from '../types';
import type { ExpenseCategory, TravelExpense } from '../types';

export function ExpenseModal({
  expense,
  onClose,
  onSave,
}: {
  expense?: TravelExpense;
  onClose: () => void;
  onSave: (data: { category: ExpenseCategory; description: string; amount: number; date: string | null }) => void | Promise<void>;
}) {
  const [description, setDescription] = useState(expense?.description || '');
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category || 'other');
  const [amount, setAmount] = useState(expense?.amount || '');
  const [date, setDate] = useState(expense?.date || '');
  const [saving, setSaving] = useState(false);

  const parsedAmount = parseFloat(amount);
  const isValid = description.trim().length > 0 && !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || saving) return;

    setSaving(true);
    try {
      await onSave({
        category,
        description: description.trim(),
        amount: parsedAmount,
        date: date || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Flights to Seattle"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(Object.keys(EXPENSE_CATEGORY_CONFIG) as ExpenseCategory[]).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(cat)}
                >
                  {EXPENSE_CATEGORY_CONFIG[cat].icon} {EXPENSE_CATEGORY_CONFIG[cat].label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Date (optional)</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || saving}>
              {saving ? 'Saving...' : expense ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
