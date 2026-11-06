import HciVmBackup from '../harvesterhci.io.virtualmachinebackup';
import { HCI } from '../../types';

jest.mock('../harvester', () => ({ __esModule: true, default: class {} }));
jest.mock('@shell/plugins/dashboard-store/resource-class', () => ({ colorForState: jest.fn() }));

function createBackup(type) {
  const backup = Object.create(HciVmBackup.prototype);
  const push = jest.fn();

  Object.assign(backup, { spec: { type } });
  Object.defineProperty(backup, 'name', { value: 'b1' });
  Object.defineProperty(backup, 't', { value: (key) => key });
  Object.defineProperty(backup, 'currentRouter', { value: () => ({ push }) });

  return { backup, push };
}

describe('class HciVmBackup', () => {
  it.each([
    ['backup', HCI.BACKUP],
    ['restic', HCI.BACKUP],
    ['kopia', HCI.BACKUP],
    [undefined, HCI.BACKUP],
    ['snapshot', HCI.VM_SNAPSHOT],
  ])('should restore a %s backup through %s', (type, resource) => {
    const { backup, push } = createBackup(type);

    backup.restoreNewVM();
    backup.restoreExistingVM();

    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls[0][0].params.resource).toBe(resource);
    expect(push.mock.calls[1][0].params.resource).toBe(resource);
  });

  it.each([
    ['kopia', 'harvester.backup.type.kopia'],
    [undefined, 'harvester.backup.type.backup'],
  ])('should label type %s as %s', (type, label) => {
    expect(createBackup(type).backup.backupTypeLabel).toBe(label);
  });
});
