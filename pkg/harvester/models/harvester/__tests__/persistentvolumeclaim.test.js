import { LONGHORN } from '@shell/config/types';
import HciPv from '../persistentvolumeclaim';
import { CLONE_PHASE } from '../../../utils/vm';

jest.mock('../../harvester', () => ({ __esModule: true, default: class {} }));

const GI = 1024 ** 3;

// A PVC model whose Longhorn volume and engine come from the store, like on the VM list
function createPvc({
  dataSource = { kind: 'PersistentVolumeClaim', name: 'source' }, bound = true, longhorn = true, volume, engine
} = {}) {
  const lists = {
    [LONGHORN.VOLUMES]: volume ? [{ metadata: { name: 'pvc-1' }, ...volume }] : [],
    [LONGHORN.ENGINES]: engine ? [{ spec: { volumeName: 'pvc-1' }, ...engine }] : [],
  };
  const pvc = Object.create(HciPv.prototype);

  Object.assign(pvc, {
    metadata: { name: 'disk-0', namespace: 'ns1' },
    spec:     {
      dataSource,
      resources:  { requests: { storage: '10Gi' } },
      volumeName: bound ? 'pvc-1' : undefined,
    },
  });
  Object.defineProperty(pvc, 'isLonghorn', { value: longhorn });
  Object.defineProperty(pvc, '$rootGetters', {
    value: {
      currentProduct:  { inStore: 'harvester' },
      'harvester/all': (type) => lists[type] || [],
    }
  });

  return pvc;
}

const cloningVolume = (state) => ({ spec: { dataSource: 'vol://source' }, status: { cloneStatus: { state } } });

describe('class HciPv', () => {
  describe('isCloneTarget', () => {
    it.each([
      ['PersistentVolumeClaim', true],
      ['VolumeSnapshot', true],
      ['VirtualMachineImageDataSource', false],
    ])('should treat a %s data source as a clone target: %p', (kind, expected) => {
      expect(createPvc({ dataSource: { kind } }).isCloneTarget).toBe(expected);
    });

    it('should not treat a PVC without a data source as a clone target', () => {
      const pvc = createPvc({ dataSource: null });

      expect(pvc.isCloneTarget).toBe(false);
      expect(pvc.cloneProgress).toBeNull();
    });

    it('should only treat Longhorn clone targets as Longhorn clone targets', () => {
      expect(createPvc().isLonghornCloneTarget).toBe(true);
      expect(createPvc({ longhorn: false }).isLonghornCloneTarget).toBe(false);
    });
  });

  describe('cloneProgress', () => {
    it('should report a pending copy at 0% that needs a consumer while a Longhorn clone is not bound', () => {
      expect(createPvc({ bound: false }).cloneProgress).toStrictEqual({
        volumeName: 'disk-0', phase: CLONE_PHASE.COPY, progress: 0, inProgress: true, needsConsumer: true, size: 10 * GI
      });
    });

    it('should report the copy without a percentage for other CSI drivers until the PVC binds', () => {
      expect(createPvc({ longhorn: false, bound: false }).cloneProgress).toStrictEqual({
        volumeName: 'disk-0', phase: CLONE_PHASE.COPY, progress: undefined, inProgress: true, needsConsumer: true, size: 10 * GI
      });
      expect(createPvc({ longhorn: false }).cloneProgress).toBeNull();
    });

    it('should report the slowest replica while the data is copied', () => {
      const pvc = createPvc({
        volume: cloningVolume('initiated'),
        engine: { status: { cloneStatus: { r1: { progress: 40 }, r2: { progress: 25 } } } },
      });

      expect(pvc.cloneProgress).toStrictEqual({
        volumeName: 'disk-0', phase: CLONE_PHASE.COPY, progress: 25, inProgress: true, size: 10 * GI
      });
    });

    it('should report 0% while the engine has no clone status yet', () => {
      const pvc = createPvc({ volume: cloningVolume('') });

      expect(pvc.cloneProgress.progress).toBe(0);
      expect(pvc.cloneProgress.phase).toBe(CLONE_PHASE.COPY);
    });

    it('should report the replica rebuild once the copy completed', () => {
      const pvc = createPvc({
        volume: cloningVolume('copy-completed-awaiting-healthy'),
        engine: { status: { rebuildStatus: { r2: { progress: 70 }, r3: { progress: 55 } } } },
      });

      expect(pvc.cloneProgress).toStrictEqual({
        volumeName: 'disk-0', phase: CLONE_PHASE.REBUILD, progress: 55, inProgress: true, needsConsumer: true, size: 10 * GI
      });
    });

    it('should report a rebuild at 0% before it starts', () => {
      const pvc = createPvc({ volume: cloningVolume('copy-completed-awaiting-healthy') });

      expect(pvc.cloneProgress.phase).toBe(CLONE_PHASE.REBUILD);
      expect(pvc.cloneProgress.progress).toBe(0);
    });

    it.each(['completed', 'failed'])('should report no progress once the clone is %s', (state) => {
      expect(createPvc({ volume: cloningVolume(state) }).cloneProgress).toBeNull();
    });

    it('should report no progress when the Longhorn volume is not a clone or not loaded', () => {
      expect(createPvc({ volume: { spec: {}, status: {} } }).cloneProgress).toBeNull();
      expect(createPvc().cloneProgress).toBeNull();
    });
  });
});
