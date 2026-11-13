<script>
import { STEVE } from '@shell/config/types';
import { RcButton } from '@components/RcButton';
import { RcModal } from '@components/RcModal';
import { Checkbox } from '@components/Form/Checkbox';
import { escapeHtml } from '@shell/utils/string';
import { allHash } from '@shell/utils/promise';
import KeyTable from '@novnc/novnc/core/input/keysym';
import * as KeyboardUtil from '@novnc/novnc/core/input/util';
import { HCI } from '../../types';
import NovncConsole, { CONSOLE_STATUS } from './NovncConsole';
import NovncConsoleCustomKeys from './NovncConsoleCustomKeys';
import NovncConnectionStatus, { CONNECTION_STATE } from './NovncConnectionStatus';
import NovncIcon from './NovncIcon';
import NovncShortcutKeysMenu from './NovncShortcutKeysMenu';
import NovncStatusCard from './NovncStatusCard';
import NovncViewOptions, { VIEW_MODE } from './NovncViewOptions';
import { baseKey, readShortcuts } from './shortcuts';
import { normalizeZoom } from './ZoomableRFB';

// The previous console saved its defaults under its key the first time it opened, so they can't tell a
// choice from a default. This one keeps its own key and writes it only once the user changes a setting.
const CONSOLE_SETTINGS_KEY = 'harvester-vnc-console-view';
// Only View only is taken from the previous console: it was off unless the user turned it on.
const PREVIOUS_SETTINGS_KEY = 'harvester-vnc-console-settings';

export const CONFIRM_ACTION = {
  CTRL_ALT_DEL: 'ctrlAltDel',
  SOFT_REBOOT:  'softReboot',
};

const DEFAULT_SETTINGS = {
  viewMode:         VIEW_MODE.SCALE,
  zoomPercent:      100,
  viewOnly:         false,
  qualityLevel:     6,
  compressionLevel: 2,
};

const SHORT_KEYS = {
  ControlLeft: {
    label: 'Ctrl',
    value: KeyTable.XK_Control_L,
  },
  AltLeft: {
    label: 'Alt',
    value: KeyTable.XK_Alt_L,
  }
};

const FUNCTION_KEYS = {
  Delete: {
    label: 'Del',
    value: KeyTable.XK_Delete,
  },
  PrintScreen: {
    label: 'Print Screen',
    value: KeyTable.XK_Print,
  },
};

const NORMAL_KEYS = {
  KeyN: {
    label: 'N',
    value: KeyTable.XK_n,
  },
  KeyT: {
    label: 'T',
    value: KeyTable.XK_t,
  },
  KeyW: {
    label: 'W',
    value: KeyTable.XK_w,
  },
  KeyY: {
    label: 'Y',
    value: KeyTable.XK_y,
  },
};

const F_KEYS = {
  F1: {
    label: 'F1',
    value: KeyTable.XK_F1,
  },
  F2: {
    label: 'F2',
    value: KeyTable.XK_F2,
  },
  F3: {
    label: 'F3',
    value: KeyTable.XK_F3,
  },
  F4: {
    label: 'F4',
    value: KeyTable.XK_F4,
  },
  F5: {
    label: 'F5',
    value: KeyTable.XK_F5,
  },
  F6: {
    label: 'F6',
    value: KeyTable.XK_F6,
  },
  F7: {
    label: 'F7',
    value: KeyTable.XK_F7,
  },
  F8: {
    label: 'F8',
    value: KeyTable.XK_F8,
  },
  F9: {
    label: 'F9',
    value: KeyTable.XK_F9,
  },
  F10: {
    label: 'F10',
    value: KeyTable.XK_F10,
  },
  F11: {
    label: 'F11',
    value: KeyTable.XK_F11,
  },
  F12: {
    label: 'F12',
    value: KeyTable.XK_F12,
  },
};

