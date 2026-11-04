<script>
import { RcDropdown, RcDropdownItem, RcDropdownSeparator, RcDropdownTrigger } from '@components/RcDropdown';
import { RcIcon } from '@components/RcIcon';
import RcStatusIndicator from '@components/Pill/RcStatusIndicator';
import { CONSOLE_STATUS } from './NovncConsole';

export const CONNECTION_STATE = {
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  DISCONNECTED: 'disconnected',
  NOT_RUNNING:  'notRunning',
};

export default {
  name: 'NovncConnectionStatus',

  components: {
    RcDropdown, RcDropdownItem, RcDropdownSeparator, RcDropdownTrigger, RcIcon, RcStatusIndicator
  },

  props: {
    status: {
      type:    String,
      default: CONSOLE_STATUS.CONNECTING,
    },

    label: {
      type:    String,
      default: '',
    },

    vmName: {
      type:    String,
      default: '',
    },
  },

  emits: ['reconnect'],

  computed: {
    // The console reports five states; the toolbar only tells the user whether they can type.
    state() {
      if (this.status === CONNECTION_STATE.NOT_RUNNING) {
        return CONNECTION_STATE.NOT_RUNNING;
      }

      if (this.status === CONSOLE_STATUS.CONNECTED) {
        return CONNECTION_STATE.CONNECTED;
      }

      if (this.status === CONSOLE_STATUS.DISCONNECTED || this.status === CONSOLE_STATUS.FAILED) {
        return CONNECTION_STATE.DISCONNECTED;
      }

      return CONNECTION_STATE.CONNECTING;
    },
  },
};
</script>

<template>
  <div class="connection-status">
    <!-- Only the label is announced, not the menu that opens next to it. -->
    <span
      class="sr-only"
      role="status"
      aria-live="polite"
    >{{ label }}</span>

    <rc-dropdown
      v-if="state === 'connected'"
      :aria-label="t('harvester.virtualMachine.detail.console.connection.menuLabel')"
      placement="bottom-start"
    >
      <rc-dropdown-trigger
        variant="ghost"
        size="small"
        class="connection-status__pill"
        data-testid="vnc-connection-status"
      >
        <template #before>
          <rc-status-indicator
            shape="disc"
            status="success"
          />
        </template>
        {{ label }}
        <template #after>
          <rc-icon
            type="chevron-down"
            size="inherit"
          />
        </template>
      </rc-dropdown-trigger>

      <template #dropdownCollection>
        <p class="connection-status__description">
          {{ t('harvester.virtualMachine.detail.console.connection.description', { name: vmName }) }}
        </p>
        <rc-dropdown-separator />
        <rc-dropdown-item
          data-testid="vnc-connection-reconnect"
          @click="$emit('reconnect')"
        >
          <template #before>
            <rc-icon
              type="refresh"
              size="inherit"
            />
          </template>
          {{ t('harvester.action.reconnect') }}
        </rc-dropdown-item>
      </template>
    </rc-dropdown>

    <span
      v-else-if="state === 'notRunning'"
      class="connection-status__pill"
      data-testid="vnc-connection-status"
    >
      <rc-status-indicator
        shape="disc"
        status="unknown"
      />
      {{ label }}
    </span>

    <span
      v-else-if="state === 'connecting'"
      class="connection-status__pill"
      data-testid="vnc-connection-status"
    >
      <rc-icon
        type="spinner"
        size="inherit"
        class="icon-spin"
      />
      {{ label }}
    </span>

    <span
      v-else
      class="connection-status__pill connection-status__pill--disconnected"
      data-testid="vnc-connection-status"
    >
      <rc-status-indicator
        shape="disc"
        status="error"
      />
      {{ label }}
      <span
        class="connection-status__divider"
        aria-hidden="true"
      />
      <button
        type="button"
        class="connection-status__reconnect"
        data-testid="vnc-connection-reconnect"
        @click="$emit('reconnect')"
      >
        <rc-icon
          type="refresh"
          size="inherit"
        />
        {{ t('harvester.action.reconnect') }}
      </button>
    </span>
  </div>
</template>

<style lang="scss" scoped>
  .connection-status {
    display: flex;
    align-items: center;

    // Shared by the dropdown trigger and the plain pills, so every state has the same shape.
    &__pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 10px 0 12px;
      // The connected pill is an RcButton, which takes its padding from this property.
      --rc-button-padding: 0 10px 0 12px;
      border: 1px solid var(--border);
      border-radius: 16px;
      color: var(--body-text);
      font-size: 12px;
      line-height: 18px;
      white-space: nowrap;

      &--disconnected {
        border-color: var(--error);
      }
    }

    &__divider {
      width: 1px;
      height: 16px;
      background: var(--error);
    }

    &__reconnect {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--error);
      font-size: 12px;
      cursor: pointer;

      &:focus-visible {
        @include focus-outline;
      }
    }

    &__description {
      max-width: 248px;
      margin: 0;
      padding: 4px 17px 8px;
      color: var(--body-text);
      font-size: 12px;
      font-weight: 400;
      line-height: 18px;
      white-space: normal;
    }
  }
</style>
