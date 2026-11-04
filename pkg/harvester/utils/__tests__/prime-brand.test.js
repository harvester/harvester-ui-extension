import { primeBrandUpdater } from '../prime-brand';

describe('primeBrandUpdater', () => {
  it('should switch the brand to suse on Prime', () => {
    const setting = { value: 'harvester' };

    primeBrandUpdater()(setting, true);

    expect(setting.value).toBe('suse');
  });

  it('should keep the brand of the server when not on Prime', () => {
    const setting = { value: 'harvester' };

    primeBrandUpdater()(setting, false);

    expect(setting.value).toBe('harvester');
  });

  it('should put the brand of the server back when the flavor stops being Prime', () => {
    const setting = { value: 'harvester' };
    const update = primeBrandUpdater();

    update(setting, true);
    update(setting, false);

    expect(setting.value).toBe('harvester');
  });

  it('should switch the brand to suse again when the server sends its brand back on Prime', () => {
    const setting = { value: 'harvester' };
    const update = primeBrandUpdater();

    update(setting, true);
    setting.value = 'harvester';
    update(setting, true);

    expect(setting.value).toBe('suse');
  });

  it('should keep an empty brand of the server when not on Prime', () => {
    const setting = { value: '' };
    const update = primeBrandUpdater();

    update(setting, true);
    update(setting, false);

    expect(setting.value).toBe('');
  });

  it('should do nothing before the setting is loaded', () => {
    expect(() => primeBrandUpdater()(undefined, true)).not.toThrow();
  });
});