export default {
  name:       'NovncConsoleWrapper',
  components: {
    RcButton, RcModal, Checkbox, NovncConsole, NovncConsoleCustomKeys, NovncConnectionStatus, NovncIcon, NovncShortcutKeysMenu, NovncStatusCard, NovncViewOptions
  },

  // A VM that is not running has no instance, so find it by the uid in the route instead.
  async fetch() {
    if (this.value?.id) {
      const hash = await allHash({ vmResource: this.$store.dispatch('harvester/find', { type: HCI.VM, id: this.value.id }) });

      this.vmResource = hash.vmResource;

      return;
    }

    const uid = this.$route?.params?.uid;

    try {
      const vms = uid ? await this.$store.dispatch('harvester/findAll', { type: HCI.VM }) : [];

      this.vmResource = (vms || []).find((vm) => vm.metadata?.uid === uid) || {};
    } catch (err) {
      // Only the name is missing then; the not-running card still shows.
      this.vmResource = {};
    }
  },

  props: {
    value: {
      type:     Object,
      required: true,
      default:  () => {
        return {};
      }
    }
  },

  data() {
    return {
      vmResource:        {},
      renderKeysModal:   false,
      settings:          { ...DEFAULT_SETTINGS },
      capabilities:      {},
      isFullscreen:      false,
      confirmAction:     null,
      startedAt:         0,
      consoleStatus:     {
        status:            'connecting',
        retryTimes:        0,
        maximumRetryTimes: 0,
        desktopName:       '',
      },
    };
  },

  computed: {
    preference() {
      return this.$store.getters['management/all'](STEVE.PREFERENCE)?.[0];
    },

    // Custom keys are stored in the user preference, which is not available everywhere.
    hideCustomKeysBar() {
      return !this.preference?.data;
    },

    preferredShortcutKeys() {
      return readShortcuts(this.preference);
    },

    isConnected() {
      return this.consoleStatus.status === CONSOLE_STATUS.CONNECTED;
    },

    // A console that just went away can still report connected for a moment.
    canSendKeys() {
      return !this.isDown && this.isConnected && !this.settings.viewOnly;
    },

    // Shared by the toolbar and the full screen bar.
    shortcutMenuProps() {
      return {
        canSend:       this.canSendKeys,
        blockedReason: this.sendBlockedReason,
        canManage:     !this.hideCustomKeysBar,
        disabled:      !!this.settings.viewOnly || (!this.canSendKeys && this.hideCustomKeysBar),
        shortcuts:     this.preferredShortcutKeys,
      };
    },

    sendBlockedReason() {
      return this.canSendKeys ? '' : this.t('harvester.virtualMachine.detail.console.shortcutMenu.blockedDisconnected');
    },

    vmName() {
      return this.value?.metadata?.name || this.vmResource?.metadata?.name || '';
    },

    vmNamespace() {
      return this.value?.metadata?.namespace || this.vmResource?.metadata?.namespace || '';
    },

    // Without an instance there is no console to connect to, so the toolbar says so.
    connectionStatus() {
      return this.isDown ? CONNECTION_STATE.NOT_RUNNING : this.consoleStatus.status;
    },

    // VNC only exists while the instance runs. A starting instance (Pending, Scheduling) would refuse
    // the first connection and leave "Unable to connect", so the console waits for Running instead.
    isDown() {
      return this.isEmpty(this.value) || !this.vmRunning;
    },

    isStarting() {
      return !this.isEmpty(this.value) && ['Pending', 'Scheduling', 'Scheduled'].includes(this.value?.status?.phase);
    },

    preserveSession() {
      return !!this.$store.getters['harvester-common/getFeatureEnabled']('vncPreserveSession');
    },

    vmRunning() {
      return this.value?.status?.phase === 'Running';
    },

    url() {
      const ip = `${ window.location.hostname }:${ window.location.port }`;

      return `wss://${ ip }${ this.value?.getVMIApiPath }`;
    },

    allKeys() {
      return {
        ...SHORT_KEYS,
        ...FUNCTION_KEYS,
        ...NORMAL_KEYS,
        ...F_KEYS,
      };
    },

    hasSoftRebootAction() {
      return !!this.vmResource?.actions?.softreboot;
    },

    rfbSettings() {
      return {
        viewOnly:         !!this.settings.viewOnly,
        // Full screen always fills the window; the saved mode is back on leaving it.
        scaleViewport:    this.isFullscreen || this.settings.viewMode === VIEW_MODE.SCALE,
        edgeToEdge:       this.isFullscreen,
        zoomPercent:      normalizeZoom(this.settings.zoomPercent),
        resizeSession:    false,
        clipViewport:     false,
        dragViewport:     false,
        qualityLevel:     this.settings.qualityLevel,
        compressionLevel: this.settings.compressionLevel,
      };
    },

    // The pill has one label per state it shows; retries are counted on the console overlay.
    statusLabel() {
      if (this.isDown) {
        return this.t('harvester.virtualMachine.detail.console.status.notRunning');
      }

      const { status } = this.consoleStatus;

      if (status === CONSOLE_STATUS.RECONNECTING) {
        return this.t('harvester.virtualMachine.detail.console.status.connecting');
      }

      if (status === CONSOLE_STATUS.FAILED) {
        return this.t('harvester.virtualMachine.detail.console.status.disconnected');
      }

      return this.t(`harvester.virtualMachine.detail.console.status.${ status }`);
    },
  },

  watch: {
    // The console unmounts without a last status, so start over as connecting for when it is back.
    isDown(down, wasDown) {
      if (down) {
        this.consoleStatus = {
          status: CONSOLE_STATUS.CONNECTING, retryTimes: 0, maximumRetryTimes: 0, desktopName: ''
        };
      } else if (wasDown) {
        this.startedAt = Date.now();
      }
    },
  },

  mounted() {
    this.loadSettings();
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  },

  beforeUnmount() {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  },

  methods: {
    isEmpty(o) {
      return o !== undefined && Object.keys(o).length === 0;
    },

    close() {
      this.$refs.novncConsole?.disconnect();
    },

    // Press the keys in order, then release them in reverse, e.g. Ctrl+Alt+F2.
    sendKeys(keys) {
      if (!this.canSendKeys || !this.$refs.novncConsole) {
        return;
      }

      keys.forEach((key) => {
        this.$refs.novncConsole.sendKey(this.allKeys[key].value, key, true);
      });

      [...keys].reverse().forEach((key) => {
        this.$refs.novncConsole.sendKey(this.allKeys[key].value, key, false);
      });

      this.focusConsole();
    },

    sendCustomKeys(keys) {
      if (!this.canSendKeys || !this.$refs.novncConsole) {
        return;
      }

      const combination = [].concat(keys);
      const keyList = combination.map((K) => baseKey(K, combination));

      keyList.forEach((K) => {
        this.$refs.novncConsole.sendKey(KeyboardUtil.getKeysym(K), KeyboardUtil.getKeycode(K), true);
      });

      [...keyList].reverse().forEach((K) => {
        this.$refs.novncConsole.sendKey(KeyboardUtil.getKeysym(K), KeyboardUtil.getKeycode(K), false);
      });

      this.focusConsole();
    },

    // The shortcut menu hands focus back to its trigger as it closes, so take it on the next tick.
    focusConsole() {
      this.$nextTick(() => this.$refs.novncConsole?.focus());
    },

    // RcModal's focus trap returns focus to the opener in a timeout once the modal unmounts,
    // so queue ours behind it.
    focusConsoleAfterModal() {
      this.$nextTick(() => setTimeout(() => this.$refs.novncConsole?.focus()));
    },

    // Closing the View panel from the keyboard (Esc) leaves the focus nowhere; give it back to the
    // View button, as the menus do. A click elsewhere keeps the focus it moved.
    onViewHide() {
      const focused = document.activeElement;

      // floating-vue hides the panel without removing it, so the focus is still in it at this point.
      if (!focused || focused === document.body || focused.closest('.v-popper__popper')) {
        this.$refs.viewButton?.focus();
      }
    },

    showKeysModal() {
      this.renderKeysModal = true;
    },

    hideKeysModal() {
      this.renderKeysModal = false;
      this.focusConsoleAfterModal();
    },

    reconnect() {
      this.$refs.novncConsole?.reconnect();
    },

    loadSettings() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(CONSOLE_SETTINGS_KEY) || 'null');
        const previous = saved ? null : JSON.parse(window.localStorage.getItem(PREVIOUS_SETTINGS_KEY) || 'null');

        this.settings = {
          viewMode:         Object.values(VIEW_MODE).includes(saved?.viewMode) ? saved.viewMode : DEFAULT_SETTINGS.viewMode,
          zoomPercent:      normalizeZoom(saved?.zoomPercent ?? DEFAULT_SETTINGS.zoomPercent),
          viewOnly:         (saved || previous)?.viewOnly === true,
          qualityLevel:     saved?.qualityLevel ?? DEFAULT_SETTINGS.qualityLevel,
          compressionLevel: saved?.compressionLevel ?? DEFAULT_SETTINGS.compressionLevel,
        };
      } catch (err) {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    },

    saveSettings() {
      window.localStorage.setItem(CONSOLE_SETTINGS_KEY, JSON.stringify(this.settings));
    },

    updateSettings(settings) {
      this.settings = settings;
      this.saveSettings();
    },

    // Back to sending input, the keyboard should reach the VM without clicking the screen first.
    setViewOnly(viewOnly) {
      this.settings = { ...this.settings, viewOnly };
      this.saveSettings();

      if (!viewOnly) {
        this.focusConsole();
      }
    },

    // View only belongs to the toolbar, not the View panel, so the panel's reset leaves it as it is.
    resetSettings() {
      this.settings = { ...DEFAULT_SETTINGS, viewOnly: this.settings.viewOnly };
      this.saveSettings();
    },

    onStatusChanged(info) {
      this.consoleStatus = info;
    },

    onCapabilities(capabilities) {
      this.capabilities = capabilities;
    },

    // Both can restart the VM with one click (Ctrl+Alt+Del reboots most Linux guests), so ask first.
    ctrlAltDelete() {
      if (this.canSendKeys) {
        this.confirmAction = CONFIRM_ACTION.CTRL_ALT_DEL;
      }
    },

    softReboot() {
      if (!this.settings.viewOnly) {
        this.confirmAction = CONFIRM_ACTION.SOFT_REBOOT;
      }
    },

    // RcModal hands focus back to the toolbar button that opened it; the screen should get it.
    cancelConfirm() {
      this.confirmAction = null;
      this.focusConsoleAfterModal();
    },

    runConfirmedAction() {
      const action = this.confirmAction;

      this.confirmAction = null;
      this.focusConsoleAfterModal();

      if (action === CONFIRM_ACTION.CTRL_ALT_DEL && this.canSendKeys) {
        this.$refs.novncConsole?.ctrlAltDelete();
      } else if (action === CONFIRM_ACTION.SOFT_REBOOT) {
        this.vmResource.doSoftReboot();
      }
    },

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          // The whole page, not just the console: menus and modals render outside it.
          await document.documentElement.requestFullscreen();
          // Keyboard lock (Chromium) lets browser shortcuts such as Ctrl+W, Ctrl+T, Ctrl+N and F11
          // reach the guest; outside full screen the browser keeps them.
          await navigator.keyboard?.lock?.(['KeyW', 'KeyT', 'KeyN', 'F11']);
        }

        this.focusConsole();
      } catch (err) {
        this.$store.dispatch('growl/fromError', {
          title: this.t('generic.notification.title.error', { name: escapeHtml(this.vmName) }),
          err,
        }, { root: true });
      }
    },

    onFullscreenChange() {
      this.isFullscreen = !!document.fullscreenElement;

      if (!this.isFullscreen) {
        navigator.keyboard?.unlock?.();
      }
    },

  }
};
</script>

