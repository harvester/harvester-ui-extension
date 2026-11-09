<script>
import { h, inject } from 'vue';
import {
  RcDropdown, RcDropdownGroup, RcDropdownItem, RcDropdownItemCheckbox, RcDropdownSeparator, RcDropdownTrigger
} from '@components/RcDropdown';
import { RcIcon } from '@components/RcIcon';
import { shortcutLabels } from './shortcuts';

export const MODIFIERS = [
  { key: 'ControlLeft', label: 'Ctrl' },
  { key: 'AltLeft', label: 'Alt' },
];

export const FUNCTION_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

// Ctrl alone offers the browser shortcuts the guest cannot get from the keyboard (the browser keeps
// Ctrl+N/T/W for itself), as the old cascading menu did.
export const CTRL_KEYS = [
  { key: 'KeyN', label: 'N' },
  { key: 'KeyT', label: 'T' },
  { key: 'KeyW', label: 'W' },
  { key: 'KeyY', label: 'Y' },
];

// RcDropdown collects its items when the menu opens, and the arrow keys walk that list. Holding a modifier
// swaps the keys below it while the menu is open, so, as RcDropdown does for its submenus, the items are
// collected again on each key press and the arrows reach the keys shown now.
export const ShortcutMenuBody = {
  name: 'ShortcutMenuBody',

  setup(_props, { slots }) {
    const dropdown = inject('dropdownContext', null);

    const collectItems = (event) => {
      const menu = event.currentTarget.closest('[dropdown-menu-collection]');

      if (dropdown?.dropdownItems && menu) {
        dropdown.dropdownItems.value = [...menu.querySelectorAll('[dropdown-menu-item]')];
      }
    };

    return () => h('div', { class: 'shortcut-menu', onKeydownCapture: collectItems }, slots.default?.());
  },
};

export default {
  name: 'NovncShortcutKeysMenu',

  components: {
    RcDropdown, RcDropdownGroup, RcDropdownItem, RcDropdownItemCheckbox, RcDropdownSeparator, RcDropdownTrigger, RcIcon, ShortcutMenuBody
  },

  props: {
    disabled: {
      type:    Boolean,
      default: false,
    },

    // Saved custom shortcuts, as { name, keys }.
    shortcuts: {
      type:    Array,
      default: () => [],
    },

    // Keys only go out over a connected console; the menu still opens to manage shortcuts.
    canSend: {
      type:    Boolean,
      default: true,
    },

    // Why keys cannot be sent right now, shown at the top of the menu.
    blockedReason: {
      type:    String,
      default: '',
    },

    // Custom shortcuts are stored in the user preference, which standalone setups may not have.
    canManage: {
      type:    Boolean,
      default: true,
    },
  },

  emits: ['send-keys', 'send-shortcut', 'manage', 'ctrl-alt-del'],

  data() {
    return { held: [] };
  },

  computed: {
    modifiers() {
      return MODIFIERS;
    },

    functionKeys() {
      return FUNCTION_KEYS;
    },

    holdsCtrl() {
      return this.held.includes('ControlLeft');
    },

    holdsAlt() {
      return this.held.includes('AltLeft');
    },

    // What the keys below the toggles offer follows what is held, so the menu sends the same
    // combinations as the old one: Ctrl+N/T/W/Y, Ctrl+Alt+Del, Alt+Print Screen and Alt+F1-F12, plus
    // Ctrl+Alt+F1-F12 to switch Linux consoles.
    keyOptions() {
      if (this.holdsCtrl && this.holdsAlt) {
        return [{ key: 'Delete', label: 'Del' }];
      }

      if (this.holdsCtrl) {
        return CTRL_KEYS;
      }

      return [{ key: 'PrintScreen', label: this.t('harvester.virtualMachine.detail.console.shortcutMenu.printScreen') }];
    },

    showFunctionKeys() {
      return !this.holdsCtrl || this.holdsAlt;
    },

    heldCombo() {
      return MODIFIERS.filter((M) => this.held.includes(M.key)).map((M) => M.label).join('+');
    },

    items() {
      return this.shortcuts.map((shortcut, index) => {
        const label = shortcutLabels(shortcut).join('+');

        return {
          index, name: shortcut.name || label, label, keys: shortcut.keys
        };
      });
    },
  },

  methods: {
    // Held modifiers belong to this visit of the menu; closing it without a key lets them go.
    onOpen(open) {
      if (!open) {
        this.held = [];
      }
    },

    toggleModifier(key, on) {
      this.held = on ? [...this.held, key] : this.held.filter((K) => K !== key);
    },

    // Held modifiers apply to the next key only, then the toggles reset.
    sendKey(key) {
      const modifiers = MODIFIERS.map((M) => M.key).filter((K) => this.held.includes(K));

      // Ctrl+Alt+Del restarts most guests, so it goes through the same confirmation as its button.
      if (key === 'Delete' && this.holdsCtrl && this.holdsAlt) {
        this.$emit('ctrl-alt-del');
      } else {
        this.$emit('send-keys', [...modifiers, key]);
      }
      this.held = [];
    },
  },
};
</script>

