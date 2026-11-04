import { reactive } from 'vue';
import VirtVm from '../kubevirt.io.virtualmachine';
import { POD, PVC } from '@shell/config/types';
import { HCI } from '../../types';

// The Steve base model and the shell resource class pull in most of the dashboard, none of that is needed here
jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({ colorForState: (state) => (state === 'Running' ? 'text-success' : 'text-info') }));

const VM_ID = 'ns1/vm1';

/**
 * Create a VM model instance without the full Steve model plumbing. Only the store getters that the
 * VM model reads are mocked, backed by plain lists (like the real store, `all` returns the same array
 * that is mutated in place on updates).
 *
 * The model reads its store either through `$rootGetters` (`harvester/...`) or through `$getters`, the getters of the
 * store it lives in. Both are backed by the same data, so the tests do not depend on which of them the model uses.
 */
function createVm({
  vm = {}, vmi, pods = [], pvcs = [], restores = [], backups = [], claims = ['disk-pvc'], printableStatus
} = {}) {
  const lists = reactive({
    [POD]:         pods,
    [PVC]:         pvcs,
    [HCI.RESTORE]: restores,
    [HCI.BACKUP]:  backups,
  });
  const byId = { [HCI.VMI]: vmi ? [vmi] : [] };

  const getters = {
    all:       (type) => lists[type] || [],
    byId:      (type, id) => (byId[type] || lists[type] || []).find((x) => x.id === id),
    schemaFor: () => undefined,
  };
  const rootGetters = {
    'harvester-common/getFeatureEnabled': () => false,
    currentProduct:                       { inStore: 'harvester' },
    'harvester/all':                      getters.all,
    'harvester/byId':                     getters.byId,
  };

  const obj = Object.create(VirtVm.prototype);

  Object.assign(obj, {
    id:       VM_ID,
    type:     HCI.VM,
    metadata: {
      name: 'vm1', namespace: 'ns1', annotations: {}
    },
    spec: {
      runStrategy: 'Always',
      template:    {
        spec: {
          domain:  { cpu: { cores: 1 }, resources: { limits: { memory: '1Gi' } } },
          volumes: claims.map((c) => ({ name: c, persistentVolumeClaim: { claimName: c } })),
        }
      }
    },
    status: {
      created: true, ready: true, printableStatus: printableStatus || 'Running', conditions: []
    },
    ...vm,
  });
  Object.defineProperty(obj, '$rootGetters', { value: rootGetters });
  Object.defineProperty(obj, '$getters', { value: getters });
  Object.defineProperty(obj, 't', { value: (k) => k });

  return { vm: obj, lists };
}

const readyVmi = (extra = {}) => ({
  id:       VM_ID,
  metadata: { name: 'vm1', namespace: 'ns1' },
  status:   {
    phase:      'Running',
    conditions: [{ type: 'Ready', status: 'True' }],
    ...extra
  }
});

const pvc = (name, encrypted, ns = 'ns1') => ({
  id:          `${ ns }/${ name }`,
  metadata:    { name, namespace: ns },
  isEncrypted: encrypted,
});