<template>
  <div id="app">
    <div
      ref="consoleContainer"
      class="vm-console"
      :class="{ 'vm-console--fullscreen': isFullscreen }"
    >
      <div
        v-if="isFullscreen"
        class="fullscreen-bar"
        data-testid="vnc-fullscreen-bar"
      >
        <span class="fullscreen-bar__name">{{ vmName }}</span>
        <NovncConnectionStatus
          :status="connectionStatus"
          :label="statusLabel"
          :vm-name="vmName"
          @reconnect="reconnect"
        />
        <span
          class="console-toolbar__divider"
          aria-hidden="true"
        />
        <NovncShortcutKeysMenu
          v-bind="shortcutMenuProps"
          @send-keys="sendKeys"
          @send-shortcut="sendCustomKeys"
          @manage="showKeysModal"
          @ctrl-alt-del="ctrlAltDelete"
        />
        <span
          class="console-toolbar__divider"
          aria-hidden="true"
        />
        <RcButton
          variant="tertiary"
          data-testid="vnc-exit-fullscreen"
          @click="toggleFullscreen"
        >
          <template #before>
            <NovncIcon type="minimize" />
          </template>
          {{ t('harvester.virtualMachine.detail.console.fullscreen.exit') }}
        </RcButton>
      </div>

      <header
        v-else
        class="console-toolbar"
      >
        <div class="console-toolbar__identity">
          <div class="console-toolbar__vm">
            <span
              class="console-toolbar__vm-name"
              data-testid="vnc-vm-name"
            >{{ vmName }}</span>
            <span class="console-toolbar__vm-namespace">{{ vmNamespace }}</span>
          </div>

          <NovncConnectionStatus
            :status="connectionStatus"
            :label="statusLabel"
            :vm-name="vmName"
            @reconnect="reconnect"
          />

          <Checkbox
            class="console-toolbar__view-only"
            :value="!!settings.viewOnly"
            :label="t('harvester.virtualMachine.detail.console.viewOnly')"
            use-body-text-color
            data-testid="vnc-view-only"
            @update:value="setViewOnly"
          />
        </div>

        <div class="console-toolbar__group">
          <NovncShortcutKeysMenu
            v-bind="shortcutMenuProps"
            @send-keys="sendKeys"
            @send-shortcut="sendCustomKeys"
            @manage="showKeysModal"
            @ctrl-alt-del="ctrlAltDelete"
          />
        </div>

        <span
          class="console-toolbar__divider"
          aria-hidden="true"
        />

        <div class="console-toolbar__group">
          <RcButton
            variant="tertiary"
            data-testid="vnc-ctrl-alt-del"
            :disabled="!canSendKeys"
            @click="ctrlAltDelete"
          >
            <template #before>
              <NovncIcon type="power" />
            </template>
            {{ t("harvester.virtualMachine.detail.console.ctrlAltDel") }}
          </RcButton>

          <RcButton
            v-if="hasSoftRebootAction"
            variant="tertiary"
            left-icon="refresh-alt"
            data-testid="vnc-soft-reboot"
            :disabled="!!settings.viewOnly"
            @click="softReboot"
          >
            {{ t("harvester.virtualMachine.detail.console.softReboot") }}
          </RcButton>
        </div>

        <span class="console-toolbar__spacer" />

        <div class="console-toolbar__group">
          <v-dropdown
            placement="bottom-end"
            trigger="click"
            :container="false"
            @hide="onViewHide"
          >
            <RcButton
              ref="viewButton"
              variant="tertiary"
              left-icon="show"
              right-icon="chevron-down"
              data-testid="vnc-view"
            >
              {{ t("harvester.virtualMachine.detail.console.view") }}
            </RcButton>

            <template #popper>
              <NovncViewOptions
                :settings="settings"
                @update="updateSettings"
                @reset="resetSettings"
              />
            </template>
          </v-dropdown>

          <RcButton
            variant="tertiary"
            data-testid="vnc-fullscreen"
            @click="toggleFullscreen"
          >
            <template #before>
              <NovncIcon :type="isFullscreen ? 'minimize' : 'maximize'" />
            </template>
            {{ isFullscreen ? t('harvester.virtualMachine.detail.console.fullscreen.exit') : t('harvester.virtualMachine.detail.console.fullscreen.enter') }}
          </RcButton>
        </div>
      </header>

      <div class="console-area">
        <NovncConsole
          v-if="url && !isDown"
          ref="novncConsole"
          :url="url"
          :settings="rfbSettings"
          :preserve-session="preserveSession"
          :vm-running="vmRunning"
          :vm-name="vmName"
          :started-at="startedAt"
          @status-changed="onStatusChanged"
          @capabilities="onCapabilities"
        />
        <div
          v-if="isDown"
          class="console-area__down"
          data-testid="vnc-not-running"
        >
          <NovncStatusCard
            icon="power"
            :title="t(`harvester.virtualMachine.detail.console.notRunning.${ isStarting ? 'startingTitle' : 'title' }`)"
            :detail="t(`harvester.virtualMachine.detail.console.notRunning.${ isStarting ? 'startingDetail' : 'detail' }`)"
          />
        </div>
        <p
          v-if="!isFullscreen && !isDown"
          class="console-area__hint"
        >
          {{ t(settings.viewOnly ? 'harvester.virtualMachine.detail.console.hintViewOnly' : 'harvester.virtualMachine.detail.console.hint', {}, true) }}
        </p>
      </div>

      <RcModal
        :show="!!confirmAction"
        size="small"
        :title="confirmAction ? t(`harvester.virtualMachine.detail.console.confirm.${ confirmAction }.title`, { name: vmName }) : ''"
        data-testid="vnc-confirm-modal"
        @close="cancelConfirm"
      >
        <p v-if="confirmAction">
          {{ t(`harvester.virtualMachine.detail.console.confirm.${ confirmAction }.message`) }}
        </p>

        <template #primary-action>
          <RcButton
            v-if="confirmAction"
            variant="primary"
            size="large"
            class="confirm-modal__danger"
            data-testid="vnc-confirm-action"
            @click="runConfirmedAction"
          >
            {{ t(`harvester.virtualMachine.detail.console.confirm.${ confirmAction }.button`) }}
          </RcButton>
        </template>
      </RcModal>

      <NovncConsoleCustomKeys
        :show="renderKeysModal"
        @close="hideKeysModal"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .vm-console {
    height: 100vh;
    height: 100dvh;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    background: var(--body-bg);

    // The toolbar gives way to a bar floating over the screen, which takes the whole window. A picture
    // of another shape keeps its proportions, with black around it like on a monitor.
    &--fullscreen {
      position: relative;
      grid-template-rows: minmax(0, 1fr);
      background: #000;

      .console-area {
        gap: 0;
        padding: 0;
      }
    }
  }

  .fullscreen-bar {
    // vnc.vue stretches the console's child divs to full height; the bar keeps its own.
    height: auto;
    position: absolute;
    top: 16px;
    left: 50%;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    // From left: 50% it would only get half the window and squeeze its buttons; it wraps when it has to.
    width: max-content;
    max-width: calc(100vw - 16px);
    padding: 4px 4px 4px 16px;
    border: 1px solid var(--border);
    border-radius: 24px;
    background: var(--nav-bg);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    opacity: 0.7;
    transform: translateX(-50%);
    transition: opacity 0.15s ease;

    // Solid while in use: the pointer is on it, the keyboard is in it, or one of its menus is open.
    &:hover,
    &:has(:focus-visible),
    &:has([aria-expanded='true']) {
      opacity: 1;
    }

    &__name {
      color: var(--body-text);
      font-size: 12px;
      font-weight: 700;
      line-height: 18px;
    }
  }

  // Narrow windows wrap the toolbar instead of pushing the screen out of view.
  .console-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 10px 16px;
    background: var(--nav-bg);

    &__identity {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-right: 8px;
    }

    &__vm {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    &__vm-name {
      color: var(--body-text);
      font-size: 14px;
      font-weight: 700;
      line-height: 21px;
    }

    &__vm-namespace {
      color: var(--muted);
      font-size: 12px;
      line-height: 18px;
    }

    // A Checkbox keeps 10px after its label for its place in a form; here the toolbar sets the gap.
    &__view-only {
      margin-right: -10px;
    }

    &__group {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    &__divider {
      width: 1px;
      height: 24px;
      background: var(--border);
    }

    &__spacer {
      flex: 1;
    }
  }

  .console-area {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 24px;

    // vnc.vue stretches every nested div to the full height; the hint needs its row.
    > .novnc-console {
      flex: 1 1 auto;
      height: auto;
      min-height: 0;
    }

    &__down {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      justify-content: center;
      min-height: 0;
      background: #000;
    }

    &__hint {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 18px;
      text-align: center;
    }
  }

  // RcButton has no destructive variant; this is how the shell's own dialogs colour one. The class
  // is doubled to outrank RcButton's variant rules instead of relying on stylesheet order.
  .confirm-modal__danger.confirm-modal__danger.rc-button {
    &,
    &:focus,
    &.focused {
      background-color: var(--error);
      color: var(--error-text);
    }

    &:hover:not(:disabled) {
      background-color: var(--error-hover-bg);
      color: var(--error-hover-text);
    }
  }
</style>

<style lang="scss">
  .vm-console .v-popper__arrow-container {
    display: none;
  }
  .vm-console .v-popper__popper{
    margin-top: 8px;
  }
  .vm-console .v-popper__inner{
    overflow-y: visible;
  }
</style>
