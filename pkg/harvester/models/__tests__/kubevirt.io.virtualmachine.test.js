import { reactive } from 'vue';
import VirtVm from '../kubevirt.io.virtualmachine';
import { POD, PV, PVC } from '@shell/config/types';
import { HCI } from '../../types';

// The Steve base model and the shell resource class pull in most of the dashboard, none of that is needed here
jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({
  colorForState: (state) => (state === 'Running' ? 'text-success' : 'text-info'),
  stateSort:     (color, display) => `${ color.replace(/^text-/, '') } ${ display }`,
}));

const VM_ID = 'ns1/vm1';

// Creates a VM model with mocked store getters. Like the real store, `all` returns the same array that is mutated in place.
// Reads from the global `$rootGetters` are recorded in `globalReads`.
function createVm({
  vm = {}, vmi, pods = [], pvcs = [], restores = [], backups = [], claims = ['disk-pvc'], printableStatus, root = {}
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
  const globalReads = [];
  const rootGetters = new Proxy({ 'harvester-common/getFeatureEnabled': () => false, ...root }, {
    get(target, key) {
      globalReads.push(key);

      return target[key];
    }
  });

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

  return {
    vm: obj, lists, globalReads
  };
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

function backupVm({
  actions = { backup: '/backup', snapshot: '/snapshot' }, volumes = [{}], target = 's3', csi = {}
} = {}) {
  // target null: a user who can't read backup-target or csi-driver-config
  const settings = target === null ? {} : {
    'backup-target':     { value: JSON.stringify({ type: target }) },
    'csi-driver-config': { value: JSON.stringify(csi) },
  };
  const pvcs = volumes.map((volume, i) => ({
    id: `ns1/disk-${ i }`, name: `disk-${ i }`, isBlockVolume: true, ...volume
  }));
  const { vm } = createVm({
    pvcs,
    claims: pvcs.map((p) => p.name),
    root:   {
      'harvester-common/getFeatureEnabled': (feature) => feature === 'thirdPartyVMBackup',
      'harvester/byId':                     (type, id) => settings[id],
    },
  });

  vm.actions = actions;

  return Object.fromEntries(vm.backupTypeOptions.map((option) => [option.value, option.unavailableReason]));
}

const LVM_CSI = { 'lvm.driver.harvesterhci.io': { volumeSnapshotClassName: 'lvm', backupVolumeSnapshotClassName: 'lvm' } };

describe('class VirtVm', () => {
  describe('canTakeBackup', () => {
    it.each([
      [{ backup: '/b' }, true, true],
      [{ snapshot: '/s' }, true, true],
      [{ snapshot: '/s' }, false, false],
      [{ backup: '/b' }, false, true],
      [{}, true, false],
    ])('with actions %j and the feature %s returns %s', (actions, enabled, expected) => {
      const { vm } = createVm({ root: { 'harvester-common/getFeatureEnabled': () => enabled, 'harvester/byId': () => undefined } });

      vm.actions = actions;

      expect(vm.canTakeBackup).toBe(expected);
    });

    it.each([
      ['an NFS target', 'nfs', false],
      ['an S3 target', 's3', true],
      ['a target the user cannot read', undefined, true],
    ])('with only the snapshot action and %s returns %s', (_, target, expected) => {
      const { vm } = createVm({
        root: {
          'harvester-common/getFeatureEnabled': () => true,
          'harvester/byId':                     () => (target ? { value: JSON.stringify({ type: target }) } : undefined),
        },
      });

      vm.actions = { snapshot: '/s' };

      expect(vm.canTakeBackup).toBe(expected);
    });
  });

  describe('backupTypeOptions', () => {
    it('should offer every type when a third-party driver has both snapshot classes', () => {
      const reasons = backupVm({ csi: LVM_CSI, volumes: [{ volumeProvider: 'lvm.driver.harvesterhci.io' }] });

      expect(reasons).toStrictEqual({
        backup: undefined, restic: undefined, kopia: undefined
      });
    });

    it('should explain a driver without a backup snapshot class on native only', () => {
      const reasons = backupVm({
        csi:     { 'lvm.driver.harvesterhci.io': { volumeSnapshotClassName: 'lvm' } },
        volumes: [{ volumeProvider: 'lvm.driver.harvesterhci.io' }],
      });

      expect(reasons.backup).toBe('harvester.backup.typeUnavailable.noBackupSnapshotClass');
      expect(reasons.kopia).toBeUndefined();
    });

    it('should offer only Restic and Kopia on Longhorn v2, where the backend drops the backup action', () => {
      const reasons = backupVm({
        actions: { snapshot: '/s' },
        volumes: [{ isLonghornV2: true, volumeProvider: 'driver.longhorn.io' }],
      });

      expect(reasons.backup).toBe('harvester.backup.typeUnavailable.longhornV2');
      expect(reasons.restic).toBeUndefined();
    });

    it('should explain a CDI volume on native', () => {
      const reasons = backupVm({ actions: { snapshot: '/s' }, volumes: [{ isCreatedForDataVolume: true }] });

      expect(reasons.backup).toBe('harvester.backup.typeUnavailable.cdi');
      expect(reasons.kopia).toBeUndefined();
    });

    it.each([
      ['an NFS target', { target: 'nfs' }, 'requiresS3'],
      ['a Filesystem volume', { volumes: [{ isBlockVolume: false }] }, 'requiresBlock'],
      ['a Longhorn v1 volume', { volumes: [{ isLonghornV1: true }] }, 'longhornV1'],
      ['one bad volume among good ones', { volumes: [{}, { isLonghornV1: true }] }, 'longhornV1'],
      ['a driver without a snapshot class', {
        actions: { backup: '/b' },
        csi:     { 'lvm.driver.harvesterhci.io': { backupVolumeSnapshotClassName: 'lvm' } },
        volumes: [{ volumeProvider: 'lvm.driver.harvesterhci.io' }],
      }, 'noSnapshotClass'],
      ['no snapshot action', { actions: { backup: '/b' } }, 'snapshot'],
    ])('should block Restic and Kopia with %s', (_, args, reason) => {
      const reasons = backupVm(args);

      expect(reasons.restic).toBe(`harvester.backup.typeUnavailable.${ reason }`);
      expect(reasons.kopia).toBe(`harvester.backup.typeUnavailable.${ reason }`);
    });

    it('should leave the target check to the webhook when the user cannot read it', () => {
      const reasons = backupVm({
        actions: { snapshot: '/s' }, target: null, volumes: [{ isCreatedForDataVolume: true }]
      });

      expect(reasons.restic).toBeUndefined();
      expect(reasons.kopia).toBeUndefined();
    });

    it('should leave a driver check to the webhook when the CSI config is unreadable', () => {
      const { vm } = createVm({
        pvcs:   [{ id: 'ns1/disk-pvc', volumeProvider: 'lvm.driver.harvesterhci.io' }],
        root:   { 'harvester/byId': () => undefined },
      });

      expect(vm.driverMissingSnapshotClass('backupVolumeSnapshotClassName')).toBeUndefined();
    });
  });

  describe('fetchBackupTypeRequirements', () => {
    it('should load only what the VM needs and survive a resource the user cannot read', async() => {
      const { vm, lists } = createVm({ pvcs: [{ id: 'ns1/disk-pvc', spec: { volumeName: 'pv-1' } }] });
      const dispatch = jest.fn((_, { type }) => (type === PV ? Promise.reject(new Error('forbidden')) : Promise.resolve()));

      Object.defineProperty(vm, '$dispatch', { value: dispatch });

      await expect(vm.fetchBackupTypeRequirements()).resolves.toBeUndefined();

      expect(lists[PVC]).toHaveLength(1);
      expect(dispatch).toHaveBeenCalledWith('find', { type: PVC, id: 'ns1/disk-pvc' });
      expect(dispatch).toHaveBeenCalledWith('find', { type: HCI.SETTING, id: 'backup-target' });
      expect(dispatch).toHaveBeenCalledWith('find', { type: HCI.SETTING, id: 'csi-driver-config' });
      expect(dispatch).toHaveBeenCalledWith('find', { type: PV, id: 'pv-1' });
      expect(dispatch).toHaveBeenCalledTimes(4);
    });
  });

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

      lists[HCI.BACKUP][1].spec.type = 'kopia';
      expect(vm.restoreResource.fromSnapshot).toBe(false);

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

  describe('stateSort', () => {
    it('should be built from the same state as stateDisplay and stateColor', () => {
      const { vm } = createVm({ vmi: readyVmi() });

      expect(vm.stateSort).toBe(`${ vm.stateColor.replace(/^text-/, '') } ${ vm.stateDisplay }`);
    });

    it('should evaluate the state only once', () => {
      const { vm } = createVm({ vmi: readyVmi() });
      const spy = jest.spyOn(vm, 'actualState', 'get');

      expect(vm.stateSort).toBe('success Running');
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
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

    it('should find pods that are added to the store later', () => {
      const { vm, lists } = createVm({ vmi: readyVmi(), pods: [] });

      expect(vm.podResource).toBeUndefined();

      const pod = { metadata: { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] } };

      lists[POD].push(pod);

      expect(vm.podResource).toStrictEqual(pod);
    });

    it('should not return a pod of a VM with the same name in another namespace', () => {
      const other = { metadata: { namespace: 'ns2', ownerReferences: [{ name: 'vm1' }] } };
      const mine = { metadata: { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] } };
      const { vm } = createVm({ vmi: readyVmi(), pods: [mine, other] });

      expect(vm.podResource).toStrictEqual(mine);
    });

    it('should not return pods that were removed from the store', () => {
      const pod = { metadata: { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] } };
      const { vm, lists } = createVm({ vmi: readyVmi(), pods: [pod] });

      expect(vm.podResource).toStrictEqual(pod);

      lists[POD].splice(0, 1);

      expect(vm.podResource).toBeUndefined();
    });
  });

  describe('store', () => {
    it('should read the data of the VM from the store the VM lives in, not from a fixed one', () => {
      // The VM model is used with the `harvester` store (Harvester product) and the `cluster` store (Rancher explorer)
      const pod = { metadata: { namespace: 'ns1', ownerReferences: [{ name: 'vm1' }] } };
      const { vm, globalReads } = createVm({
        vmi:      readyVmi(),
        pods:     [pod],
        pvcs:     [pvc('disk-pvc', false)],
        restores: [{ id: 'ns1/r1', isComplete: true }],
        vm:       {
          metadata: {
            name: 'vm1', namespace: 'ns1', annotations: { 'restore.harvesterhci.io/name': 'r1' }
          }
        },
      });

      expect(vm.vmi.id).toBe(VM_ID);
      expect(vm.podResource).toStrictEqual(pod);
      expect(vm.volumes).toHaveLength(1);
      expect(vm.restoreResource.id).toBe('ns1/r1');
      expect(vm.actualState).toBe('Running');
      expect(globalReads.filter((key) => /^(harvester|cluster)\//.test(key))).toStrictEqual([]);
    });
  });

  describe('isRestartRequired', () => {
    it('should reflect the RestartRequired condition', () => {
      const { vm } = createVm({ vm: { status: { conditions: [{ type: 'RestartRequired', status: 'True' }] } } });

      expect(vm.isRestartRequired).toBe(true);
    });
  });
});
