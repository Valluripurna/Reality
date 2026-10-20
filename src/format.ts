import { JobStage } from './types';

export function formatWhen(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
}

export function stageTone(stage: JobStage): 'neutral' | 'brand' | 'amber' | 'danger' | 'dark' {
  switch (stage) {
    case 'Completed': return 'brand';
    case 'Cancelled': return 'neutral';
    case 'Matching': return 'amber';
    default: return 'dark';
  }
}

export function stageText(stage: JobStage, quotes = 0) {
  if (stage === 'Matching') return quotes ? `${quotes} quote${quotes > 1 ? 's' : ''}` : 'Finding pros';
  return stage;
}
