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

  it.each([
    ['kopiaGCEnabled', { kopiaGCEnabled: true, thirdPartyBackupEnabled: true }],
    ['thirdPartyBackupEnabled', { thirdPartyBackupEnabled: true }],
  ])('should keep %s on S3 and drop it on NFS, where only S3 uses it', (field, fields) => {
    const { wrapper, setting } = mountTarget({ type: 's3', ...fields });

    expect(JSON.parse(setting.value)[field]).toBe(true);

    wrapper.vm.parseDefaultValue.type = 'nfs';
    wrapper.vm.update();

    expect(JSON.parse(setting.value)[field]).toBeUndefined();
  });

  it('should offer the Restic and Kopia switch on S3', () => {
    const { wrapper } = mountTarget({ type: 's3' });

    expect(wrapper.find('[data-testid="backup-target-third-party-backup"]').exists()).toBe(true);
  });

  it('should ask for the repository password only while Restic and Kopia are on', () => {
    const off = mountTarget({ type: 's3' }).wrapper;
    const on = mountTarget({ type: 's3', thirdPartyBackupEnabled: true }).wrapper;

    expect(off.find('[data-testid="backup-target-repository-password"]').exists()).toBe(false);
    expect(on.find('[data-testid="backup-target-repository-password"]').exists()).toBe(true);
  });

  it('should offer Kopia garbage collection only while Restic and Kopia are on, the only time the backend runs it', () => {
    const off = mountTarget({ type: 's3' }).wrapper;
    const on = mountTarget({ type: 's3', thirdPartyBackupEnabled: true }).wrapper;

    expect(off.find('[data-testid="backup-target-kopia-gc"]').exists()).toBe(false);
    expect(on.find('[data-testid="backup-target-kopia-gc"]').exists()).toBe(true);
  });

  it('should drop Kopia garbage collection when Restic and Kopia are turned off, so the setting matches what runs', () => {
    const { wrapper, setting } = mountTarget({
      type: 's3', thirdPartyBackupEnabled: true, kopiaGCEnabled: true
    });

    expect(JSON.parse(setting.value).kopiaGCEnabled).toBe(true);

    wrapper.vm.parseDefaultValue.thirdPartyBackupEnabled = false;
    wrapper.vm.update();

    expect(JSON.parse(setting.value).kopiaGCEnabled).toBeUndefined();
  });

  it.each([
    ['Restic and Kopia are turned off', (vm) => {
      vm.parseDefaultValue.thirdPartyBackupEnabled = false;
    }],
    ['the target changes to NFS', (vm) => {
      vm.parseDefaultValue.type = 'nfs';
    }],
  ])('should drop the repository password when %s, which the backend rejects', (_, change) => {
    const { wrapper, setting } = mountTarget({
      type: 's3', thirdPartyBackupEnabled: true, thirdPartyRepositoryPassword: 'secret'
    });

    expect(JSON.parse(setting.value).thirdPartyRepositoryPassword).toBe('secret');

    change(wrapper.vm);
    wrapper.vm.update();

    expect(JSON.parse(setting.value).thirdPartyRepositoryPassword).toBeUndefined();
  });
});
