import Feature from '@shell/models/management.cattle.io.feature';
import { MANAGEMENT } from '@shell/config/types';
import { CONFIGURABLE_TABLES } from '@shell/store/features';
import { tableViewsOffFeature } from '../table-views';

describe('tableViewsOffFeature', () => {
  it('should be the table views feature of the management store', () => {
    const feature = tableViewsOffFeature();

    expect(feature.type).toBe(MANAGEMENT.FEATURE);
    expect(feature.id).toBe(CONFIGURABLE_TABLES);
  });

  it('should be read as disabled by the shell', () => {
    const feature = new Feature(tableViewsOffFeature(), {
      getters: {}, rootGetters: {}, dispatch: jest.fn(), rootState: {}
    });

    expect(feature.enabled).toBe(false);
  });
});