describe('class VirtVm', () => {
  describe('restoreResource', () => {
    it('should distinguish snapshots from backups and follow backup updates', () => {
      const { vm, lists } = createVm({
        vm: {
          metadata: {
            namespace: 'ns1', name: 'vm1', annotations: { 'restore.harvesterhci.io/name': 'r1' }
          }
        },
        restores: [{
          id: 'ns1/r1', isComplete: false, spec: { virtualMachineBackupNamespace: 'ns1', virtualMachineBackupName: 'b1' }
        }],
        backups: [
          { id: 'ns2/b1', spec: { type: 'snapshot' } },
          { id: 'ns1/b1', spec: { type: 'backup' } },
        ],
      });

      expect(vm.restoreResource.fromSnapshot).toBe(false);
      expect(vm.restoreState).toBe(false);

      lists[HCI.BACKUP][1].spec.type = 'snapshot';
      expect(vm.restoreResource.fromSnapshot).toBe(true);

      lists[HCI.BACKUP].splice(1, 1);
      expect(vm.restoreResource.fromSnapshot).toBe(false);

      lists[HCI.RESTORE][0].isComplete = true;
      expect(vm.restoreState).toBe(true);
    });
  });

  describe('encryptedVolumeType', () => {
    it('should be none without volumes', () => {
      const { vm } = createVm({ claims: [] });

      expect(vm.encryptedVolumeType).toBe('none');
    });

    it('should be none if no PVC is encrypted', () => {
      const { vm } = createVm({ pvcs: [pvc('disk-pvc', false)] });

      expect(vm.encryptedVolumeType).toBe('none');
    });

    it('should be all if every PVC is encrypted', () => {
      const { vm } = createVm({
        claims: ['a', 'b'],
        pvcs:   [pvc('a', true), pvc('b', true), pvc('other', false)]
      });

      expect(vm.encryptedVolumeType).toBe('all');
    });

    it('should be partial if some PVCs are encrypted', () => {
      const { vm } = createVm({
        claims: ['a', 'b'],
        pvcs:   [pvc('a', true), pvc('b', false)]
      });

      expect(vm.encryptedVolumeType).toBe('partial');
    });

    it('should follow PVCs that are added to the store later', () => {
      const { vm, lists } = createVm({ claims: ['a'], pvcs: [] });

      expect(vm.encryptedVolumeType).toBe('none');

      lists[PVC].push(pvc('a', true));

      expect(vm.encryptedVolumeType).toBe('all');
    });
  });

  describe('actualState', () => {
    it('should be Off if the VM is halted', () => {
      const { vm } = createVm({
        vm: {
          spec:   { runStrategy: 'Halted', template: { spec: { volumes: [], domain: {} } } },
          status: { created: false, conditions: [] }
        }
      });

      expect(vm.actualState).toBe('Off');
    });

    it('should be Running if the VMI is running and ready', () => {
      const { vm } = createVm({ vmi: readyVmi() });

      expect(vm.actualState).toBe('Running');
    });

    it('should be Not Ready if the VMI is running but not ready', () => {
      const { vm } = createVm({ vmi: readyVmi({ conditions: [{ type: 'Ready', status: 'False' }] }) });

      expect(vm.actualState).toBe('Not Ready');
    });

    it('should be Paused if the VMI has the Paused condition', () => {
      const { vm } = createVm({ vmi: readyVmi({ conditions: [{ type: 'Ready', status: 'True' }, { type: 'Paused', status: 'True' }] }) });

      expect(vm.actualState).toBe('Paused');
    });

    it('should be Stopping if the VM is not expected to run anymore but the VMI exists', () => {
      const { vm } = createVm({
        vm:  { spec: { runStrategy: 'Halted', template: { spec: { volumes: [], domain: {} } } } },
        vmi: readyVmi()
      });

      expect(vm.actualState).toBe('Stopping');
    });

    it('should be Starting while the launcher pod is not ready', () => {
      const { vm } = createVm({
        vmi:  readyVmi({ phase: 'Scheduling', conditions: [] }),
        pods: [{
          metadata:     { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] },
          getPodStatus: { status: 'POD_NOT_SCHEDULABLE' }
        }]
      });

      expect(vm.actualState).toBe('Starting');
    });

    it('should be Unschedulable if the VM is starting and has an unschedulable condition', () => {
      const { vm } = createVm({
        vmi: readyVmi({ phase: 'Pending', conditions: [] }),
        vm:  { status: { created: true, conditions: [{ reason: 'Unschedulable', message: 'no node' }] } }
      });

      expect(vm.actualState).toBe('Unschedulable');
      expect(vm.isUnschedulable.message).toBe('no node');
    });

    it('should not be Unschedulable without an unschedulable condition', () => {
      const { vm } = createVm({ vmi: readyVmi() });

      expect(vm.isUnschedulable).toBeNull();
      expect(vm.actualState).toBe('Running');
    });

    it('should not be Unschedulable if the VM is neither starting nor stopping', () => {
      const { vm } = createVm({
        vm: {
          spec:   { runStrategy: 'Halted', template: { spec: { volumes: [], domain: {} } } },
          status: { created: false, conditions: [{ reason: 'Unschedulable' }] }
        }
      });

      expect(vm.isUnschedulable).toBeNull();
      expect(vm.actualState).toBe('Off');
    });

    it('should be Terminating if the VM is being deleted', () => {
      const { vm } = createVm({
        vmi: readyVmi(),
        vm:  {
          metadata: {
            name: 'vm1', namespace: 'ns1', annotations: {}, deletionTimestamp: 'now'
          }
        }
      });

      expect(vm.actualState).toBe('Terminating');
    });

    it('should be VM error if the VM has a failure condition', () => {
      const { vm } = createVm({ vm: { status: { created: true, conditions: [{ type: 'Failure', message: 'boom' }] } } });

      expect(vm.actualState).toBe('VM error');
    });

    it('should be Restoring while a restore is in progress', () => {
      const { vm } = createVm({
        vmi: readyVmi(),
        vm:  {
          metadata: {
            name: 'vm1', namespace: 'ns1', annotations: { 'restore.harvesterhci.io/name': 'r1' }
          }
        },
        restores: [{ id: 'ns1/r1', isComplete: false }]
      });

      expect(vm.actualState).toBe('Restoring');
    });

    it('should not be Restoring if the restore of the annotation does not exist', () => {
      const { vm } = createVm({
        vmi: readyVmi(),
        vm:  {
          metadata: {
            name: 'vm1', namespace: 'ns1', annotations: { 'restore.harvesterhci.io/name': 'other' }
          }
        },
        restores: [{ id: 'ns1/r1', isComplete: false }]
      });

      expect(vm.actualState).toBe('Running');
    });
  });

  describe('podResource', () => {
    it('should find the launcher pod by owner name', () => {
      const pod = { metadata: { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] } };
      const { vm } = createVm({ vmi: readyVmi(), pods: [pod] });

      expect(vm.podResource).toStrictEqual(pod);
    });

    it('should return the last pod if several pods have the same owner', () => {
      // e.g. the source and the target pod while the VM migrates
      const source = {
        metadata: {
          name: 'launcher-source', namespace: 'ns1', ownerReferences: [{ name: 'vm1' }]
        }
      };
      const target = {
        metadata: {
          name: 'launcher-target', namespace: 'ns1', ownerReferences: [{ name: 'vm1' }]
        }
      };
      const { vm } = createVm({ vmi: readyVmi(), pods: [source, target] });

      expect(vm.podResource.metadata.name).toBe('launcher-target');
    });
  });

  describe('isRestartRequired', () => {
    it('should reflect the RestartRequired condition', () => {
      const { vm } = createVm({ vm: { status: { conditions: [{ type: 'RestartRequired', status: 'True' }] } } });

      expect(vm.isRestartRequired).toBe(true);
    });
  });
});
