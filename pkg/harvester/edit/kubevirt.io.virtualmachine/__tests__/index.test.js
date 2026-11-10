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
