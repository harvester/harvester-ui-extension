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
