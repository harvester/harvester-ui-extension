import VirtVm from '../kubevirt.io.virtualmachine';
import { VM_DELETE_PROTECTION_LABEL } from '../../config/labels-annotations';

// Minimal stand-in for the Steve model: labels/setLabels behave like hybrid-class,
// and patch is recorded so the tests can assert on the request.
jest.mock('../harvester', () => ({
  __esModule: true,
  default:    class {
    get _availableActions() {
      return [];
    }

    get labels() {
      return { ...(this.metadata?.labels || {}) };
    }

    setLabels(val) {
      this.metadata.labels = { ...val };
    }
  }
}));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({
  colorForState: () => 'text-info',
  stateSort:     () => '',
}));

function createVm({ labels, featureEnabled = true, canUpdate = true } = {}) {
  const obj = Object.create(VirtVm.prototype);

  Object.assign(obj, {
    id:       'ns1/vm1',
    type:     'kubevirt.io.virtualmachine',
    metadata: {
      name: 'vm1', namespace: 'ns1', annotations: {}, labels
    },
    spec:   { template: { spec: { domain: {}, volumes: [] } } },
    status: {},
  });
  Object.defineProperty(obj, '$rootGetters', { value: { 'harvester-common/getFeatureEnabled': (f) => f === 'vmDeleteProtection' && featureEnabled } });
  Object.defineProperty(obj, '$getters', {
    value: {
      schemaFor: () => undefined, all: () => [], byId: () => undefined
    }
  });
  Object.defineProperty(obj, 't', { value: (k, args) => (args ? `${ k }:${ JSON.stringify(args) }` : k) });
  Object.defineProperty(obj, 'canUpdate', { value: canUpdate });
  obj.patch = () => Promise.resolve();
  jest.spyOn(obj, 'patch');

  return obj;
}

const action = (vm, name) => vm.availableActions.find((a) => a.action === name);

describe('vM delete protection', () => {
  it.each([
    ['true', true],
    ['True', true],
    ['TRUE', true],
    ['1', true],
    ['t', true],
    ['false', false],
    ['0', false],
    ['yes', false],
    [' true ', false],
    [undefined, false],
  ])('label value %p => protected %p', (value, expected) => {
    const labels = value === undefined ? {} : { [VM_DELETE_PROTECTION_LABEL]: value };

    expect(createVm({ labels }).isDeleteProtected).toBe(expected);
  });

  it('offers Enable on an unprotected VM and Disable on a protected one', () => {
    const unprotected = createVm({ labels: {} });
    const protectedVm = createVm({ labels: { [VM_DELETE_PROTECTION_LABEL]: 'true' } });

    expect(action(unprotected, 'enableDeleteProtection').enabled).toBe(true);
    expect(action(unprotected, 'disableDeleteProtection').enabled).toBe(false);
    expect(action(protectedVm, 'enableDeleteProtection').enabled).toBe(false);
    expect(action(protectedVm, 'disableDeleteProtection').enabled).toBe(true);
    expect(action(protectedVm, 'disableDeleteProtection').bulkable).toBe(true);
  });

  it('hides the actions without update permission or when the feature is off', () => {
    expect(action(createVm({ labels: {}, canUpdate: false }), 'enableDeleteProtection').enabled).toBe(false);
    expect(action(createVm({ labels: {}, featureEnabled: false }), 'enableDeleteProtection').enabled).toBe(false);
  });

  it('patches only the label with a JSON merge patch', async() => {
    const vm = createVm({ labels: {} });

    await vm.enableDeleteProtection();
    expect(vm.patch).toHaveBeenCalledWith(
      { metadata: { labels: { [VM_DELETE_PROTECTION_LABEL]: 'true' } } },
      { headers: { 'content-type': 'application/merge-patch+json' } },
      false,
      true
    );

    await vm.disableDeleteProtection();
    expect(vm.patch.mock.calls[1][0]).toStrictEqual({ metadata: { labels: { [VM_DELETE_PROTECTION_LABEL]: 'false' } } });
  });

  it('sets preventDeletionMessage only for protected VMs when the feature is on', () => {
    expect(createVm({ labels: { [VM_DELETE_PROTECTION_LABEL]: 'true' } }).preventDeletionMessage).toContain('harvester.virtualMachine.deleteProtection.preventDelete');
    expect(createVm({ labels: { [VM_DELETE_PROTECTION_LABEL]: 'false' } }).preventDeletionMessage).toBeNull();
    expect(createVm({ labels: { [VM_DELETE_PROTECTION_LABEL]: 'true' }, featureEnabled: false }).preventDeletionMessage).toBeNull();
  });

  it('keeps the label out of the Labels editor but preserves it on save', () => {
    const vm = createVm({ labels: { app: 'web', [VM_DELETE_PROTECTION_LABEL]: 'true' } });

    expect(vm.labels).toStrictEqual({ app: 'web' });

    vm.setLabels({ app: 'db', [VM_DELETE_PROTECTION_LABEL]: 'false' });
    expect(vm.metadata.labels).toStrictEqual({ app: 'db', [VM_DELETE_PROTECTION_LABEL]: 'true' });
  });

  it('leaves the label in the Labels editor when the feature is off', () => {
    const vm = createVm({ labels: { app: 'web', [VM_DELETE_PROTECTION_LABEL]: 'true' }, featureEnabled: false });

    expect(vm.labels).toStrictEqual({ app: 'web', [VM_DELETE_PROTECTION_LABEL]: 'true' });

    vm.setLabels({ app: 'db', [VM_DELETE_PROTECTION_LABEL]: 'false' });
    expect(vm.metadata.labels).toStrictEqual({ app: 'db', [VM_DELETE_PROTECTION_LABEL]: 'false' });

    vm.setLabels({ app: 'db' });
    expect(vm.metadata.labels).toStrictEqual({ app: 'db' });
  });
});