<template>
  <rc-dropdown
    :aria-label="t('harvester.virtualMachine.detail.console.shortcutKeys')"
    placement="bottom-start"
    @update:open="onOpen"
  >
    <rc-dropdown-trigger
      variant="tertiary"
      data-testid="vnc-shortcut-keys"
      :disabled="disabled"
    >
      <template #before>
        <rc-icon
          type="keyboard"
          size="inherit"
        />
      </template>
      {{ t('harvester.virtualMachine.detail.console.shortcutKeys') }}
      <template #after>
        <rc-icon
          type="chevron-down"
          size="inherit"
        />
      </template>
    </rc-dropdown-trigger>

    <template #dropdownCollection>
      <shortcut-menu-body>
        <p
          v-if="!canSend && blockedReason"
          class="shortcut-menu__blocked"
          data-testid="vnc-shortcut-blocked"
        >
          {{ blockedReason }}
        </p>
        <template v-if="canManage && items.length">
          <rc-dropdown-group :label="t('harvester.virtualMachine.detail.console.shortcutMenu.yourShortcuts')">
            <rc-dropdown-item
              v-for="item in items"
              :key="item.index"
              :disabled="!canSend"
              class="shortcut-menu__saved"
              data-testid="vnc-saved-shortcut"
              :title="item.name"
              @click="$emit('send-shortcut', item.keys)"
            >
              <span class="shortcut-menu__saved-name">{{ item.name }}</span>
              <template #after>
                <span class="shortcut-menu__chip">{{ item.label }}</span>
              </template>
            </rc-dropdown-item>
          </rc-dropdown-group>
          <rc-dropdown-separator />
        </template>

        <rc-dropdown-group :label="t('harvester.virtualMachine.detail.console.shortcutMenu.holdModifiers')">
          <div class="shortcut-menu__row">
            <rc-dropdown-item-checkbox
              v-for="modifier in modifiers"
              :key="modifier.key"
              :disabled="!canSend"
              indicator="checkmark"
              class="shortcut-menu__chip shortcut-menu__toggle"
              :class="{ 'is-on': held.includes(modifier.key) }"
              :data-testid="`vnc-hold-${ modifier.label.toLowerCase() }`"
              :model-value="held.includes(modifier.key)"
              @update:model-value="toggleModifier(modifier.key, $event)"
            >
              {{ modifier.label }}
            </rc-dropdown-item-checkbox>
          </div>
          <p
            v-if="heldCombo"
            class="shortcut-menu__help"
          >
            {{ t('harvester.virtualMachine.detail.console.shortcutMenu.holdHint', { combo: heldCombo }) }}
          </p>
        </rc-dropdown-group>
        <rc-dropdown-separator />

        <rc-dropdown-group :label="t('harvester.virtualMachine.detail.console.shortcutMenu.keys')">
          <div class="shortcut-menu__row">
            <rc-dropdown-item
              v-for="option in keyOptions"
              :key="option.key"
              :disabled="!canSend"
              class="shortcut-menu__chip"
              :data-testid="`vnc-key-${ option.key }`"
              @click="sendKey(option.key)"
            >
              {{ option.label }}
            </rc-dropdown-item>
          </div>
        </rc-dropdown-group>

        <rc-dropdown-group
          v-if="showFunctionKeys"
          :label="t('harvester.virtualMachine.detail.console.shortcutMenu.functionKeys')"
        >
          <div class="shortcut-menu__grid">
            <rc-dropdown-item
              v-for="key in functionKeys"
              :key="key"
              :disabled="!canSend"
              class="shortcut-menu__chip"
              :data-testid="`vnc-key-${ key }`"
              @click="sendKey(key)"
            >
              {{ key }}
            </rc-dropdown-item>
          </div>
        </rc-dropdown-group>

        <template v-if="canManage">
          <rc-dropdown-separator />
          <rc-dropdown-item
            class="shortcut-menu__manage"
            data-testid="vnc-manage-shortcuts"
            @click="$emit('manage')"
          >
            <template #before>
              <rc-icon
                type="edit"
                size="inherit"
              />
            </template>
            {{ t('harvester.virtualMachine.detail.console.shortcutMenu.manage') }}
          </rc-dropdown-item>
        </template>
      </shortcut-menu-body>
    </template>
  </rc-dropdown>
</template>

<style lang="scss" scoped>
  // The menu items are styled as the key chips of the design; `.shortcut-menu` raises the
  // specificity above RcDropdownItem's own item styles.
  .shortcut-menu {
    width: 320px;

    &__row,
    &__grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 16px 8px;
    }

    &__grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
    }

    // The chips are the design's small secondary buttons, so they take RcButton's secondary tokens
    // (with its fallbacks) and follow the brand like every other button.
    .shortcut-menu__chip {
      justify-content: center;
      min-height: 24px;
      margin: 0;
      padding: 0 8px;
      border: 1px solid var(--secondary-border, var(--primary));
      border-radius: 4px;
      background: var(--secondary, transparent);
      color: var(--on-secondary, var(--primary));
      font-size: 12px;
      line-height: 16px;
      white-space: nowrap;

      &:hover {
        background: var(--secondary-hover, var(--accent-btn));
      }
    }

    .shortcut-menu__chip[disabled],
    .shortcut-menu__saved[disabled] .shortcut-menu__chip {
      &,
      &:hover {
        border-color: var(--disabled-bg, var(--border));
        background: transparent;
        color: var(--disabled-text);
        cursor: not-allowed;
      }
    }

    &__blocked {
      margin: 0;
      padding: 4px 16px 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 18px;
    }

    .shortcut-menu__toggle.is-on {
      &,
      &:hover {
        border-color: var(--active, var(--primary));
        background: var(--active, var(--primary));
        color: var(--on-active, var(--primary-text));
      }
    }

    .shortcut-menu__saved {
      margin: 0 9px;
      padding: 4px 8px;
      font-size: 14px;

      // Long names stay on two lines; the full one is in the tooltip.
      .shortcut-menu__saved-name {
        display: -webkit-box;
        min-width: 0;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }

      .shortcut-menu__chip {
        display: inline-flex;
        align-items: center;
      }
    }

    &__help {
      margin: 0;
      padding: 0 16px 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 18px;
    }

    // The design's tertiary button.
    .shortcut-menu__manage {
      color: var(--on-tertiary, var(--primary));
    }
  }
</style>
