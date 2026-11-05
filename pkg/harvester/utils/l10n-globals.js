import semver from 'semver';

// Rancher 2.16 resolves `[[name]]` tokens in translations from values registered as 'l10n-global'
export const L10N_GLOBALS_MIN_RANCHER_VERSION = '2.16.0';

// Name of the product name token, `[[Harvester]]`, and its value on Prime
export const PRODUCT_NAME_GLOBAL = 'Harvester';
export const PRIME_PRODUCT_NAME = 'SUSE Virtualization';

const TOKEN = /(\\?)\[\[([\w-]+)\]\]/g;

// Standalone has no Rancher Prime, the server-flavor setting decides instead
let standalonePrime = false;

export function setStandalonePrime(isPrime) {
  standalonePrime = !!isPrime;
}

export function standaloneProductName() {
  return standalonePrime ? PRIME_PRODUCT_NAME : PRODUCT_NAME_GLOBAL;
}

/**
 * Whether the host Rancher resolves `[[name]]` tokens itself.
 * A missing or unknown version counts as an older host.
 */
export function hostResolvesL10nGlobals(version) {
  const v = semver.coerce(version);

  return !!v && semver.gte(v, L10N_GLOBALS_MIN_RANCHER_VERSION);
}

/**
 * Replace `[[name]]` tokens in every string of `translations`, in place, the same way Rancher 2.16 does:
 * a known name gets its value, an unknown one falls back to the name and `\[[name]]` stays a literal `[[name]]`
 */
export function resolveL10nGlobals(translations, values = {}) {
  Object.keys(translations || {}).forEach((key) => {
    const value = translations[key];

    if (typeof value === 'string') {
      translations[key] = value.replace(TOKEN, (_, escaped, name) => (escaped ? `[[${ name }]]` : (values[name] ?? name)));
    } else if (value && typeof value === 'object') {
      resolveL10nGlobals(value, values);
    }
  });

  return translations;
}
