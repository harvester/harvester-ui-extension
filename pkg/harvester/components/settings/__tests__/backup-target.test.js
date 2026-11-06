import { shallowMount } from '@vue/test-utils';
import BackupTarget from '../backup-target.vue';

function mountTarget(target) {
  const setting = { value: JSON.stringify(target) };

  return {
    setting,
    wrapper: shallowMount(BackupTarget, {
      props:  { value: setting, mode: 'edit' },
      global: {
        mocks: {
          t:      (key) => key,
          $store: { getters: { 'harvester-common/getFeatureEnabled': () => true } },
        },
      },
    }),
  };
}

describe('component: backup-target', () => {
  it('should keep virtualHostedStyle, which is part of the Restic and Kopia repository identity', () => {
    const { setting } = mountTarget({ type: 's3', virtualHostedStyle: true });

    expect(JSON.parse(setting.value).virtualHostedStyle).toBe(true);
  });

  it('should default virtualHostedStyle to false', () => {
    const { setting } = mountTarget({ type: 's3' });

    expect(JSON.parse(setting.value).virtualHostedStyle).toBe(false);
  });

  it('should keep kopiaGCEnabled on S3 and drop it on NFS, where the webhook rejects it', async() => {
    const { wrapper, setting } = mountTarget({ type: 's3', kopiaGCEnabled: true });

    expect(JSON.parse(setting.value).kopiaGCEnabled).toBe(true);

    wrapper.vm.parseDefaultValue.type = 'nfs';
    wrapper.vm.update();

    expect(JSON.parse(setting.value).kopiaGCEnabled).toBeUndefined();
  });
});
