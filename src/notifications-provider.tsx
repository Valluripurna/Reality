import { usePathname, useRouter } from 'expo-router';
import { ReactNode, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useMarketplace } from './marketplace';
import {
  addNotificationResponseHandler,
  prepareNotifications,
  registerForPush,
  syncJobNotifications
} from './notification-bridge';

/**
 * Watches the signed-in account's jobs and turns meaningful transitions into
 * local notifications. Mounted under MarketplaceProvider in app/_layout.tsx.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile, jobs, ready } = useMarketplace();
  const router = useRouter();
  const pathname = usePathname();
  const role = profile?.role;
  const phone = profile?.phone;

  const jobsKey = useMemo(
    () =>
      jobs
        .map(j =>
          [
            j.id,
            j.stage,
            (j.bids ?? []).length,
            j.paidAt ?? '',
            j.rating ?? '',
            j.proPhone ?? ''
          ].join(':')
        )
        .join('|'),
    [jobs]
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    prepareNotifications().catch(() => {});
    return addNotificationResponseHandler(jobId => {
      if (jobId) router.push({ pathname: '/job/[id]', params: { id: jobId } });
    });
  }, [router]);

  useEffect(() => {
    if (!ready || !phone || !role) return;
    registerForPush(phone, role).catch(() => {});
  }, [ready, phone, role]);

  useEffect(() => {
    if (!ready || !phone || !role) return;
    const currentJobId = pathname?.startsWith('/job/') ? pathname.split('/')[2] : null;
    syncJobNotifications(role, phone, jobs, currentJobId).catch(() => {});
    // jobsKey captures the fields that matter without rerunning on every poll.
  }, [ready, phone, role, jobsKey, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
