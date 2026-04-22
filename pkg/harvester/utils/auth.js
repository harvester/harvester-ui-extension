/**
 * Resolve the Harvester username from Vuex getters.
 *
 * Works with both `this.$store.getters` (in components) and
 * `this.$rootGetters` (in Steve models).
 *
 * - In single-product (standalone Harvester) mode, always returns the
 *   default username (`admin`).
 * - Otherwise, falls back to the authenticated user's `username` or `id`.
 */
export function getHarvesterUserName(getters, defaultUserName = 'admin') {
  const isSingleProduct = getters?.['isSingleProduct'];

  if (isSingleProduct) {
    return defaultUserName;
  }

  const user = getHarvesterUser(getters);

  return user?.username || user?.id || defaultUserName;
}

/**
 * Return the authenticated user object from Vuex getters.
 *
 * Works with both `this.$store.getters` (in components) and
 * `this.$rootGetters` (in Steve models).
 */
export function getHarvesterUser(getters) {
  return getters?.['auth/user'];
}
