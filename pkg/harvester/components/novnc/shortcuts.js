// Saved custom shortcuts live in the Rancher user preference, which every Harvester UI the user opens
// shares. The keys stay a list of recorded keydown events per shortcut, the format older versions read;
// names go in a separate preference so those versions keep working.
export const SHORTCUTS_PREFERENCE = 'prefered-shortcut-keys';
export const SHORTCUT_NAMES_PREFERENCE = 'vnc-shortcut-names';

const KEY_LABELS = {
  Control: 'Ctrl',
  Escape:  'Esc',
  Delete:  'Del',
  ' ':     'Space',
};

export const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

export function keyLabel(key = '') {
  if (KEY_LABELS[key]) {
    return KEY_LABELS[key];
  }

  return key.length === 1 ? key.toUpperCase() : key;
}

// macOS Option turns a letter into a symbol (Option+G gives ©, Option+E a dead key). The key that was
// pressed is still in `code`, so in that case the letter is named after it. Only with Alt and no Ctrl:
// AZERTY's comma on KeyM, Dvorak's punctuation or Cyrillic letters are real keys, and Windows AltGr
// reports Ctrl+Alt with a real character.
export function baseKey(K, combination = []) {
  const letter = /^Key([A-Z])$/.exec(K?.code || '');

  if (!letter || /^[a-z]$/i.test(K.key || '')) {
    return K;
  }

  const held = combination.map((M) => M.key);
  const isOptionSymbol = held.includes('Alt') && !held.includes('Control');

  return K.key === 'Dead' || isOptionSymbol ? { ...K, key: letter[1].toLowerCase() } : K;
}

export function normalizeShortcut(item) {
  if (Array.isArray(item)) {
    return { name: '', keys: item };
  }

  return { name: item?.name || '', keys: Array.isArray(item?.keys) ? item.keys : [] };
}

export function shortcutLabels(shortcut) {
  const keys = shortcut?.keys || [];

  return keys.map((K) => keyLabel(baseKey(K, keys).key));
}

// Two shortcuts are the same when they press the same keys, whatever they are called.
export function shortcutId(shortcut) {
  return (shortcut?.keys || []).map((K) => K.code || K.key).join('+');
}

// Only what sending a shortcut needs, so a recorded KeyboardEvent can be stored.
export function recordKey(event, combination = []) {
  const {
    key, keyCode, code, location, charCode
  } = event;

  return baseKey({
    key, keyCode, code, location, charCode
  }, combination);
}

function parse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    return fallback;
  }
}

export function readShortcuts(preference) {
  const list = parse(preference?.data?.[SHORTCUTS_PREFERENCE], []);
  const names = parse(preference?.data?.[SHORTCUT_NAMES_PREFERENCE], {});

  return (Array.isArray(list) ? list : [])
    .map(normalizeShortcut)
    .filter((shortcut) => shortcut.keys.length)
    .map((shortcut) => ({ ...shortcut, name: shortcut.name || names?.[shortcutId(shortcut)] || '' }));
}

export function writeShortcuts(preference, shortcuts) {
  const names = {};

  shortcuts.forEach((shortcut) => {
    if (shortcut.name) {
      names[shortcutId(shortcut)] = shortcut.name;
    }
  });

  const previous = {
    [SHORTCUTS_PREFERENCE]:      preference.data[SHORTCUTS_PREFERENCE],
    [SHORTCUT_NAMES_PREFERENCE]: preference.data[SHORTCUT_NAMES_PREFERENCE],
  };

  preference.data[SHORTCUTS_PREFERENCE] = JSON.stringify(shortcuts.map((shortcut) => shortcut.keys));
  preference.data[SHORTCUT_NAMES_PREFERENCE] = JSON.stringify(names);

  // The lists read straight from the preference, so a failed save must not leave the change showing.
  return preference.save().catch((err) => {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete preference.data[key];
      } else {
        preference.data[key] = value;
      }
    });

    throw err;
  });
}
