import semver from 'semver';

// Rancher 2.16 resolves `[[name]]` tokens in translations from values registered as 'l10n-global'
export const L10N_GLOBALS_MIN_RANCHER_VERSION = '2.16.0';

const TOKEN = /(\\?)\[\[([\w-]+)\]\]/g;

/**
 * Whether the host UI resolves `[[name]]` tokens itself.
 * Standalone reports no Rancher version, so it is treated as an older host.
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
