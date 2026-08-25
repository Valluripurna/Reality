import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { RealityEvent, TimelineItem } from '../types';

const starter: RealityEvent[] = [{ id: 'ac-repair', title: 'AC repair', type: 'Home maintenance', status: 'Open', startedAt: 'Today, 10:00 AM', items: [
  { id: '1', kind: 'Note', title: 'Problem noticed', detail: 'AC is blowing warm air', at: '10:00 AM' },
  { id: '2', kind: 'Photo', title: 'Condition documented', detail: 'Photo captured on device', at: '10:03 AM' },
  { id: '3', kind: 'Action', title: 'Provider contacted', detail: 'Requested a service visit', at: '10:15 AM' }
] }];
type Store = { events: RealityEvent[]; ready: boolean; create: (title: string, type: string) => string; addItem: (eventId: string, item: TimelineItem) => void; toggleResolved: (id: string) => void };
const Ctx = createContext<Store | null>(null);
export function EventProvider({ children }: React.PropsWithChildren) {
  const [events, setEvents] = useState<RealityEvent[]>(starter); const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem('realitychain-events').then(v => { if (v) setEvents(JSON.parse(v)); setReady(true); }); }, []);
  useEffect(() => { if (ready) AsyncStorage.setItem('realitychain-events', JSON.stringify(events)); }, [events, ready]);
  const value = useMemo(() => ({ events, ready, create(title: string, type: string) { const id = Date.now().toString(); setEvents(p => [{ id, title, type, status: 'Open', startedAt: 'Just now', items: [{ id: `${id}-note`, kind: 'Note', title: 'Event created', detail: 'Started on this device', at: 'Now' }] }, ...p]); return id; }, addItem(eventId: string, item: TimelineItem) { setEvents(p => p.map(e => e.id === eventId ? { ...e, items: [...e.items, item] } : e)); }, toggleResolved(id: string) { setEvents(p => p.map(e => e.id === id ? { ...e, status: e.status === 'Open' ? 'Resolved' : 'Open' } : e)); } }), [events, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useEvents = () => { const c = useContext(Ctx); if (!c) throw new Error('Event provider missing'); return c; };
