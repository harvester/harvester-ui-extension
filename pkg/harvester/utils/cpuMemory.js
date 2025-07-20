import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';

export function getVmCPUMemoryValues(vm) {
  if (!vm) {
    return {
      cpu:              0,
      memory:           null,
      isHotplugEnabled: false
    };
  }

  const isHotplugEnabled = isCPUMemoryHotPlugEnabled(vm);

  if (isHotplugEnabled) {
    return {
      cpu:       vm.spec.template.spec.domain.cpu.sockets,
      memory:    vm.spec.template.spec.domain?.memory?.guest || null,
      maxCpu:    vm.spec.template.spec.domain.cpu?.maxSockets || 0,
      maxMemory: vm.spec.template.spec.domain?.memory?.maxGuest || null,
      isHotplugEnabled
    };
  } else {
    return {
      cpu:    vm.spec.template.spec.domain.cpu.cores,
      memory: vm.spec.template.spec.domain.resources?.limits?.memory || null,
      isHotplugEnabled
    };
  }
}

export function isCPUMemoryHotPlugEnabled(vm) {
  return vm?.metadata?.annotations[HCI_ANNOTATIONS.VM_CPU_MEMORY_HOTPLUG] === 'true' ||
    !!vm?.spec?.template?.spec?.domain.cpu?.maxSockets ||
    !!vm?.spec?.template?.spec?.domain?.memory?.maxGuest ||
    false;
}
