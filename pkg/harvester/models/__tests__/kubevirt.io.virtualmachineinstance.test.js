import { reactive } from 'vue';
import VirtVmInstance from '../kubevirt.io.virtualmachineinstance';
import { HCI } from '../../types';
import { HCI as HCI_ANNOTATIONS } from '../../config/labels-annotations';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({ colorForState: () => 'text-info' }));

function migration(namespace, timestamp, phase = 'Running') {
  return {
    metadata: { namespace, creationTimestamp: timestamp },
    spec:     { vmiName: 'vm1' },
    status:   { phase },
  };
}

function createVmi(migrations) {
  const list = reactive(migrations);
  const vmi = Object.create(VirtVmInstance.prototype);

  Object.assign(vmi, {
    metadata: {
      namespace:   'ns1',
      name:        'vm1',
      annotations: { [HCI_ANNOTATIONS.MIGRATION_STATE]: 'Migrating' },
    },
    $getters:     { all: (type) => type === HCI.VMIM ? list : [] },
    $rootGetters: { 'harvester/all': (type) => type === HCI.VMIM ? list : [] },
  });

  return { vmi, list };
}

describe('class VirtVmInstance', () => {
  it('should follow additions, timestamp changes, phase changes and removals in the same list', () => {
    const { vmi, list } = createVmi([]);

    expect(vmi.vmimResource).toStrictEqual([]);
    expect(vmi.migrationState).toBeNull();

    list.push(migration('ns1', '2026-01-01T00:00:00Z'));
    expect(vmi.migrationState.status).toBe('Migrating');

    list.push(migration('ns1', '2026-01-02T00:00:00Z', 'Failed'));
    expect(vmi.migrationState.status).toBe('Failed');

    list[0].metadata.creationTimestamp = '2026-01-03T00:00:00Z';
    expect(vmi.vmimResource).toBe(list[0]);
    expect(vmi.migrationState.status).toBe('Migrating');

    list[0].status.phase = 'Failed';
    expect(vmi.migrationState.status).toBe('Failed');

    list.splice(0, 2);
    expect(vmi.migrationState).toBeNull();
  });
});
