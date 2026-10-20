import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RealityEvent, TimelineItem } from '../types';
import { DatabaseEngine } from '../db';

/**
 * Evidence timelines, scoped to the signed-in phone.
 *
 * The marketplace calls `switchUser` whenever the session changes. Records are
 * only written back once the current user's records have finished loading, so
 * one user's timeline can never be saved under (or shown to) another user.
 */
type Store = {
  events: RealityEvent[];
  ready: boolean;
  create: (title: string, type: string) => string;
  addItem: (eventId: string, item: TimelineItem) => void;
  setStatus: (id: string, status: RealityEvent['status']) => void;
  toggleResolved: (id: string) => void;
  switchUser: (phone?: string | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function stamp(at?: number | string) {
  const d = at === undefined ? new Date() : new Date(at);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EventProvider({ children }: React.PropsWithChildren) {
  const [events, setEvents] = useState<RealityEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  /** Phone whose records are currently loaded; null while a load is in flight. */
  const loadedFor = useRef<string | null>(null);
  const phoneRef = useRef<string | null>(null);

  const switchUser = useCallback((next?: string | null) => {
    const target = next ? next.replace(/\D/g, '').slice(-10) : null;
    if (target === phoneRef.current && loadedFor.current === target) return;
    phoneRef.current = target;
    loadedFor.current = null;
    setPhone(target);
    // Drop the previous account's records straight away; never merge across accounts.
    setEvents([]);
    if (!target) {
      setReady(true);
      return;
    }
    DatabaseEngine.loadEvents(target).then(loaded => {
      if (phoneRef.current !== target) return; // a newer switch won
      setEvents(current => {
        // Keep anything created while the load was in flight.
        const ids = new Set((loaded ?? []).map(e => e.id));
        return [...current.filter(e => !ids.has(e.id)), ...(Array.isArray(loaded) ? loaded : [])];
      });
      loadedFor.current = target;
      setReady(true);
    });
  }, []);

  // Initial session.
  useEffect(() => {
    DatabaseEngine.getActivePhone().then(active => switchUser(active || null));
  }, [switchUser]);

  useEffect(() => {
    if (!phone || loadedFor.current !== phone) return;
    DatabaseEngine.saveEvents(events, phone);
  }, [events, phone]);

  const value = useMemo<Store>(() => ({
    events,
    ready,
    switchUser,
    create(title, type) {
      const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      setEvents(prev => [{
        id,
        title,
        type,
        status: 'Open',
        startedAt: stamp(),
        items: [{ id: `${id}-open`, kind: 'Note', title: 'Record opened', detail: 'Created on this device', at: stamp() }]
      }, ...prev]);
      return id;
    },
    addItem(eventId, item) {
      setEvents(prev => {
        const target = prev.find(e => e.id === eventId);
        if (!target) return prev;
        if (target.items.some(i => i.id === item.id)) return prev; // idempotent
        const at = item.at === 'Now' ? stamp() : item.at;
        return prev.map(e => (e.id === eventId ? { ...e, items: [...e.items, { ...item, at }] } : e));
      });
    },
    setStatus(id, status) {
      setEvents(prev => prev.map(e => (e.id === id && e.status !== status ? { ...e, status } : e)));
    },
    toggleResolved(id) {
      setEvents(prev => prev.map(e => (e.id === id ? { ...e, status: e.status === 'Open' ? 'Resolved' : 'Open' } : e)));
    }
  }), [events, ready, switchUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEvents = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('Event provider missing');
  return c;
};
