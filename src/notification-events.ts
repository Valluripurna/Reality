import { JobStage, ServiceJob } from './types';

/**
 * Decides which job updates deserve a notification. Kept pure so the rules can
 * be tested without a phone, a notification permission prompt or a server.
 */

export type NotifyRole = 'customer' | 'pro';

export type JobNotification = {
  key: string;
  title: string;
  body: string;
  jobId: string;
};

type StageCopy = { title: string; body: (job: ServiceJob) => string };

const digits = (phone?: string) => (phone || '').replace(/\D/g, '').slice(-10);
const money = (amount?: number) => (amount == null ? '' : `₹${Math.round(amount)}`);
const jobName = (job: ServiceJob) => job.title || job.kind || 'Service request';

const CUSTOMER_STAGES: Partial<Record<JobStage, StageCopy>> = {
  Assigned: {
    title: 'Pro confirmed',
    body: job => `${job.proName || 'Your pro'} accepted your request. Open the job for your arrival PIN.`
  },
  'On the way': {
    title: 'Your pro is on the way',
    body: job => `${job.proName || 'Your pro'} is heading to you now.`
  },
  'In progress': {
    title: 'Work has started',
    body: job => `${job.proName || 'Your pro'} started on ${jobName(job).toLowerCase()}.`
  },
  Completed: {
    title: 'Work completed',
    body: job => `${job.proName || 'Your pro'} marked the job complete. Review the work and leave a rating.`
  },
  Cancelled: {
    title: 'Request cancelled',
    body: () => 'This request was cancelled. You can book again any time.'
  }
};

function customerCandidates(job: ServiceJob): JobNotification[] {
  const out: JobNotification[] = [];
  if (job.stage === 'Matching') {
    // One notification per pro, using their latest quote.
    const latest = new Map<string, NonNullable<ServiceJob['bids']>[number]>();
    for (const bid of job.bids ?? []) {
      if (!bid || !bid.proPhone) continue;
      latest.set(digits(bid.proPhone), bid);
    }
    for (const bid of latest.values()) {
      out.push({
        key: `${job.id}:bid:${digits(bid.proPhone)}:${bid.bidAmount}`,
        title: `New quote from ${bid.proName || 'a pro'}`,
        body: `${money(bid.bidAmount)} for ${jobName(job)}. Open the job to accept or keep comparing.`,
        jobId: job.id
      });
    }
    return out;
  }
  const copy = CUSTOMER_STAGES[job.stage];
  if (copy) {
    out.push({
      key: `${job.id}:stage:${job.stage}`,
      title: copy.title,
      body: copy.body(job),
      jobId: job.id
    });
  }
  return out;
}

function proCandidates(job: ServiceJob, me: string): JobNotification[] {
  const out: JobNotification[] = [];
  const mine = digits(job.proPhone) === me;
  const customer = digits(job.customerPhone);
  const declined = (job.declinedPhones ?? []).some(p => digits(p) === me);
  const quoted = (job.bids ?? []).some(b => digits(b.proPhone) === me);

  if (!mine && job.stage === 'Matching' && customer !== me && !declined && !quoted) {
    const detail = job.budget != null ? ` · customer budget ${money(job.budget)}` : '';
    out.push({
      key: `${job.id}:open`,
      title: `New ${job.kind || 'service'} request`,
      body: `${jobName(job)}${detail}. Open it to send a quote.`,
      jobId: job.id
    });
  }

  if (!mine) return out;

  if (job.stage === 'Assigned') {
    out.push({
      key: `${job.id}:assigned`,
      title: 'You got the job',
      body: `${job.customerName || 'The customer'} accepted. Open the job for the arrival PIN.`,
      jobId: job.id
    });
  }
  if (job.paidAt) {
    out.push({
      key: `${job.id}:paid:${job.paidAt}`,
      title: 'Payment received',
      body: `${money(job.estimate)} for ${jobName(job)}.`,
      jobId: job.id
    });
  }
  if (job.rating != null) {
    out.push({
      key: `${job.id}:rating:${job.rating}`,
      title: `${job.rating}★ rating`,
      body: `The customer rated your ${job.kind || 'work'}. It helps you win more jobs.`,
      jobId: job.id
    });
  }
  return out;
}

export function collectJobNotifications({
  role,
  phone,
  jobs,
  seen,
  baseline = false
}: {
  role: NotifyRole;
  phone: string;
  jobs: ServiceJob[];
  seen: string[];
  baseline?: boolean;
}): { events: JobNotification[]; keys: string[] } {
  const me = digits(phone);
  if (!me) return { events: [], keys: [] };
  const known = new Set(seen);
  const candidates: JobNotification[] = [];

  for (const job of jobs) {
    const customer = digits(job.customerPhone);
    if (role === 'customer') {
      if (customer !== me) continue;
      candidates.push(...customerCandidates(job));
    } else {
      candidates.push(...proCandidates(job, me));
    }
  }

  const unique = [...new Map(candidates.map(item => [item.key, item])).values()];
  const keys = unique.map(item => item.key).slice(-400);
  if (baseline) return { events: [], keys };

  // First run seeds the current state so an existing job does not dump its
  // whole history into the tray; later runs only announce what is new.
  const fresh = unique.filter(item => !known.has(item.key));
  const cap = role === 'pro' ? 3 : 5;
  return { events: fresh.slice(0, cap), keys };
}

/** Extracts the job id from a notification's data payload or a /job/:id path. */
export function notificationJobId(data: unknown, pathname?: string | null): string | null {
  if (data && typeof data === 'object' && typeof (data as { jobId?: unknown }).jobId === 'string') {
    return (data as { jobId: string }).jobId;
  }
  const match = pathname ? pathname.match(/^\/job\/([^/?#]+)/) : null;
  return match ? decodeURIComponent(match[1]) : null;
}
