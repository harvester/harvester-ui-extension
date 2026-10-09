import { featureEnabled } from '../feature-flags';

describe('featureEnabled', () => {
  it('should enable a feature from the version it was released in', () => {
    expect(featureEnabled('hotplugNic', 'v1.7.0')).toBe(true);
    expect(featureEnabled('hotplugNic', 'v1.8.2')).toBe(true);
  });

  it('should not enable a feature before the version it was released in', () => {
    expect(featureEnabled('hotplugNic', 'v1.6.1')).toBe(false);
    expect(featureEnabled('hotplugCdRom', 'v1.7.1')).toBe(false);
  });

  it('should ignore pre-release suffixes of the server version', () => {
    expect(featureEnabled('hotplugCdRom', 'v1.8.0-rc1')).toBe(true);
    expect(featureEnabled('hotplugCdRom', 'v1.8.0-dev-20260101')).toBe(true);
  });

  it('should return false for unknown features', () => {
    expect(featureEnabled('doesNotExist', 'v1.8.0')).toBe(false);
  });

  it('should not enable anything for versions that are no longer supported', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(featureEnabled('cpuPinning', 'v1.2.0')).toBe(false);

    spy.mockRestore();
  });

  it('should return the same result for repeated calls with different arguments', () => {
    expect(featureEnabled('hotplugNic', 'v1.6.0')).toBe(false);
    expect(featureEnabled('hotplugNic', 'v1.7.0')).toBe(true);
    expect(featureEnabled('hotplugNic', 'v1.6.0')).toBe(false);
    expect(featureEnabled('hotplugNic', 'v1.7.0')).toBe(true);
  });
});
