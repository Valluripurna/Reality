import {
  DEFAULT_CONFIG,
  isBannerActive,
  normaliseRemoteConfig,
  pickBanner,
  BannerConfig
} from '../src/remote-config';

const banner = (over: Partial<BannerConfig> = {}): BannerConfig => ({
  id: 'b1',
  enabled: true,
  audience: 'customer',
  title: 'Hello',
  ...over
});

describe('remote banner config', () => {
  it('ships a banner for each surface', () => {
    expect(pickBanner(DEFAULT_CONFIG, 'customer')).not.toBeNull();
    expect(pickBanner(DEFAULT_CONFIG, 'pro')).not.toBeNull();
    expect(pickBanner(DEFAULT_CONFIG, 'bookings')).not.toBeNull();
    expect(pickBanner(DEFAULT_CONFIG, 'records')).not.toBeNull();
    expect(pickBanner(DEFAULT_CONFIG, 'customer')!.audience).toBe('customer');
  });

  it('matches the role, enabled flag and schedule window', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    expect(isBannerActive(banner(), 'customer', now)).toBe(true);
    expect(isBannerActive(banner(), 'pro', now)).toBe(false);
    expect(isBannerActive(banner({ enabled: false }), 'customer', now)).toBe(false);
    expect(isBannerActive(banner({ startsAt: '2026-10-21T00:00:00Z' }), 'customer', now)).toBe(false);
    expect(isBannerActive(banner({ endsAt: '2026-10-19T00:00:00Z' }), 'customer', now)).toBe(false);
    expect(isBannerActive(banner({ startsAt: 'not-a-date', endsAt: 'also-bad' }), 'customer', now)).toBe(true);
  });

  it('picks the first active banner for the role', () => {
    const config = {
      version: 2,
      banners: [
        banner({ id: 'off', enabled: false }),
        banner({ id: 'pro', audience: 'pro' }),
        banner({ id: 'live' })
      ]
    };
    expect(pickBanner(config, 'customer')!.id).toBe('live');
    expect(pickBanner(config, 'pro')!.id).toBe('pro');
  });

  it('rejects junk and coerces a safe subset', () => {
    expect(normaliseRemoteConfig(null)).toBeNull();
    expect(normaliseRemoteConfig({ banners: 'nope' })).toBeNull();
    expect(normaliseRemoteConfig({ banners: [{ id: '', title: 'x', audience: 'customer' }] })).toEqual({ version: 1, updatedAt: undefined, banners: [] });
  });

  it('drops bad audiences/actions and clamps long text', () => {
    const cfg = normaliseRemoteConfig({
      version: 3,
      updatedAt: '2026-10-20T00:00:00Z',
      banners: [
        { id: 'a', audience: 'admin', title: 'no' },
        { id: 'b', audience: 'customer', title: 'x'.repeat(400), body: 'y'.repeat(500), tone: 'neon', icon: 'sparkles', action: { type: 'route', href: 'https://evil.test' }, dismissible: false },
        { id: 'c', audience: 'pro', title: 'ok', action: { type: 'url', url: 'https://realitychain.app' } }
      ]
    });
    expect(cfg!.banners).toHaveLength(2);
    const [b, c] = cfg!.banners;
    expect(b.title).toHaveLength(180);
    expect(b.body).toHaveLength(300);
    expect(b.tone).toBe('brand');
    expect(b.action).toBeUndefined();
    expect(b.dismissible).toBe(false);
    expect(c.action).toEqual({ type: 'url', url: 'https://realitychain.app' });
  });

  it('accepts in-app routes but never a javascript: URL action', () => {
    const cfg = normaliseRemoteConfig({
      banners: [
        { id: 'route', audience: 'customer', title: 'ok', action: { type: 'route', href: '/profile' } },
        { id: 'js', audience: 'customer', title: 'bad', action: { type: 'url', url: 'javascript:alert(1)' } }
      ]
    });
    expect(cfg!.banners[0].action).toEqual({ type: 'route', href: '/profile' });
    // URL actions are rendered through the OS handler; javascript: is stripped.
    expect(cfg!.banners[1].action).toBeUndefined();
  });
});
