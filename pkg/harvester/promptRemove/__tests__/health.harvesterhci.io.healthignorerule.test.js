import { mount, flushPromises } from '@vue/test-utils';
import Banner from '@components/Banner/Banner.vue';
import PromptRemoveIgnoreRule from '../health.harvesterhci.io.healthignorerule.vue';

function ruleOf(checkKey, remove = () => {}) {
  return { spec: { componentHealth: 'h', checkKey }, remove: jest.fn(remove) };
}

function mountPrompt(value) {
  const close = jest.fn();
  const prompt = mount(PromptRemoveIgnoreRule, {
    props:  { value, close },
    global: { mocks: { $store: { getters: { 'i18n/t': (key) => key } } } },
  });

  return { prompt, close };
}

describe('promptRemove: health.harvesterhci.io.healthignorerule', () => {
  it('names the check the rule is for, not the rule', () => {
    const { prompt } = mountPrompt([ruleOf('ImageRetryLimitExceeded')]);

    expect(prompt.find('b').text()).toBe('ImageRetryLimitExceeded');
  });

  it('deletes the rule and closes', async() => {
    const rule = ruleOf('a');
    const { prompt, close } = mountPrompt([rule]);
    const buttonDone = jest.fn();

    await prompt.vm.remove(buttonDone);

    expect(rule.remove).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith(buttonDone);
    expect(buttonDone).not.toHaveBeenCalled();
  });

  it('shows why the rule could not be deleted and stays open', async() => {
    const { prompt, close } = mountPrompt([ruleOf('a', () => Promise.reject(new Error('forbidden')))]);
    const buttonDone = jest.fn();

    await prompt.vm.remove(buttonDone);
    await flushPromises();

    expect(prompt.findComponent(Banner).text()).toContain('forbidden');
    expect(close).not.toHaveBeenCalled();
    expect(buttonDone).toHaveBeenCalledWith(false);
  });
});
