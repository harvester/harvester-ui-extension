import { MANAGEMENT } from '@shell/config/types';
import SettingsPage from '../harvesterhci.io.setting.vue';
import { HCI } from '../../types';
import { HCI_SETTING } from '../../config/settings';

describe('list: harvesterhci.io.setting', () => {
  async function fetchPage({ visibleSettings = [], isSingleProduct = false } = {}) {
    const dispatch = jest.fn(() => Promise.resolve([]));
    const page = {
      initSettings: [],
      $store:       {
        dispatch,
        getters: {
          isSingleProduct,
          currentProduct:              { inStore: 'harvester' },
          'harvester/visibleSettings': visibleSettings,
        }
      }
    };

    await SettingsPage.fetch.call(page);

    return { page, dispatch };
  }

  const visible = (id, config = {}) => ({
    id, config, data: { id }
  });

  // The `customized` flag of a row in the settings list, for the given setting
  function customized(data, row = {}) {
    const [setting] = SettingsPage.computed.settings.call({ initSettings: [{ id: 'test', data, ...row }] });

    return !!setting.customized;
  }

  it('should list the visible settings sorted by name, a setting with an alias under its alias', async() => {
    const { page } = await fetchPage({ visibleSettings: [visible('z-setting'), visible(HCI_SETTING.UI_PL, { alias: 'branding' })] });

    expect(page.initSettings.map(({ id }) => id)).toStrictEqual(['branding', 'z-setting']);
  });

  it('should keep the config and the resource of a setting', async() => {
    const { page } = await fetchPage({ visibleSettings: [visible('a-setting', { kind: 'json', canReset: true })] });

    expect(page.initSettings[0]).toMatchObject({
      id: 'a-setting', kind: 'json', canReset: true, data: { id: 'a-setting' }, hide: true, canHide: true, hasActions: true
    });
  });

  it('should only allow actions on the server version when it is read only', async() => {
    const { page } = await fetchPage({
      visibleSettings: [
        visible('a-setting', { readOnly: true }),
        visible(HCI_SETTING.SERVER_VERSION, { readOnly: true }),
      ]
    });

    expect(page.initSettings.map(({ hasActions }) => hasActions)).toStrictEqual([false, true]);
  });

  it('should load the settings of the management store only in a single product', async() => {
    const { dispatch: multiCluster } = await fetchPage();
    const { dispatch: singleProduct } = await fetchPage({ isSingleProduct: true });

    expect(multiCluster.mock.calls).toStrictEqual([['harvester/findAll', { type: HCI.SETTING }]]);
    expect(singleProduct.mock.calls).toStrictEqual([
      ['harvester/findAll', { type: HCI.SETTING }],
      ['management/findAll', { type: MANAGEMENT.SETTING }],
    ]);
  });

  it('should tag a setting as modified when its value differs from the default', () => {
    expect(customized({ value: 'a', default: 'b' })).toBe(true);
  });

  it.each([
    [{ value: '', default: 'b' }],
    [{ value: 'b', default: 'b' }],
  ])('should not tag %j as modified', (data) => {
    expect(customized(data)).toBe(false);
  });

  it('should compare json settings by their content', () => {
    expect(customized({ value: '{ "a": 1 }', default: '{"a":1}' }, { kind: 'json' })).toBe(false);
    expect(customized({ value: '{"a":2}', default: '{"a":1}' }, { kind: 'json' })).toBe(true);
  });

  it('should let the setting decide when it knows what counts as modified', () => {
    expect(customized({
      value: 'a', default: 'b', hasCustomized: false
    })).toBe(false);
    expect(customized({
      value: '', default: '', hasCustomized: true
    })).toBe(true);
  });
});
