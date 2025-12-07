/**
 * Dynamically toggles SideNav entries based on the enabled status of a specific Addon.
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

  // Forces the SideNav component to re-render by toggling a dummy user preference.
  // Necessary because the menu component does not automatically detect
  // changes to the allowed types list.
  const kickSideNav = () => {
    const TRIGGER = 'ui.refresh.trigger';

    store.dispatch('type-map/addFavorite', TRIGGER);

    // SideNav component seem to ignore rapid state changes.
    // Wait 600ms to ensure the toggle event triggers a re-render.
    setTimeout(() => {
      store.dispatch('type-map/removeFavorite', TRIGGER);
    }, 600);
  };

  // Adds or removes the resource IDs from the product visibility whitelist.
  const setMenuVisibility = (visible) => {
    if (visible) {
      store.commit('type-map/basicType', {
        product: productName,
        group:   navGroup,
        types
      });
    } else {
      // Manually delete the keys from the state object to hide them.
      const basicTypes = store.state['type-map'].basicTypes[productName];

      if (basicTypes) {
        types.forEach((t) => delete basicTypes[t]);
      }
    }
    kickSideNav();
  };

  // Start polling to check if the store is ready.
  let attempts = 0;
  const MAX_ATTEMPTS = 60;

  const waitForStore = setInterval(() => {
    attempts++;

    try {
      // Check if the Schema definitions are loaded.
      const hasSchema = store.getters[`${ productName }/schemaFor`] &&
                        store.getters[`${ productName }/schemaFor`](resourceType);

      // Check if the resource list data is fully loaded to prevent race conditions.
      const hasData = store.getters[`${ productName }/haveAll`] &&
                      store.getters[`${ productName }/haveAll`](resourceType);

      if (hasSchema && hasData) {
        // Store is ready. Stop polling.
        clearInterval(waitForStore);

        // Watch the specific addon resource for changes to its enabled status.
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
      } else if (hasSchema && !hasData) {
        // If the schema is ready but the data is missing, request the list from the API.
        // Ensures the script does not wait indefinitely if the UI has not loaded the addons yet.
        store.dispatch(`${ productName }/findAll`, { type: resourceType });
      } else if (attempts >= MAX_ATTEMPTS) {
        // Stop checking if the store does not load within the timeout limit.
        clearInterval(waitForStore);
      }
    } catch (e) {
      // Ignore errors if the store module is not yet registered and wait for the next attempt.
      if (attempts >= MAX_ATTEMPTS) clearInterval(waitForStore);
    }
  }, 1000);
}
