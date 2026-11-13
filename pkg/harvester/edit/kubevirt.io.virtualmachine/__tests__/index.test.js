import { STORAGE_CLASS } from '@shell/config/types';
import VM_MIXIN from '@pkg/harvester/mixins/harvester-vm';
import HarvesterEditVM from '../index.vue';

function saveWith(userScript) {
  const buttonCb = jest.fn();
  const form = {
    userScript,
    errors:                 [],
    isSingle:               true,
    t:                      (key) => key,
    validateCPUMemory:      jest.fn(),
    validateWindowsSysprep: jest.fn(),
    validateCloudInit:      VM_MIXIN.methods.validateCloudInit,
    saveSingle:             jest.fn(),
  };

  HarvesterEditVM.methods.saveVM.call(form, buttonCb);

  return { form, buttonCb };
}

describe('page: kubevirt.io.virtualmachine edit', () => {
  it('shows the persistent state storage hint only when vmstate-persistence is missing', () => {
    const hasVMStateStorageClass = HarvesterEditVM.computed.hasVMStateStorageClass;
    const storageClasses = (storageClassNames) => ({
      inStore: 'harvester',
      $store:  { getters: { 'harvester/all': (type) => type === STORAGE_CLASS ? storageClassNames.map((name) => ({ metadata: { name } })) : [] } },
    });

    expect(hasVMStateStorageClass.call(storageClasses([]))).toBe(false);
    expect(hasVMStateStorageClass.call(storageClasses(['vmstate-persistence']))).toBe(true);
  });

  it('shows the persistent state storage banner outside view mode when vmstate-persistence is missing', () => {
    const showPersistentStateStorageBanner = HarvesterEditVM.computed.showPersistentStateStorageBanner;

    expect(showPersistentStateStorageBanner.call({ hasVMStateStorageClass: false, mode: 'create' })).toBe(true);
    expect(showPersistentStateStorageBanner.call({ hasVMStateStorageClass: false, mode: 'edit' })).toBe(true);
    expect(showPersistentStateStorageBanner.call({ hasVMStateStorageClass: true, mode: 'create' })).toBe(false);
    expect(showPersistentStateStorageBanner.call({ hasVMStateStorageClass: false, mode: 'view' })).toBe(false);
  });

  it('clears persistent state selections only for create mode without vmstate-persistence', () => {
    const clearPersistentState = HarvesterEditVM.methods.clearPersistentStateWithoutStorageClass;

    const createForm = {
      efiPersistentStateEnabled: true,
      mode:                      'create',
      tpmPersistentStateEnabled: true,
    };

    clearPersistentState.call(createForm);

    expect(createForm.tpmPersistentStateEnabled).toBe(false);
    expect(createForm.efiPersistentStateEnabled).toBe(false);

    const editForm = {
      efiPersistentStateEnabled: true,
      mode:                      'edit',
      tpmPersistentStateEnabled: true,
    };

    clearPersistentState.call(editForm);

    expect(editForm.tpmPersistentStateEnabled).toBe(true);
    expect(editForm.efiPersistentStateEnabled).toBe(true);

    const storageClassForm = {
      efiPersistentStateEnabled: true,
      hasVMStateStorageClass:      true,
      mode:                        'create',
      tpmPersistentStateEnabled:   true,
    };

    clearPersistentState.call(storageClassForm);

    expect(storageClassForm.tpmPersistentStateEnabled).toBe(true);
    expect(storageClassForm.efiPersistentStateEnabled).toBe(true);
  });

  it('should stop the save when the cloud config is invalid', () => {
    const { form, buttonCb } = saveWith('#cloud-config\nsome words\n');

    expect(form.errors).toStrictEqual(['harvester.virtualMachine.cloudConfig.user.invalidYaml']);
    expect(buttonCb).toHaveBeenCalledWith(false);
    expect(form.saveSingle).not.toHaveBeenCalled();
  });

  it('should save when the user data is a script', () => {
    const { form, buttonCb } = saveWith('#!/bin/bash\napt-get update\n# start it\nsystemctl enable --now nginx\n');

    expect(form.errors).toStrictEqual([]);
    expect(form.saveSingle).toHaveBeenCalledWith(buttonCb);
  });
});
