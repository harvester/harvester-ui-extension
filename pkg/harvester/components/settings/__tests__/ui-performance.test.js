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

  it('should save every option when the setting starts empty, as the shell reads them without merging the defaults', () => {
    const ctx = component('');

    ctx.perfSetting.disableWebsocketNotification = false;
    ctx.update();

    expect(JSON.parse(ctx.value.value)).toStrictEqual({
      ...JSON.parse(JSON.stringify(DEFAULT_PERF_SETTING)),
      disableWebsocketNotification: false,
    });
  });

  it('should only reset the option with the use default button, keeping the other values in the setting', () => {
    const others = { manualRefresh: { enabled: true, threshold: 100 }, custom: 1 };
    const ctx = component(JSON.stringify({
      ...DEFAULT_PERF_SETTING, ...others, disableWebsocketNotification: false
    }));

    // As the form does before calling the component
    ctx.value.value = '';
    ctx.useDefault();

    expect(ctx.perfSetting.disableWebsocketNotification).toBe(DEFAULT_PERF_SETTING.disableWebsocketNotification);
    expect(JSON.parse(ctx.value.value)).toStrictEqual({
      ...JSON.parse(JSON.stringify(DEFAULT_PERF_SETTING)),
      ...others,
      disableWebsocketNotification: DEFAULT_PERF_SETTING.disableWebsocketNotification,
    });
  });

  it('should save an empty value with the use default button when the other values are at their defaults', () => {
    const ctx = component(JSON.stringify({ ...DEFAULT_PERF_SETTING, disableWebsocketNotification: false }));

    ctx.useDefault();

    expect(ctx.value.value).toBe('');
  });
});
