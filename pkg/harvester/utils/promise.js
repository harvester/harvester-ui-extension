export function allSettled(hash) {
  const keys = Object.keys(hash);
  const promises = Object.values(hash);

  return Promise.allSettled(promises).then((res) => {
    const out = {};

    for ( let i = 0 ; i < keys.length ; i++ ) {
      if (res[i].status === 'fulfilled') {
        out[keys[i]] = res[i].value;
      } else {
        out[keys[i]] = [];
      }
    }

    return out;
  });
}

export function getCookie(name) {
  const value = `; ${ document.cookie }`;
  const parts = value.split(`; ${ name }=`);

  if (parts.length === 2) return parts.pop().split(';').shift();
}

export async function deleteSecretWithCSRF(url) {
  const csrfToken = getCookie('CSRF');

  return fetch(url, {
    method:  'DELETE',
    headers: {
      Accept:         'application/json',
      'Content-Type': 'application/json',
      'x-api-csrf':   csrfToken
    },
    credentials: 'include'
  });
}
