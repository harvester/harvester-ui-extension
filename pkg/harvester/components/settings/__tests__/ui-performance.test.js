import { DEFAULT_PERF_SETTING } from '@shell/config/settings';
import UIPerformance from '../ui-performance.vue';

// The component's `this` for the given setting value
function component(value) {
  const ctx = { value: { value } };

  Object.assign(ctx, UIPerformance.data.call(ctx));
  Object.entries(UIPerformance.methods).forEach(([name, fn]) => {
    ctx[name] = fn.bind(ctx);
  });

  return ctx;
}

describe('component: settings/ui-performance', () => {
  it('should start from the defaults when the setting is empty', () => {
    expect(component('').perfSetting).toStrictEqual(DEFAULT_PERF_SETTING);
  });

  it('should start from the defaults when the setting is not valid JSON', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(component('{').perfSetting).toStrictEqual(DEFAULT_PERF_SETTING);

    warn.mockRestore();
  });

  it('should keep the other values in the setting when the option changes', () => {
    const ctx = component(JSON.stringify({ custom: 1, disableWebsocketNotification: true }));

    ctx.perfSetting.disableWebsocketNotification = false;
    ctx.update();

    expect(JSON.parse(ctx.value.value)).toStrictEqual({
      ...JSON.parse(JSON.stringify(DEFAULT_PERF_SETTING)),
      custom:                       1,
      disableWebsocketNotification: false,
    });
  });

  it('should save an empty value when the option goes back to its default', () => {
    const ctx = component(JSON.stringify({ ...DEFAULT_PERF_SETTING, disableWebsocketNotification: false }));

    ctx.perfSetting.disableWebsocketNotification = true;
    ctx.update();

    expect(ctx.value.value).toBe('');
  });

  it('should go back to the default option with the use default button', () => {
    const ctx = component(JSON.stringify({ disableWebsocketNotification: false }));

    ctx.useDefault();

    expect(ctx.perfSetting.disableWebsocketNotification).toBe(DEFAULT_PERF_SETTING.disableWebsocketNotification);
  });
});
