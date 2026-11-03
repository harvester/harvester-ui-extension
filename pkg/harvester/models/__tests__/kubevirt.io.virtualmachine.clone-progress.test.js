import VirtVm from '../kubevirt.io.virtualmachine';
import { CLONE_PHASE } from '../../utils/vm';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({ colorForState: () => 'text-success' }));

const GI = 1024 ** 3;

// The clone progress of one volume, as HciPv.cloneProgress reports it
function volume(name, options = {}) {
  const {
    phase = CLONE_PHASE.COPY, size = 10 * GI, needsConsumer, longhorn = true
  } = options;
  // `progress: undefined` is what drivers without a progress API report, so only default a missing key
  const progress = 'progress' in options ? options.progress : 0;

  return {
    isLonghornCloneTarget: longhorn,
    cloneProgress:         {
      volumeName: name, phase, progress, inProgress: true, size, ...(needsConsumer ? { needsConsumer } : {})
    },
  };
}

const done = { isLonghornCloneTarget: true, cloneProgress: null };

// A cloned VM that hasn't started yet, with the given volumes
function createVm(volumes, {
  featureEnabled = true, runStrategy = 'Always', conditions = [], deletionTimestamp
} = {}) {
  const vm = Object.create(VirtVm.prototype);

  Object.assign(vm, {
    metadata: {
      name: 'vm1-clone', namespace: 'ns1', deletionTimestamp
    },
    spec:     { runStrategy, template: { spec: {} } },
    status:   { conditions },
  });
  Object.defineProperty(vm, 'volumes', { value: volumes });
  Object.defineProperty(vm, 'vmi', { value: undefined });
  Object.defineProperty(vm, '$getters', { value: { all: () => [], byId: () => undefined } });
  Object.defineProperty(vm, '$rootGetters', { value: { 'harvester-common/getFeatureEnabled': (flag) => flag === 'vmCloneProgress' && featureEnabled } });

  return vm;
}

describe('class VirtVm clone progress', () => {
  it('should report nothing when the vmCloneProgress feature is off', () => {
    const vm = createVm([volume('disk-0', { progress: 50 })], { featureEnabled: false });

    expect(vm.hasPendingLonghornClone).toBe(false);
    expect(vm.isCloningVolumes).toBe(false);
    expect(vm.isCloning).toBeNull();
    expect(vm.cloneProgress).toStrictEqual({});
  });

  it('should only ask for Longhorn volumes when the VM has Longhorn clone targets', () => {
    expect(createVm([volume('disk-0')]).hasPendingLonghornClone).toBe(true);
    expect(createVm([volume('disk-0', { longhorn: false })]).hasPendingLonghornClone).toBe(false);
  });

  it('should show the Cloning state with an info color while the volumes are copied', () => {
    const vm = createVm([volume('disk-0', { progress: 30 })]);

    expect(vm.isCloningVolumes).toBe(true);
    expect(vm.isCloning).toStrictEqual({ status: 'Cloning' });
    expect(vm.actualState).toBe('Cloning');
    expect(vm.stateColor).toBe('text-info');
  });

  it('should weight the copy progress by volume size', () => {
    const vm = createVm([
      volume('disk-0', { progress: 100, size: 1 * GI }),
      volume('disk-1', { progress: 10, size: 9 * GI }),
    ]);

    expect(vm.cloneProgress).toStrictEqual({
      type:       'clone',
      percentage: 19,
      details:    { volumes: [{ volumeName: 'disk-0', progress: 100 }, { volumeName: 'disk-1', progress: 10 }] },
    });
  });

  it('should keep reporting the copy until every volume has its data, then the rebuild', () => {
    const copying = createVm([
      volume('disk-0', {
        phase: CLONE_PHASE.REBUILD, progress: 80, needsConsumer: true
      }),
      volume('disk-1', { progress: 40 }),
    ]);

    expect(copying.cloneVolumesPhase).toBe(CLONE_PHASE.COPY);
    expect(copying.cloneProgress.type).toBe('clone');
    expect(copying.cloneProgress.details.volumes).toStrictEqual([{ volumeName: 'disk-1', progress: 40 }]);

    const rebuilding = createVm([volume('disk-0', {
      phase: CLONE_PHASE.REBUILD, progress: 80, needsConsumer: true
    }), done]);

    expect(rebuilding.cloneVolumesPhase).toBe(CLONE_PHASE.REBUILD);
    expect(rebuilding.cloneProgress).toStrictEqual({
      type: 'cloneRebuild', percentage: 80, details: { volumes: [{ volumeName: 'disk-0', progress: 80 }] }
    });
  });

  it('should cap the percentage at 99 while a clone is still in progress', () => {
    expect(createVm([volume('disk-0', { progress: 100 })]).cloneProgress.percentage).toBe(99);
  });

  it('should show Cloning without a percentage for drivers that report no progress', () => {
    const vm = createVm([volume('disk-0', {
      progress: undefined, needsConsumer: true, longhorn: false
    })]);

    expect(vm.isCloning).toStrictEqual({ status: 'Cloning' });
    expect(vm.cloneProgress).toStrictEqual({});
  });

  it('should not report stages that need a consumer while the VM is stopped', () => {
    const vm = createVm([volume('disk-0', {
      phase: CLONE_PHASE.REBUILD, progress: 10, needsConsumer: true
    })], { runStrategy: 'Halted' });

    expect(vm.cloneVolumesProgress).toStrictEqual([]);
    expect(vm.isCloning).toBeNull();
  });

  it('should still report the copy of a stopped VM', () => {
    const vm = createVm([volume('disk-0', { progress: 10 })], { runStrategy: 'Halted' });

    expect(vm.isCloning).toStrictEqual({ status: 'Cloning' });
  });

  it('should let a VM failure take precedence over clone progress', () => {
    const vm = createVm([volume('disk-0', { progress: 10 })], {
      conditions: [{
        type: 'Failure', status: 'True', message: 'boom'
      }]
    });

    expect(vm.isCloningVolumes).toBe(false);
    expect(vm.isCloning).toBeNull();
    expect(vm.cloneProgress).toStrictEqual({});
  });

  it('should not report clone progress for a VM that is being deleted', () => {
    const vm = createVm([volume('disk-0', { progress: 10 })], { deletionTimestamp: '2026-11-02T00:00:00Z' });

    expect(vm.cloneVolumesProgress).toStrictEqual([]);
  });

  it('should report nothing once all volumes are cloned', () => {
    const vm = createVm([done, done]);

    expect(vm.isCloningVolumes).toBe(false);
    expect(vm.cloneProgress).toStrictEqual({});
  });
});
