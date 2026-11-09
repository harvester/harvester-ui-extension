import { shallowMount } from '@vue/test-utils';
import ThirdPartyBackupConfig from '../third-party-backup-config.vue';

const JOB = {
  memoryRequest: '1Gi', memoryLimit: '4Gi', cacheSize: '2Gi', maxConcurrentJobs: 5, ephemeralRequest: '512Mi', ephemeralLimit: '3Gi'
};
const DEFAULT = JSON.stringify({ restic: { ...JOB, noCache: false }, kopia: JOB });

function mountConfig(value) {
  const setting = { value, default: DEFAULT };

  return {
    setting,
    wrapper: shallowMount(ThirdPartyBackupConfig, {
      props:  { value: setting, registerBeforeHook: jest.fn() },
      global: {
        mocks: { t: (key) => key },
        stubs: { RcSection: { template: '<section><slot /></section>' } },
      },
    }),
  };
}

describe('component: third-party-backup-config', () => {
  it('should fill omitted fields from the default', () => {
    const { wrapper } = mountConfig(JSON.stringify({ kopia: { memoryLimit: '8Gi' } }));

    expect(wrapper.vm.config.kopia).toStrictEqual({ ...JOB, memoryLimit: '8Gi' });
    expect(wrapper.vm.config.restic.noCache).toBe(false);
  });

  it('should show the default values when the setting is empty', () => {
    const { wrapper } = mountConfig('');

    expect(wrapper.vm.config).toStrictEqual(JSON.parse(DEFAULT));
  });

  it('should write the form to the setting before saving', async() => {
    const { wrapper, setting } = mountConfig('');

    wrapper.vm.config.kopia.maxConcurrentJobs = 0;
    await wrapper.vm.willSave();

    expect(JSON.parse(setting.value).kopia.maxConcurrentJobs).toBe(0);
  });

  it('should go back to the default', () => {
    const { wrapper, setting } = mountConfig(JSON.stringify({ kopia: { memoryLimit: '8Gi' } }));

    wrapper.vm.useDefault();

    expect(wrapper.vm.config).toStrictEqual(JSON.parse(DEFAULT));
    expect(JSON.parse(setting.value)).toStrictEqual(JSON.parse(DEFAULT));
  });

  it('should show the default values when the setting is not JSON', () => {
    const { wrapper } = mountConfig('{not json');

    expect(wrapper.vm.config).toStrictEqual(JSON.parse(DEFAULT));
  });
});
