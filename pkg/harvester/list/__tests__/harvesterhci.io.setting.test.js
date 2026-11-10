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
});
