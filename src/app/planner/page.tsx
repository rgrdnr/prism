import { Suspense } from 'react';
import { PlannerView } from './PlannerView';

export const metadata = {
  title: 'Weekly Planner',
  description: 'A print-style weekly view of meals, activities, goals, and notes.',
};

export default function PlannerPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<PlannerSkeleton />}>
        <PlannerView />
      </Suspense>
    </main>
  );
}

function PlannerSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-56 bg-muted/40 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
