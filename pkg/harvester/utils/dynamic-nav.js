/**
 * specific Addon is enabled.
 *
 * @param {Object} store - The Vuex store instance.
 * @param {String} productName - The product name (e.g. 'harvester').
 * @param {Object} config - Configuration object.
 * @param {String} config.addonName - The name of the addon to watch.
 * @param {String} config.resourceType - The schema ID for addons.
 * @param {String} config.navGroup - The group name in the side nav.
 * @param {Array<String>} config.types - Array of Resource IDs to show/hide.
 */
export function registerAddonSideNav(store, productName, {
  addonName, resourceType, navGroup, types
}) {
  if (typeof window === 'undefined') {
    return;
  }

  // This forces the SideNav to refresh.
  // The menu component watches 'favoriteTypes', so we toggle a fake favorite.
  const kickSideNav = () => {
    const TRIGGER = 'ui.refresh.trigger';

    store.dispatch('type-map/addFavorite', TRIGGER);

    // Wait 600ms to be sure the UI notices the change.
    setTimeout(() => {
      store.dispatch('type-map/removeFavorite', TRIGGER);
    }, 600);
  };

  // Shows or hides the items in the menu.
  const setMenuVisibility = (visible) => {
    if (visible) {
      // Add items to the list.
      store.commit('type-map/basicType', {
        product: productName,
        group:   navGroup,
        types
      });
    } else {
      // Remove items from the list.
      // We must delete the keys manually because the helper function cannot remove them.
      const basicTypes = store.state['type-map'].basicTypes[productName];

      if (basicTypes) {
        types.forEach((t) => delete basicTypes[t]);
      }
    }
    kickSideNav();
  };

  // Start the check after the app has had time to load.
  setTimeout(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    const waitForStore = setInterval(() => {
      attempts++;

      // Check if the Schema definition is ready.
      const hasSchema = store.getters[`${ productName }/schemaFor`](resourceType);

      // Check if the Data list is actually loaded from the API.
      // This prevents us from seeing an empty list while data is fetching.
      const hasData = store.getters[`${ productName }/haveAll`](resourceType);

      if (hasSchema && hasData) {
        clearInterval(waitForStore);

        // Watch for changes to the Addon status.
        store.watch(
          (state, getters) => {
            const addons = getters[`${ productName }/all`](resourceType);
            const addon = addons.find((a) => a.metadata.name === addonName);

            return addon?.spec?.enabled === true;
          },
          (isEnabled) => {
            setMenuVisibility(isEnabled);
          },
          { immediate: true, deep: true }
        );
      } else if (attempts >= MAX_ATTEMPTS) {
        // Stop checking if the store never loads.
        clearInterval(waitForStore);
      }
    }, 1000);
  }, 2000);
}
