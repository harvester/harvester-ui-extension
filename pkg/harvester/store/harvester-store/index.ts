//@ts-nocheck
import { CoreStoreSpecifics, CoreStoreConfig } from '@shell/core/types';

import { SteveFactory, steveStoreInit } from '@shell/plugins/steve/index';
import { PRODUCT_NAME } from '../../config/harvester';
import getters from './getters';
import mutations from './mutations';
import actions from './actions';

const harvesterFactory = (): CoreStoreSpecifics => {
  const steveFactory = SteveFactory(null, null);
  const steveState = steveFactory.state;

  steveFactory.state = () => ({
    ...steveState(),
    // Side navigation counts requested by `fetchFilteredCounts`, see getters.ts
    filteredCounts:        {},
    filteredCountRequests: {},
    filteredCountWatchers: [],
  });

  steveFactory.getters = {
    ...steveFactory.getters,
    ...getters,
  };

  steveFactory.mutations = {
    ...steveFactory.mutations,
    ...mutations,
  };

  steveFactory.actions = {
    ...steveFactory.actions,
    ...actions,
  };

  return steveFactory;
};
const config: CoreStoreConfig = {
  namespace:      PRODUCT_NAME,
  isClusterStore: true
};

export default {
  specifics: harvesterFactory(),
  config,
  init:      steveStoreInit
};
