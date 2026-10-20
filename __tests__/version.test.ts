import { updateLabel, VersionInfo, versionLabel } from '../src/version';
import { shortUpdateId } from '../src/updates';

const info = (over: Partial<VersionInfo> = {}): VersionInfo => ({
  versionName: '1.0.0',
  versionCode: '1',
  runtimeVersion: '1.0.0',
  channel: 'production',
  updateId: null,
  updateCreatedAt: null,
  embedded: true,
  ...over
});

describe('version labels', () => {
  it('shows version name and version code', () => {
    expect(versionLabel(info())).toBe('v1.0.0 (1)');
    expect(versionLabel(info({ versionName: '2.3.0', versionCode: '17' }))).toBe('v2.3.0 (17)');
  });

  it('describes an embedded bundle versus an OTA bundle', () => {
    expect(updateLabel(info())).toBe('Built-in bundle');
    const label = updateLabel(info({
      updateId: '1234abcd-0000-4000-8000-000000000000',
      updateCreatedAt: new Date('2026-10-20T08:00:00Z')
    }));
    expect(label).toMatch(/^OTA 1234abcd · \d{1,2} [A-Za-z]{3}$/);
  });

  it('shortens EAS update ids for display', () => {
    expect(shortUpdateId(null)).toBe('embedded');
    expect(shortUpdateId('1234abcd-0000-4000-8000-000000000000')).toBe('1234abcd');
  });
});
