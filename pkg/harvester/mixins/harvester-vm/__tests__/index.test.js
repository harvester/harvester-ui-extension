import vmMixin from '../index';
import impl from '../impl';

// Calls the cloud-init methods of the mixin on a plain object, without mounting the VM form.
// userScript has no default in the pattern, so an explicit `undefined` reaches getUserData unchanged.
function createVm({ userScript, sshKey = [] } = { userScript: '' }) {
  const vm = {
    userScript,
    sshKey,
    getSSHValue: () => undefined,
    $store:      { getters: { 'harvester/byId': () => undefined } },
  };

  Object.entries({ ...impl.methods, ...vmMixin.methods }).forEach(([name, fn]) => {
    vm[name] = fn.bind(vm);
  });

  return vm;
}

describe('mixin: harvester-vm', () => {
  describe('getUserData', () => {
    it.each(['', undefined, null])('adds the guest agent to an empty user data (%p)', (userScript) => {
      const vm = createVm({ userScript });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const userData = vm.getUserData({ installAgent: true, osType: 'linux' });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(userData).toStrictEqual([
        '#cloud-config',
        'package_update: true',
        'packages:',
        '  - qemu-guest-agent',
        'runcmd:',
        '  - - systemctl',
        '    - enable',
        '    - --now',
        '    - qemu-guest-agent.service',
        '',
      ].join('\n'));

      errorSpy.mockRestore();
    });

    it('returns undefined for an empty user data without the guest agent', () => {
      const vm = createVm();

      expect(vm.getUserData({ installAgent: false, osType: 'linux' })).toBeUndefined();
    });

    it('keeps the existing user data when adding the guest agent', () => {
      const vm = createVm({ userScript: '#cloud-config\nhostname: vm1\n' });

      const userData = vm.getUserData({ installAgent: true, osType: 'linux' });

      expect(userData).toContain('hostname: vm1');
      expect(userData).toContain('  - qemu-guest-agent');
    });
  });
});
