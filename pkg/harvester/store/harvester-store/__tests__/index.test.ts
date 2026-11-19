import { HCI } from '../../../types';
import harvesterStore from '../index';

// The shell answers yes for every type here, so only the store's own check can keep a cluster off pagination
jest.mock('@shell/utils/pagination-utils', () => ({ __esModule: true, default: { isEnabled: () => true } }));

describe('harvester store', () => {
  it('should not page the VMs on a cluster whose API can\'t, whatever the shell answers', () => {
    const { paginationEnabled } = harvesterStore.specifics.getters as any;
    const getters = { schemaFor: () => ({ id: HCI.VM, attributes: { columns: [{ name: 'Status', field: '.status.printableStatus' }] } }) };
    const rootGetters = { 'harvester-common/getFeatureEnabled': () => true };
    const state = { config: { namespace: 'harvester' } };

    expect(paginationEnabled(state, getters, {}, rootGetters)({ id: HCI.VM, context: 'any' })).toBe(false);
    expect(paginationEnabled(state, getters, {}, rootGetters)(HCI.VMI)).toBe(true);
  });
});
