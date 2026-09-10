'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { Plus, Trash2, GripVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

interface Favorite {
  id: string;
  channelName: string;
  channelNumber: string | null;
  sortOrder: number;
  logoUrl: string;
}

interface Instance {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  uuid: string | null;
  name: string;
  number: string | number | null;
  logoId: string | number | null;
}

export function DispatcharrFavoritesSection() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);

  const [companionUrl, setCompanionUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Channel[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dispatcharr-favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites ?? []);
      }
    } catch {
      // Silent fail — loading state will clear
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const value = data?.settings?.dispatcharrNowUrl;
        if (typeof value === 'string') setCompanionUrl(value);
      })
      .catch(() => {});
  }, []);

  const handleSaveUrl = async () => {
    setSavingUrl(true);
    try {
      const saveRes = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dispatcharrNowUrl', value: companionUrl.trim() }),
      });
      if (!saveRes.ok) throw new Error('save failed');

      const checkRes = await fetch('/api/dispatcharr-favorites/instances');
      if (checkRes.ok) {
        const data = await checkRes.json();
        const count = data.instances?.length ?? 0;
        toast({ title: 'Saved', description: `Connected — found ${count} instance${count === 1 ? '' : 's'}.` });
        setUnconfigured(false);
        fetchFavorites();
      } else {
        toast({
          title: 'Saved, but could not connect',
          description: "Check the URL and that its host is in PRISM_ALLOWED_INTERNAL_HOSTS (server env, needs a restart).",
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingUrl(false);
    }
  };

  const openAddDialog = async () => {
    setShowAddDialog(true);
    setQuery('');
    setResults([]);
    try {
      const res = await fetch('/api/dispatcharr-favorites/instances');
      if (res.status === 502) {
        setUnconfigured(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setInstances(data.instances ?? []);
        if (data.instances?.length === 1) setSelectedInstanceId(data.instances[0].id);
      }
    } catch {
      setUnconfigured(true);
    }
  };

  // Debounced channel search, same shape as useLocationSearch.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!selectedInstanceId || query.length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/dispatcharr-favorites/channels?instanceId=${encodeURIComponent(selectedInstanceId)}&q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.channels ?? []);
      } catch {
        /* ignore */
      }
      setSearching(false);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedInstanceId]);

  const handleAdd = async (channel: Channel) => {
    try {
      const res = await fetch('/api/dispatcharr-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          channelUuid: channel.uuid,
          channelId: channel.id,
          channelName: channel.name,
          channelNumber: channel.number != null ? String(channel.number) : undefined,
          logoId: channel.logoId != null ? String(channel.logoId) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      toast({ title: `Added ${channel.name}` });
      fetchFavorites();
    } catch {
      toast({ title: 'Failed to add channel', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dispatcharr-favorites/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.id !== id));
        toast({ title: 'Favorite removed' });
      }
    } catch {
      toast({ title: 'Failed to remove favorite', variant: 'destructive' });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = favorites.findIndex((f) => f.id === active.id);
    const newIndex = favorites.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(favorites, oldIndex, newIndex).map((f, i) => ({ ...f, sortOrder: i }));
    setFavorites(reordered); // optimistic

    try {
      const res = await fetch('/api/dispatcharr-favorites/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((f) => ({ id: f.id, sortOrder: f.sortOrder }))),
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch {
      toast({ title: 'Failed to save order', variant: 'destructive' });
      fetchFavorites(); // revert
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">TV Favorites</h2>
        <p className="text-muted-foreground">
          Pick channels to show in the TV Favorites dashboard widget. Tapping one launches it in VLC.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Companion Server</CardTitle>
          <CardDescription>
            Base URL of your dispatcharr-now service. Its host also needs to be in{' '}
            <code>PRISM_ALLOWED_INTERNAL_HOSTS</code> (server environment — requires a restart the
            first time you point at a new host).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="http://192.168.0.100:8790"
              value={companionUrl}
              onChange={(e) => setCompanionUrl(e.target.value)}
            />
            <Button onClick={handleSaveUrl} disabled={savingUrl || !companionUrl.trim()}>
              {savingUrl ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Favorite Channels</CardTitle>
              <CardDescription>Requires a running dispatcharr-now companion server.</CardDescription>
            </div>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1" /> Add Channel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
            </div>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No favorite channels yet. Add one to show it on the dashboard.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={favorites.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {favorites.map((favorite) => (
                    <SortableFavoriteRow
                      key={favorite.id}
                      favorite={favorite}
                      onDelete={() => handleDelete(favorite.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a channel</DialogTitle>
          </DialogHeader>

          {unconfigured ? (
            <p className="text-sm text-muted-foreground">
              Can&apos;t reach the TV service. Set the Companion Server URL above and make sure
              dispatcharr-now is running.
            </p>
          ) : (
            <div className="space-y-3">
              {instances.length > 1 && (
                <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a Dispatcharr instance" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>{instance.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {instances.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No Dispatcharr instances configured in dispatcharr-now yet.
                </p>
              )}

              {selectedInstanceId && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search channels..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              )}

              <div className="max-h-72 overflow-y-auto space-y-1">
                {searching && <p className="text-xs text-muted-foreground px-1">Searching...</p>}
                {results.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => handleAdd(channel)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/dispatcharr-favorites/logo/${selectedInstanceId}/${channel.id}`}
                      alt=""
                      className="h-6 w-6 rounded object-contain shrink-0"
                    />
                    <span className="text-sm truncate">{channel.name}</span>
                    {channel.number != null && (
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">Ch {channel.number}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SortableFavoriteRow({
  favorite,
  onDelete,
}: {
  favorite: Favorite;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: favorite.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-muted-foreground hover:text-foreground flex-shrink-0"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={favorite.logoUrl} alt="" className="h-8 w-8 rounded object-contain shrink-0" />
        <div className="min-w-0">
          <span className="font-medium text-sm truncate block">{favorite.channelName}</span>
          {favorite.channelNumber && (
            <span className="text-xs text-muted-foreground">Ch {favorite.channelNumber}</span>
          )}
        </div>
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
