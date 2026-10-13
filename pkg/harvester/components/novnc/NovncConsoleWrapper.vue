<script>
import { STEVE } from '@shell/config/types';
import { escapeHtml } from '@shell/utils/string';
import { allHash } from '@shell/utils/promise';
import KeyTable from '@novnc/novnc/core/input/keysym';
import * as KeyboardUtil from '@novnc/novnc/core/input/util';
import { HCI } from '../../types';
import NovncConsole from './NovncConsole';
import NovncConsoleItem from './NovncConsoleItem';
import NovncConsoleCustomKeys from './NovncConsoleCustomKeys';
import { normalizeZoom } from './ZoomableRFB';

const CONSOLE_SETTINGS_KEY = 'harvester-vnc-console-settings';
const PREFERED_SHORTCUT_KEYS = 'prefered-shortcut-keys';

const VIEW_MODE = {
  SCALE:  'scale',
  NONE:   'none',
};

const DEFAULT_SETTINGS = {
  viewMode:         VIEW_MODE.NONE,
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
    NovncConsole, NovncConsoleItem, NovncConsoleCustomKeys
  },

  async fetch() {
    const _hash = { vmResource: this.$store.dispatch('harvester/find', { type: HCI.VM, id: this.value.id }) };

    const hash = await allHash(_hash);

    this.vmResource = hash.vmResource;
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
      keysRecord:        [],
      vmResource:        {},
      renderKeysModal:   false,
      settings:          { ...DEFAULT_SETTINGS },
      capabilities:      {},
      isFullscreen:      false,
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

    savedShortcutKeys() {
      const preferedShortcutKeys = this.preference?.data?.[PREFERED_SHORTCUT_KEYS];

      if (!preferedShortcutKeys) {
        return [];
      }

      try {
        return JSON.parse(preferedShortcutKeys);
      } catch (err) {
        return [];
      }
    },

    preferredShortcutKeys() {
      return (this.savedShortcutKeys || []).map((item) => {
        return {
          label: item.map((K) => K.key.charAt(0).toUpperCase() + K.key.slice(1)).join('+'),
          value: item
        };
      });
    },

    canSendKeys() {
      return this.consoleStatus.status === 'connected' && !this.settings.viewOnly;
    },

    isDown() {
      return this.isEmpty(this.value);
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

    keymap() {
      const out = {
        ...SHORT_KEYS,
        PrintScreen: FUNCTION_KEYS.PrintScreen,
        ...F_KEYS,
      };

      out.AltLeft = { ...SHORT_KEYS.AltLeft, keys: { PrintScreen: FUNCTION_KEYS.PrintScreen, ...F_KEYS } };
      out.ControlLeft = {
        ...SHORT_KEYS.ControlLeft,
        keys: {
          AltLeft: {
            ...SHORT_KEYS.AltLeft,
            keys: { Delete: FUNCTION_KEYS.Delete }
          },
          ...NORMAL_KEYS,
        },
      };

      return out;
    },

    hasSoftRebootAction() {
      return !!this.vmResource?.actions?.softreboot;
    },

    rfbSettings() {
      return {
        viewOnly:         this.settings.viewOnly,
        scaleViewport:    this.settings.viewMode === VIEW_MODE.SCALE,
        zoomPercent:      normalizeZoom(this.settings.zoomPercent),
        resizeSession:    false,
        clipViewport:     false,
        dragViewport:     false,
        qualityLevel:     this.settings.qualityLevel,
        compressionLevel: this.settings.compressionLevel,
      };
    },

    viewModeOptions() {
      return Object.values(VIEW_MODE).map((value) => ({
        value,
        label: this.t(`harvester.virtualMachine.detail.console.settings.viewMode.${ value }`)
      }));
    },

    statusLabel() {
      const { status, retryTimes, maximumRetryTimes } = this.consoleStatus;

      if (status === 'reconnecting') {
        return this.t('harvester.virtualMachine.detail.console.status.reconnecting', { retryTimes, maximumRetryTimes });
      }

      return this.t(`harvester.virtualMachine.detail.console.status.${ status }`);
    },
  },

  watch: {
    settings: {
      deep: true,
      handler(neu) {
        window.localStorage.setItem(CONSOLE_SETTINGS_KEY, JSON.stringify(neu));
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
      this.$refs.novncConsole.disconnect();
    },

    update({ key, pos }) {
      this.keysRecord.splice(pos, this.keysRecord.length - pos, key);
    },

    // Send function key, e.g. ALT + F
    sendKeys() {
      if (!this.canSendKeys || !this.$refs.novncConsole) {
        return;
      }

      this.keysRecord.forEach((key) => {
        this.$refs.novncConsole.sendKey(this.allKeys[key].value, key, true);
      });

      [...this.keysRecord].reverse().forEach((key) => {
        this.$refs.novncConsole.sendKey(this.allKeys[key].value, key, false);
      });

      this.$refs.popover.hide();
      this.keysRecord = [];
    },

    sendCustomKeys(keys) {
      if (!this.canSendKeys || !this.$refs.novncConsole) {
        return;
      }

      const keyList = [].concat(keys);

      keyList.forEach((K) => {
        this.$refs.novncConsole.sendKey(KeyboardUtil.getKeysym(K), KeyboardUtil.getKeycode(K), true);
      });

      [...keyList].reverse().forEach((K) => {
        this.$refs.novncConsole.sendKey(KeyboardUtil.getKeysym(K), KeyboardUtil.getKeycode(K), false);
      });
    },

    showKeysModal() {
      this.renderKeysModal = true;
    },

    hideKeysModal() {
      this.renderKeysModal = false;
    },

    reconnect() {
      this.$refs.novncConsole.reconnect();
    },

    loadSettings() {
      try {
        const saved = JSON.parse(window.localStorage.getItem(CONSOLE_SETTINGS_KEY) || '{}');

        this.settings = {
          viewMode:         Object.values(VIEW_MODE).includes(saved?.viewMode) ? saved.viewMode : DEFAULT_SETTINGS.viewMode,
          zoomPercent:      normalizeZoom(saved?.zoomPercent ?? DEFAULT_SETTINGS.zoomPercent),
          viewOnly:         saved?.viewOnly === true,
          qualityLevel:     saved?.qualityLevel ?? DEFAULT_SETTINGS.qualityLevel,
          compressionLevel: saved?.compressionLevel ?? DEFAULT_SETTINGS.compressionLevel,
        };
      } catch (err) {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    },

    onStatusChanged(info) {
      this.consoleStatus = info;
    },

    onCapabilities(capabilities) {
      this.capabilities = capabilities;
    },

    ctrlAltDelete() {
      if (this.canSendKeys) {
        this.$refs.novncConsole?.ctrlAltDelete();
      }
    },

    async toggleFullscreen() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await this.$refs.consoleContainer.requestFullscreen();
          // Keyboard lock lets shortcuts such as Ctrl+W and F11 reach the guest.
          await navigator.keyboard?.lock?.(['KeyW', 'F11']);
        }
      } catch (err) {
        this.$store.dispatch('growl/fromError', {
          title: this.t('generic.notification.title.error', { name: escapeHtml(this.value.metadata.name) }),
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

    softReboot() {
      this.vmResource.doSoftReboot();
    },

  }
};
</script>

<template>
  <div id="app">
    <div
      ref="consoleContainer"
      class="vm-console"
    >
      <div class="combination-keys">
        <div class="toolbar-group">
          <v-dropdown
            ref="popover"
            placement="top"
            trigger="click"
            :container="false"
            @auto-hide="keysRecord = []"
          >
            <button
              class="btn btn-sm bg-primary"
              :disabled="!canSendKeys"
            >
              {{ t("harvester.virtualMachine.detail.console.shortcutKeys") }}
            </button>

            <template #popper>
              <novnc-console-item
                :items="keymap"
                :path="keysRecord"
                :pos="0"
                @update="update"
                @send-keys="sendKeys"
              />
            </template>
          </v-dropdown>

          <button
            class="btn btn-sm bg-primary"
            :disabled="!canSendKeys"
            @click="ctrlAltDelete"
          >
            Ctrl+Alt+Del
          </button>

          <v-dropdown
            v-if="!hideCustomKeysBar"
            placement="top"
            trigger="click"
            :container="false"
          >
            <button class="btn btn-sm bg-primary">
              {{ t("harvester.virtualMachine.detail.console.customShortcutKeys") }}
            </button>

            <template #popper>
              <div>
                <button
                  class="btn btn-sm bg-primary"
                  @click="showKeysModal"
                >
                  {{ t("harvester.virtualMachine.detail.console.management") }}
                </button>
              </div>

              <hr>

              <div
                v-for="(keys, index) in preferredShortcutKeys"
                :key="index"
              >
                <button
                  class="btn btn-sm bg-primary"
                  :disabled="!canSendKeys"
                  @click="sendCustomKeys(keys.value)"
                >
                  {{ keys.label }}
                </button>
              </div>
            </template>
          </v-dropdown>

          <v-dropdown
            placement="top"
            trigger="click"
            :container="false"
          >
            <button class="btn btn-sm bg-primary">
              {{ t("harvester.virtualMachine.detail.console.settings.label") }}
            </button>

            <template #popper>
              <div class="console-panel">
                <label>{{ t('harvester.virtualMachine.detail.console.settings.viewMode.label') }}</label>
                <div
                  v-for="option in viewModeOptions"
                  :key="option.value"
                >
                  <label class="console-panel__option">
                    <input
                      v-model="settings.viewMode"
                      type="radio"
                      :value="option.value"
                    >
                    {{ option.label }}
                  </label>
                </div>

                <label
                  for="vnc-zoom"
                  class="console-panel__zoom-label"
                >
                  <span>{{ t('harvester.virtualMachine.detail.console.settings.zoom') }}</span>
                  <span>{{ settings.zoomPercent }}%</span>
                </label>
                <input
                  id="vnc-zoom"
                  v-model.number="settings.zoomPercent"
                  class="console-panel__zoom"
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  :disabled="settings.viewMode === 'scale'"
                  :aria-valuetext="`${ settings.zoomPercent }%`"
                >

                <label class="console-panel__option">
                  <input
                    v-model="settings.viewOnly"
                    type="checkbox"
                  >
                  {{ t('harvester.virtualMachine.detail.console.settings.viewOnly') }}
                </label>

                <label
                  for="vnc-quality"
                  class="console-panel__zoom-label"
                >
                  <span>{{ t('harvester.virtualMachine.detail.console.settings.quality') }}</span>
                  <span>{{ settings.qualityLevel }}</span>
                </label>
                <input
                  id="vnc-quality"
                  v-model.number="settings.qualityLevel"
                  class="console-panel__zoom"
                  type="range"
                  min="0"
                  max="9"
                  step="1"
                >

                <label
                  for="vnc-compression"
                  class="console-panel__zoom-label"
                >
                  <span>{{ t('harvester.virtualMachine.detail.console.settings.compression') }}</span>
                  <span>{{ settings.compressionLevel }}</span>
                </label>
                <input
                  id="vnc-compression"
                  v-model.number="settings.compressionLevel"
                  class="console-panel__zoom"
                  type="range"
                  min="0"
                  max="9"
                  step="1"
                >
              </div>
            </template>
          </v-dropdown>
        </div>

        <div class="toolbar-group">
          <span
            class="console-status"
            role="status"
            aria-live="polite"
          >{{ statusLabel }}</span>

          <button
            v-if="hasSoftRebootAction"
            class="btn btn-sm bg-primary"
            @click="softReboot"
          >
            {{ t("harvester.action.softreboot") }}
          </button>

          <button
            class="btn btn-sm bg-primary"
            @click="reconnect"
          >
            {{ t("harvester.action.reconnect") }}
          </button>

          <button
            class="btn btn-sm bg-primary"
            @click="toggleFullscreen"
          >
            {{ isFullscreen ? t('harvester.virtualMachine.detail.console.fullscreen.exit') : t('harvester.virtualMachine.detail.console.fullscreen.enter') }}
          </button>
        </div>
      </div>

      <NovncConsole
        v-if="url && !isDown"
        ref="novncConsole"
        :url="url"
        :settings="rfbSettings"
        @status-changed="onStatusChanged"
        @capabilities="onCapabilities"
      />
      <p v-if="isDown">
        {{ t("harvester.virtualMachine.detail.console.down") }}
      </p>

      <NovncConsoleCustomKeys
        v-if="renderKeysModal"
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
    grid-template-rows: 32px minmax(0, 1fr);
  }

  .combination-keys {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgb(40, 40, 40);
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .console-status {
    color: #fff;
    font-size: 12px;
    margin-right: 8px;
  }

  .console-panel {
    display: flex;
    flex-direction: column;
    width: 260px;
    padding: 4px;

    &__zoom-label {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-variant-numeric: tabular-nums;
    }

    &__zoom {
      width: 100%;
      margin: 4px 0 8px;
    }

    &__option {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 2px 0;
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
