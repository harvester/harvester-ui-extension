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

export const LOGIN_URL = '/v1-public/login';

export const LOGIN_ERRORS = {
  CLIENT:              'client',
  CLIENT_UNAUTHORIZED: 'client_unauthorized',
  SERVER:              'server',
};

/**
 * Log in a local user against the Harvester API.
 *
 * Always uses the local provider (the Rancher dashboard's `local` /
 * `localProvider`), so no provider lookup is needed. The server replies with an HttpOnly `R_SESS=<tokenKey>:<tokenValue>` cookie,
 * which the browser then sends with every following same-origin request.
 *
 * Rejects with one of `LOGIN_ERRORS`, or the server's error message.
 */
export async function harvesterLocalLogin(store, { username, password }) {
  try {
    return await store.dispatch('management/request', {
      url:    LOGIN_URL,
      method: 'post',
      data:   {
        configName:   'local',
        type:         'localProvider',
        description:  'UI session',
        responseType: 'cookie',
        username,
        password,
      },
      redirectUnauthorized: false,
    }, { root: true });
  } catch (err) {
    const status = err?._status;

    if (status === 401) {
      return Promise.reject(LOGIN_ERRORS.CLIENT_UNAUTHORIZED);
    } else if (err?.message) {
      return Promise.reject(err.message);
    } else if (status >= 400 && status <= 499) {
      return Promise.reject(LOGIN_ERRORS.CLIENT);
    }

    return Promise.reject(LOGIN_ERRORS.SERVER);
  }
}

export const STANDALONE_PRINCIPAL_ID = 'local://admin';

/**
 * Standalone only: treat the session as established up front.
 *
 * The Harvester backend checks the `R_SESS` cookie on every request, so the shell's
 * auth guard lookups (`ext.cattle.io.selfuser`, `/v3/principals`) aren't needed -
 * they're Rancher only and 404 here. A request without a valid session gets a 401,
 * which the shell turns into a redirect to the login page.
 *
 * Skipped when the app loads on an auth page (login, logout): a logged in state there
 * makes the shell save user preferences, and that 401 would reload the login page in a loop.
 */
export function initStandaloneSession(store, path = window.location.pathname) {
  const base = process.env.routerBase || '/';

  if (path.startsWith(`${ base }auth/`)) {
    return;
  }

  store.commit('auth/hasAuth', true);
  store.commit('auth/loggedInAs', STANDALONE_PRINCIPAL_ID);
}

export const LOGOUT_URL = '/v1-public/logout';

const RANCHER_LOGOUT = /^(?:https?:\/\/[^/]+)?\/v1\/logout(?:\?|$)/;

/**
 * Standalone only: send the shell's logout to the Harvester endpoint.
 *
 * `auth/logout` posts to Rancher's `/v1/logout`. Rewriting that request keeps the
 * rest of the shell's logout flow (awaiting the call, then going to the login page).
 */
export function routeLogoutToHarvester(store) {
  store.$axios?.onRequest((config) => {
    if (RANCHER_LOGOUT.test(config.url || '')) {
      config.url = LOGOUT_URL;
    }

    return config;
  });
}

const AUTH_PROVIDERS = /^(?:https?:\/\/[^/]+)?\/v1-public\/authproviders(?:\?|$)/;

/**
 * The only auth provider in standalone Harvester, shaped like Rancher's local provider.
 */
export const LOCAL_AUTH_PROVIDER = {
  id:   'local',
  type: 'localProvider',
};

/**
 * Standalone only: answer the shell's auth provider lookups locally.
 *
 * Harvester only has the local provider and no `/v1-public/authproviders` endpoint.
 * The shell header asks for the list on every page and doesn't handle the 404,
 * which shows up as an uncaught error.
 */
export function answerAuthProvidersLocally(store) {
  store.$axios?.onRequest((config) => {
    if (AUTH_PROVIDERS.test(config.url || '')) {
      config.adapter = () => Promise.resolve({
        data:       {
          type: 'collection', resourceType: 'authProvider', data: [{ ...LOCAL_AUTH_PROVIDER }]
        },
        status:     200,
        statusText: 'OK',
        headers:    {},
        config,
        request:    {},
      });
    }

    return config;
  });
}
