import { mount } from '@vue/test-utils';
import PromptRemoveVm from '../kubevirt.io.virtualmachine.vue';
import { HCI } from '../../types';

function createVm(name, disks) {
  return {
    id:    `default/${ name }`,
    type:  HCI.VM,
    links: { self: `https://harvester/v1/harvester/kubevirt.io.virtualmachines/default/${ name }` },
    spec:  {
      template: {
        spec: {
          volumes: [
            ...disks.map((disk) => ({ name: disk, persistentVolumeClaim: { claimName: `${ name }-${ disk }` } })),
            { name: 'cloudinitdisk', cloudInitNoCloud: {} },
          ],
        },
      },
    },
    remove: jest.fn(),
  };
}

function mountPrompt(value) {
  return mount(PromptRemoveVm, {
    props: {
      value,
      names: value.map((vm) => vm.id),
      type:  'Virtual Machine',
      close: jest.fn(),
    },
    global: { mocks: { $store: { getters: { 'i18n/t': (key) => key }, commit: jest.fn() } } },
  });
}

// Toggles the checkbox like a click does: flips `checked` and fires `change`
function click(input) {
  return input.setValue(!input.element.checked);
}

function removeUrls(prompt, vms) {
  prompt.vm.remove();

  return vms.map((vm) => vm.remove.mock.calls[0][0].url);
}

describe('promptRemove: kubevirt.io.virtualmachine', () => {
  describe('when several VMs are removed', () => {
    it('should check "Delete All" by default and remove the disks of every VM', () => {
      const vms = [createVm('vm1', ['disk-0']), createVm('vm2', ['disk-0', 'disk-1'])];
      const prompt = mountPrompt(vms);

      expect(prompt.find('input[type="checkbox"]').element.checked).toBe(true);

      expect(removeUrls(prompt, vms)).toStrictEqual([
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm1?removedDisks=disk-0&propagationPolicy=Foreground',
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm2?removedDisks=disk-0&removedDisks=disk-1&propagationPolicy=Foreground',
      ]);
    });

    it('should uncheck "Delete All" with one click and keep the disks', async() => {
      const vms = [createVm('vm1', ['disk-0']), createVm('vm2', ['disk-0'])];
      const prompt = mountPrompt(vms);
      const input = prompt.find('input[type="checkbox"]');

      await click(input);

      expect(input.element.checked).toBe(false);

      expect(removeUrls(prompt, vms)).toStrictEqual([
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm1?propagationPolicy=Foreground',
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm2?propagationPolicy=Foreground',
      ]);
    });

    it('should toggle "Delete All" on every click and remove the disks once it is checked again', async() => {
      const vms = [createVm('vm1', ['disk-0']), createVm('vm2', ['disk-0'])];
      const prompt = mountPrompt(vms);
      const input = prompt.find('input[type="checkbox"]');
      const states = [input.element.checked];

      await click(input);
      states.push(input.element.checked);

      await click(input);
      states.push(input.element.checked);

      expect(states).toStrictEqual([true, false, true]);

      expect(removeUrls(prompt, vms)).toStrictEqual([
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm1?removedDisks=disk-0&propagationPolicy=Foreground',
        '/v1/harvester/kubevirt.io.virtualmachines/default/vm2?removedDisks=disk-0&propagationPolicy=Foreground',
      ]);
    });
  });

  describe('when one VM is removed', () => {
    it('should list its disks with the first one checked by default', () => {
      const prompt = mountPrompt([createVm('vm1', ['disk-0', 'disk-1'])]);
      const inputs = prompt.findAll('input[type="checkbox"]');

      expect(inputs.map((input) => input.element.value)).toStrictEqual(['disk-0', 'disk-1']);
      expect(inputs.map((input) => input.element.checked)).toStrictEqual([true, false]);
    });

    it('should remove only the checked disks', async() => {
      const vm = createVm('vm1', ['disk-0', 'disk-1']);
      const prompt = mountPrompt([vm]);
      const [first, second] = prompt.findAll('input[type="checkbox"]');

      await click(first);
      await click(second);

      expect([first.element.checked, second.element.checked]).toStrictEqual([false, true]);

      expect(removeUrls(prompt, [vm])).toStrictEqual(['/v1/harvester/kubevirt.io.virtualmachines/default/vm1?removedDisks=disk-1&propagationPolicy=Foreground']);
    });
  });
});
