import { MANAGEMENT } from '@shell/config/types';
import { HCI_SETTING, HCI_SINGLE_CLUSTER_ALLOWED_SETTING } from '@pkg/harvester/config/settings';
import HarvesterEditSetting from '../harvesterhci.io.setting.vue';

const { AUTH_USER_SESSION_TTL_MINUTES: TTL, AUTH_USER_SESSION_IDLE_TTL_MINUTES: IDLE_TTL } = HCI_SETTING;

// The form's `this` for the save methods: the edited setting, and the other session setting as the store returns it
function form(id, value, other = { value: '', default: '960' }) {
  const dispatch = jest.fn((action) => {
    if (action === 'management/find') {
      return other instanceof Error ? Promise.reject(other) : Promise.resolve(other);
    }

    return Promise.resolve();
  });

  const ctx = {
    value:    {
      id, metadata: { name: id }, value
    },
    setting:  HCI_SINGLE_CLUSTER_ALLOWED_SETTING[id] || { kind: 'string' },
    oldValue: value,
    errors:   [],
    save:     jest.fn(),
    $store:   {
      dispatch,
      getters: { 'i18n/t': (key, args) => (args ? `${ key }-${ JSON.stringify(args) }` : key) },
    },
  };

  Object.entries(HarvesterEditSetting.methods).forEach(([name, fn]) => {
    ctx[name] = fn.bind(ctx);
  });

  return ctx;
}

describe('edit: harvesterhci.io.setting session timeouts', () => {
  it('should register both session settings as numbers behind the sessionTimeoutSettings flag', () => {
    [TTL, IDLE_TTL].forEach((id) => {
      expect(HCI_SINGLE_CLUSTER_ALLOWED_SETTING[id]).toStrictEqual({ kind: 'number', featureFlag: 'sessionTimeoutSettings' });
    });
  });

  it('should register the websocket notifications option behind its own flag, with the shell description', () => {
    expect(HCI_SINGLE_CLUSTER_ALLOWED_SETTING[HCI_SETTING.UI_PERFORMANCE]).toStrictEqual({
      kind:           'custom',
      from:           'import',
      alias:          'disable-websocket-notifications',
      canReset:       true,
      descriptionKey: 'performance.websocketNotification.description',
      featureFlag:    'websocketNotificationsSetting',
    });
  });

  it.each(['0', '-1', 'abc', '1.5', '1000000000000000000000'])('should reject %p as an idle timeout, as the Rancher webhook does', async(value) => {
    await expect(form(IDLE_TTL, value).validateSessionTTL()).resolves.toBe('harvester.setting.sessionTTL.invalidIdle');
  });

  it.each(['-1', 'abc', '1.5', '1000000000000000000000'])('should reject %p as a session timeout, as the Rancher webhook does', async(value) => {
    await expect(form(TTL, value).validateSessionTTL()).resolves.toBe('harvester.setting.sessionTTL.invalidTTL');
  });

  it.each([TTL, IDLE_TTL])('should accept an empty %s, which means its default', async(id) => {
    await expect(form(id, '').validateSessionTTL()).resolves.toBeNull();
  });

  it('should accept 0 as a session timeout, as the Rancher webhook does', async() => {
    await expect(form(TTL, '0').validateSessionTTL()).resolves.toBeNull();
  });

  it('should accept an idle timeout lower than or equal to the session timeout', async() => {
    await expect(form(IDLE_TTL, '30').validateSessionTTL()).resolves.toBeNull();
    await expect(form(IDLE_TTL, '960').validateSessionTTL()).resolves.toBeNull();
  });

  it('should compare the idle timeout with the session timeout default when it has no value', async() => {
    const ctx = form(IDLE_TTL, '120', { value: '', default: '60' });

    await expect(ctx.validateSessionTTL()).resolves.toBe('harvester.setting.sessionTTL.idleExceedsTTL-{"ttl":60}');
    expect(ctx.$store.dispatch).toHaveBeenCalledWith('management/find', { type: MANAGEMENT.SETTING, id: TTL });
  });

  it('should reject an idle timeout greater than the session timeout', async() => {
    const ctx = form(IDLE_TTL, '120', { value: '60' });

    await expect(ctx.validateSessionTTL()).resolves.toBe('harvester.setting.sessionTTL.idleExceedsTTL-{"ttl":60}');
  });

  it('should reject any idle timeout when the session timeout is 0, as the Rancher webhook does', async() => {
    const ctx = form(IDLE_TTL, '1', { value: '0' });

    await expect(ctx.validateSessionTTL()).resolves.toBe('harvester.setting.sessionTTL.idleExceedsTTL-{"ttl":0}');
  });

  it('should accept a session timeout lower than the idle timeout, as the Rancher webhook does', async() => {
    const ctx = form(TTL, '30', { value: '60' });

    await expect(ctx.validateSessionTTL()).resolves.toBeNull();
    expect(ctx.$store.dispatch).not.toHaveBeenCalled();
  });

  it('should only check the value itself when the session timeout cannot be read', async() => {
    await expect(form(IDLE_TTL, '120', new Error('forbidden')).validateSessionTTL()).resolves.toBeNull();
    await expect(form(IDLE_TTL, '120', { value: '', default: '' }).validateSessionTTL()).resolves.toBeNull();
  });

  it('should not validate other settings', async() => {
    const ctx = form(HCI_SETTING.UI_SOURCE, '0');

    await expect(ctx.validateSessionTTL()).resolves.toBeNull();
    expect(ctx.$store.dispatch).not.toHaveBeenCalled();
  });

  it('should not save an invalid session timeout', async() => {
    const ctx = form(IDLE_TTL, '120', { value: '60' });
    const done = jest.fn();

    await ctx.saveSettings(done);

    expect(done).toHaveBeenCalledWith(false);
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.errors).toHaveLength(1);
  });

  it('should not save a number too large to keep as a whole number', async() => {
    const ctx = form(TTL, '1000000000000000000000');
    const done = jest.fn();

    await ctx.saveSettings(done);

    expect(done).toHaveBeenCalledWith(false);
    expect(ctx.value.value).toBe('1000000000000000000000');
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should validate what was typed, before removing leading zeros', async() => {
    const ctx = form(TTL, 'abc');
    const done = jest.fn();

    await ctx.saveSettings(done);

    expect(done).toHaveBeenCalledWith(false);
    expect(ctx.value.value).toBe('abc');
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('should save a valid session timeout without leading zeros', async() => {
    const ctx = form(IDLE_TTL, '030');
    const done = jest.fn();

    await ctx.saveSettings(done);

    expect(ctx.value.value).toBe('30');
    expect(ctx.save).toHaveBeenCalledWith(done);
  });
});
