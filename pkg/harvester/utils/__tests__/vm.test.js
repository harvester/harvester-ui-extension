import { reactive } from 'vue';
import { getLatestMigration } from '../vm';

const migration = (namespace, timestamp, vmiName = 'vm1') => ({
  metadata: { namespace, creationTimestamp: timestamp },
  spec:     { vmiName },
});

describe('getLatestMigration', () => {
  it('should return the newest migration of the VMI in its namespace, regardless of list order', () => {
    const newest = migration('ns1', '2026-01-03T00:00:00Z');
    const list = [
      migration('ns1', '2026-01-01T00:00:00Z'),
      newest,
      migration('ns2', '2026-01-09T00:00:00Z'),
      migration('ns1', '2026-02-01T00:00:00Z', 'vm2'),
    ];

    expect(getLatestMigration(list, 'ns1', 'vm1')).toBe(newest);
  });

  it('should return undefined if there is no migration or no VMI name', () => {
    const list = [migration('ns1', '2026-01-01T00:00:00Z')];

    expect(getLatestMigration(list, 'ns2', 'vm1')).toBeUndefined();
    expect(getLatestMigration(list, 'ns1', undefined)).toBeUndefined();
    expect(getLatestMigration([], 'ns1', 'vm1')).toBeUndefined();
  });

  it('should follow changes of a reactive store list', () => {
    const list = reactive([]);
    const first = migration('ns1', '2026-01-01T00:00:00Z');

    expect(getLatestMigration(list, 'ns1', 'vm1')).toBeUndefined();

    list.push(first);
    expect(getLatestMigration(list, 'ns1', 'vm1')).toStrictEqual(first);

    list.push(migration('ns1', '2026-01-02T00:00:00Z'));
    expect(getLatestMigration(list, 'ns1', 'vm1').metadata.creationTimestamp).toBe('2026-01-02T00:00:00Z');

    list.splice(0, 2);
    expect(getLatestMigration(list, 'ns1', 'vm1')).toBeUndefined();
  });
});
