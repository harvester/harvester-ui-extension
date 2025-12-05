/**
 * Dynamically toggles SideNav entries based on the enabled status of a specific Addon.
 * @param {Object} store - The Vuex store instance.
 * @param {String} productName - The product name (e.g. 'harvester').
 * @param {Object} config - Configuration object.
 * @param {String} config.addonName - The metadata.name of the addon to watch (e.g. 'vm-import-controller').
 * @param {String} config.resourceType - The schema ID for addons (usually HCI.ADD_ONS).
 * @param {String} config.navGroup - The group name in the side nav to attach these types to.
 * @param {Array<String>} config.types - Array of Schema IDs (strings) to show/hide.
 */
export function registerAddonSideNav(store, productName, {
  addonName, resourceType, navGroup, types
}) {
  if (typeof window === 'undefined') {
    return;
  }

  // Forces the SideNav to re-render
  // The SideNav component watches 'favoriteTypes'. Toggling a dummy favorite forces a re-render.
  const kickSideNav = () => {
    const TRIGGER = 'ui.refresh.trigger';

    store.dispatch('type-map/addFavorite', TRIGGER);
    setTimeout(() => store.dispatch('type-map/removeFavorite', TRIGGER), 500);
  };

  // Modifies the 'basicType' allowlist
  const setMenuVisibility = (visible) => {
    if (visible) {
      // Add to allowlist
      store.commit('type-map/basicType', {
        product: productName,
        group:   navGroup,
        types
      });
    } else {
      // Remove from allowlist
      // Directly access state to delete the keys, DSL doesn't support removal
      const basicTypes = store.state['type-map'].basicTypes[productName];

      if (basicTypes) {
        types.forEach((t) => delete basicTypes[t]);
      }
    }
    kickSideNav();
  };

  // Initialization Loop
  // Delay slightly to ensure the core store is ready
  setTimeout(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // Safety valve: Stop after 60 seconds

    const waitForStore = setInterval(() => {
      attempts++;

      // Wait for the Addon Schema to be loaded
      if (store.getters[`${ productName }/schemaFor`](resourceType)) {
        clearInterval(waitForStore);

        // Setup Reactive Watcher
        // Hooks into Vue reactivity. Zero CPU usage when idle.
        store.watch(
          (state, getters) => {
            const addons = getters[`${ productName }/all`](resourceType);
            const addon = addons.find((a) => a.metadata.name === addonName);

            // Return true ONLY if explicitly enabled
            return addon?.spec?.enabled === true;
          },
          (isEnabled) => {
            setMenuVisibility(isEnabled);
          },
          { immediate: true, deep: true } // Run immediately to handle initial page load
        );
      } else if (attempts >= MAX_ATTEMPTS) {
        clearInterval(waitForStore);
      }
    }, 1000);
  }, 2000);
}
