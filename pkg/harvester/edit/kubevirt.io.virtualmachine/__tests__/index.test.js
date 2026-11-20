import { readFileSync } from 'fs';
import { resolve } from 'path';
import { STORAGE_CLASS } from '@shell/config/types';
import VM_MIXIN from '@pkg/harvester/mixins/harvester-vm';
import HarvesterEditVM from '../index.vue';

const vmFormSource = readFileSync(resolve(__dirname, '../index.vue'), 'utf8');
const translations = readFileSync(resolve(__dirname, '../../../l10n/en-us.yaml'), 'utf8');

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

  it('waits for StorageClasses before treating vmstate-persistence as unavailable', () => {
    const vmStateStorageClassUnavailable = HarvesterEditVM.computed.vmStateStorageClassUnavailable;

    expect(vmStateStorageClassUnavailable.call({ hasVMStateStorageClass: false, storageClassesLoaded: false })).toBe(false);
    expect(vmStateStorageClassUnavailable.call({ hasVMStateStorageClass: false, storageClassesLoaded: true })).toBe(true);
    expect(vmStateStorageClassUnavailable.call({ hasVMStateStorageClass: true, storageClassesLoaded: true })).toBe(false);
  });

  it('shows the persistent state storage banner outside view mode when vmstate-persistence is unavailable', () => {
    const showPersistentStateStorageBanner = HarvesterEditVM.computed.showPersistentStateStorageBanner;

    expect(showPersistentStateStorageBanner.call({ mode: 'create', vmStateStorageClassUnavailable: true })).toBe(true);
    expect(showPersistentStateStorageBanner.call({ mode: 'edit', vmStateStorageClassUnavailable: true })).toBe(true);
    expect(showPersistentStateStorageBanner.call({ mode: 'create', vmStateStorageClassUnavailable: false })).toBe(false);
    expect(showPersistentStateStorageBanner.call({ mode: 'view', vmStateStorageClassUnavailable: true })).toBe(false);
  });

  it('blocks new persistent state without vmstate-persistence while allowing it to be turned off', () => {
    const isPersistentStateControlDisabled = HarvesterEditVM.methods.isPersistentStateControlDisabled;

    expect(isPersistentStateControlDisabled.call({ vmStateStorageClassUnavailable: false }, false)).toBe(false);
    expect(isPersistentStateControlDisabled.call({ vmStateStorageClassUnavailable: true }, false)).toBe(true);
    expect(isPersistentStateControlDisabled.call({ vmStateStorageClassUnavailable: true }, true)).toBe(false);
  });

  it('marks StorageClasses as loaded after the VM data fetch completes', async() => {
    const form = { storageClassesLoaded: false };
    const fetch = jest.spyOn(VM_MIXIN, 'fetch').mockImplementation().mockResolvedValue();

    await HarvesterEditVM.fetch.call(form);
    fetch.mockRestore();

    expect(form.storageClassesLoaded).toBe(true);
  });

  it('links persistent state guidance to Storage Classes', () => {
    const toStorageClass = HarvesterEditVM.computed.toStorageClass;

    expect(toStorageClass.call({ $store: { getters: { clusterId: 'c-1' } } })).toStrictEqual({
      name:   'harvester-c-cluster-resource',
      params: { cluster: 'c-1', resource: 'harvesterhci.io.storage' },
    });
  });

  it('describes creating the StorageClass without non-breaking spaces around guidance links', () => {
    expect(translations).toContain('middle: or create the class on the');
    expect(vmFormSource).not.toContain('&nbsp;');
  });

  it('clears persistent state selections only for create mode without vmstate-persistence', () => {
    const clearPersistentState = HarvesterEditVM.methods.clearPersistentStateWithoutStorageClass;

    const createForm = {
      efiPersistentStateEnabled:        true,
      mode:                             'create',
      tpmPersistentStateEnabled:        true,
      vmStateStorageClassUnavailable:   true,
    };

    clearPersistentState.call(createForm);

    expect(createForm.tpmPersistentStateEnabled).toBe(false);
    expect(createForm.efiPersistentStateEnabled).toBe(false);

    const editForm = {
      efiPersistentStateEnabled:        true,
      mode:                             'edit',
      tpmPersistentStateEnabled:        true,
      vmStateStorageClassUnavailable:   true,
    };

    clearPersistentState.call(editForm);

    expect(editForm.tpmPersistentStateEnabled).toBe(true);
    expect(editForm.efiPersistentStateEnabled).toBe(true);

    const storageClassForm = {
      efiPersistentStateEnabled:        true,
      mode:                             'create',
      tpmPersistentStateEnabled:        true,
      vmStateStorageClassUnavailable:   false,
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

  describe('restart prompt', () => {
    function vmWith({
      sockets = 1, maxSockets = 4, guest = '2Gi', maxGuest = '8Gi', machine = 'q35'
    } = {}) {
      return {
        metadata: { annotations: {} },
        spec:     {
          template: {
            spec: {
              domain: {
                machine: { type: machine },
                cpu:     {
                  sockets, cores: 1, threads: 1, maxSockets
                },
                memory:    { guest, maxGuest },
                resources: { limits: { cpu: `${ maxSockets }`, memory: maxGuest } },
              }
            }
          }
        }
      };
    }

    function shouldPrompt(oldVM, newVM) {
      const form = { ...HarvesterEditVM.methods };

      return form._shouldPromptRestart(oldVM, newVM);
    }

    it('should not prompt when only hot-pluggable CPU and memory grow', () => {
      expect(shouldPrompt(vmWith(), vmWith({ sockets: 2, guest: '4Gi' }))).toBe(false);
    });

    it('should prompt when the maximums change', () => {
      expect(shouldPrompt(vmWith(), vmWith({ sockets: 2, maxSockets: 8 }))).toBe(true);
      expect(shouldPrompt(vmWith(), vmWith({ guest: '4Gi', maxGuest: '16Gi' }))).toBe(true);
    });

    it('should prompt when CPU or memory is lowered', () => {
      expect(shouldPrompt(vmWith({ sockets: 2 }), vmWith({ sockets: 1 }))).toBe(true);
      expect(shouldPrompt(vmWith({ guest: '4Gi' }), vmWith({ guest: '2Gi' }))).toBe(true);
    });

    it('should prompt when another field changes', () => {
      expect(shouldPrompt(vmWith(), vmWith({ sockets: 2, machine: 'pc' }))).toBe(true);
    });

    it('should prompt for a CPU change without hotplug', () => {
      const oldVM = vmWith({ maxSockets: null, maxGuest: null });
      const newVM = vmWith({
        sockets: 2, maxSockets: null, maxGuest: null
      });

      expect(shouldPrompt(oldVM, newVM)).toBe(true);
    });
  });
});
