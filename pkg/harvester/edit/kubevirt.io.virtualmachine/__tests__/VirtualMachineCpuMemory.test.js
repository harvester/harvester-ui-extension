import { _CREATE, _EDIT } from '@shell/config/query-params';
import HarvesterEditCpuMemory from '../VirtualMachineCpuMemory.vue';

const { methods, computed } = HarvesterEditCpuMemory;

function formFor(state) {
  const form = {
    localEnableHotPlug: true,
    hotPlugEnabledHere: false,
    maxHotplugRatio:    4,
    $emit:              jest.fn(),
    ...methods,
    ...state,
  };

  Object.defineProperty(form, 'keepMaximums', { get: () => computed.keepMaximums.call(form) });

  return form;
}

function lastEmit(form) {
  return form.$emit.mock.calls[form.$emit.mock.calls.length - 1];
}

describe('component: HarvesterEditCpuMemory', () => {
  describe('creating a VM', () => {
    it('should set the maximum CPU from the hotplug ratio', () => {
      const form = formFor({
        mode: _CREATE, localCpu: 2, maxLocalCpu: 4
      });

      form.changeCPU();

      expect(form.maxLocalCpu).toBe(8);
      expect(lastEmit(form)).toStrictEqual(['updateCpuMemory', 2, undefined, 8, undefined, true]);
    });

    it('should set the maximum memory from the hotplug ratio', () => {
      const form = formFor({
        mode: _CREATE, localMemory: '4Gi', maxLocalMemory: '8Gi'
      });

      form.changeMemory();

      expect(form.maxLocalMemory).toBe('16Gi');
    });
  });

  describe('editing a running VM that has hotplug enabled', () => {
    it('should keep the maximum CPU when the new value fits', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localCpu: 2, maxLocalCpu: 4
      });

      form.changeCPU();

      expect(form.maxLocalCpu).toBe(4);
      expect(lastEmit(form)).toStrictEqual(['updateCpuMemory', 2, undefined, 4, undefined, true]);
    });

    it('should keep the maximum memory when the new value fits', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localMemory: '4Gi', maxLocalMemory: '8Gi'
      });

      form.changeMemory();

      expect(form.maxLocalMemory).toBe('8Gi');
    });

    it('should keep a maximum memory written in other units', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localMemory: '6Gi', maxLocalMemory: '8192Mi'
      });

      form.changeMemory();

      expect(form.maxLocalMemory).toBe('8192Mi');
    });

    it('should not change the maximum CPU even when the new value exceeds it', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localCpu: 6, maxLocalCpu: 4
      });

      form.changeCPU();

      expect(form.maxLocalCpu).toBe(4);
    });

    it('should not change the maximum memory even when the new value exceeds it', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localMemory: '12Gi', maxLocalMemory: '8Gi'
      });

      form.changeMemory();

      expect(form.maxLocalMemory).toBe('8Gi');
    });

    it('should set the maximums from the hotplug ratio when they are empty', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: true, localCpu: 2, maxLocalCpu: null, localMemory: '4Gi', maxLocalMemory: null
      });

      form.changeCPU();
      form.changeMemory();

      expect(form.maxLocalCpu).toBe(8);
      expect(form.maxLocalMemory).toBe('16Gi');
    });
  });

  describe('editing a stopped VM that has hotplug enabled', () => {
    it('should set the maximums from the hotplug ratio, as a restart applies them anyway', () => {
      const form = formFor({
        mode: _EDIT, isVmRunning: false, localCpu: 2, maxLocalCpu: 4, localMemory: '4Gi', maxLocalMemory: '8Gi'
      });

      form.changeCPU();
      form.changeMemory();

      expect(form.maxLocalCpu).toBe(8);
      expect(form.maxLocalMemory).toBe('16Gi');
    });
  });

  describe('enabling hotplug while editing a VM', () => {
    it('should keep the maximums following CPU and memory', () => {
      const form = formFor({
        mode: _EDIT, localEnableHotPlug: false, localCpu: 1, localMemory: '2Gi', maxLocalCpu: null, maxLocalMemory: null
      });

      form.localEnableHotPlug = true;
      form.hotPlugChanged(true);

      expect(form.maxLocalCpu).toBe(4);
      expect(form.maxLocalMemory).toBe('8Gi');

      form.localCpu = 2;
      form.localMemory = '4Gi';
      form.changeCPU();
      form.changeMemory();

      expect(form.maxLocalCpu).toBe(8);
      expect(form.maxLocalMemory).toBe('16Gi');
    });
  });
});
