import {
  answerAuthProvidersLocally, harvesterLocalLogin, initStandaloneSession, routeLogoutToHarvester,
  LOCAL_AUTH_PROVIDER, LOGIN_ERRORS, LOGIN_URL, LOGOUT_URL, STANDALONE_PRINCIPAL_ID
} from '../auth';

describe('harvesterLocalLogin', () => {
  const creds = { username: 'admin', password: 'secret' };

  it('posts the local provider payload to the public login endpoint', async() => {
    const store = { dispatch: jest.fn().mockResolvedValue({ _status: 200 }) };

    await harvesterLocalLogin(store, creds);

    expect(store.dispatch).toHaveBeenCalledWith('management/request', {
      url:    LOGIN_URL,
      method: 'post',
      data:   {
        configName:   'local',
        type:         'localProvider',
        description:  'UI session',
        responseType: 'cookie',
        username:     'admin',
        password:     'secret',
      },
      redirectUnauthorized: false,
    }, { root: true });
  });

  it.each([
    [{ _status: 401 }, LOGIN_ERRORS.CLIENT_UNAUTHORIZED],
    [{ _status: 422, message: 'bad input' }, 'bad input'],
    [{ _status: 403 }, LOGIN_ERRORS.CLIENT],
    [{ _status: 500 }, LOGIN_ERRORS.SERVER],
  ])('maps the error %o to %s', async(err, expected) => {
    const store = { dispatch: jest.fn().mockRejectedValue(err) };

    await expect(harvesterLocalLogin(store, creds)).rejects.toBe(expected);
  });
});

describe('initStandaloneSession', () => {
  it('marks the session as logged in', () => {
    const store = { commit: jest.fn() };

    initStandaloneSession(store, '/harvester/c/local/harvesterhci.io.dashboard');

    expect(store.commit).toHaveBeenCalledWith('auth/hasAuth', true);
    expect(store.commit).toHaveBeenCalledWith('auth/loggedInAs', STANDALONE_PRINCIPAL_ID);
  });

  it.each(['/auth/login', '/auth/logout'])('does nothing on %s', (path) => {
    const store = { commit: jest.fn() };

    initStandaloneSession(store, path);

    expect(store.commit).not.toHaveBeenCalled();
  });
});

describe('routeLogoutToHarvester', () => {
  function interceptor() {
    let fn;
    const store = {
      $axios: {
        onRequest: (f) => {
          fn = f;
        }
      }
    };

    routeLogoutToHarvester(store);

    return (url) => fn({ url }).url;
  }

  it.each([
    '/v1/logout',
    '/v1/logout?all',
    'https://127.0.0.1:8005/v1/logout',
  ])('sends %s to the Harvester logout endpoint', (url) => {
    expect(interceptor()(url)).toBe(LOGOUT_URL);
  });

  it.each([
    '/v1/logouts',
    '/v1/harvester/v1/logout',
    '/v1/management.cattle.io.settings',
  ])('leaves %s alone', (url) => {
    expect(interceptor()(url)).toBe(url);
  });
});

describe('answerAuthProvidersLocally', () => {
  function interceptor() {
    let fn;
    const store = {
      $axios: {
        onRequest: (f) => {
          fn = f;
        }
      }
    };

    answerAuthProvidersLocally(store);

    return (url) => fn({ url });
  }

  it('answers the auth provider list with the local provider, without a request', async() => {
    const config = interceptor()('/v1-public/authproviders?pagesize=100000&exclude=metadata.managedFields');
    const res = await config.adapter(config);

    expect(res.status).toBe(200);
    expect(res.data.data).toStrictEqual([LOCAL_AUTH_PROVIDER]);
  });

  it('leaves other requests alone', () => {
    expect(interceptor()('/v1-public/login').adapter).toBeUndefined();
  });
});
