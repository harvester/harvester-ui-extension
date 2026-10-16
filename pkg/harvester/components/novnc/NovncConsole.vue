<script>
import ModalWithCard from '@shell/components/ModalWithCard';
import ZoomableRFB from './ZoomableRFB';

export const CONSOLE_STATUS = {
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FAILED:       'failed',
};

export const CONSOLE_FAILURE = {
  IN_USE:      'inUse',
  UNAVAILABLE: 'unavailable',
  DROPPED:     'dropped',
  ERROR:       'error',
};

const MAXIMUM_RETRY_TIMES = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAXIMUM_RECONNECT_DELAY = 30000;

const clampLevel = (value, fallback) => {
  const level = Number.parseInt(value, 10);

  if (Number.isNaN(level)) {
    return fallback;
  }

  return Math.min(Math.max(level, 0), 9);
};

export default {
  name: 'NovncConsole',

  components: { ModalWithCard },

  props: {
    url: {
      type:    String,
      default: ''
    },

    settings: {
      type:    Object,
      default: () => ({})
    },

    // KubeVirt honours preserveSession from v1.6.3. Older versions ignore it, so every
    // connection takes the console over and automatic retries would kick the other user.
    preserveSession: {
      type:    Boolean,
      default: true
    },

    vmRunning: {
      type:    Boolean,
      default: true
    },
  },

  emits: ['status-changed', 'capabilities'],

  data() {
    return {
      rfb:               null,
      status:            CONSOLE_STATUS.CONNECTING,
      statusDetail:      '',
      desktopName:       '',
      retryTimes:        0,
      maximumRetryTimes: MAXIMUM_RETRY_TIMES,
      reconnectTimer:    null,
      isClosed:          false,
      failure:           '',
      showTakeOverModal: false,
      focused:           false,
    };
  },

  computed: {
    statusInfo() {
      return {
        status:            this.status,
        detail:            this.statusDetail,
        desktopName:       this.desktopName,
        retryTimes:        this.retryTimes,
        maximumRetryTimes: this.maximumRetryTimes,
      };
    },

    showError() {
      return this.status === CONSOLE_STATUS.FAILED || (this.status === CONSOLE_STATUS.DISCONNECTED && this.failure === CONSOLE_FAILURE.DROPPED);
    },

    canTakeOver() {
      return this.preserveSession && !this.isClosed;
    },

    failureTitle() {
      return this.t(`harvester.virtualMachine.detail.console.failure.${ this.failure || CONSOLE_FAILURE.ERROR }`);
    },

    showReconnecting() {
      return this.status === CONSOLE_STATUS.RECONNECTING;
    },
  },

  watch: {
    url() {
      this.reconnect();
    },

    settings: {
      deep:    true,
      handler: 'applySettings'
    },

    statusInfo: {
      immediate: true,
      handler(neu) {
        this.$emit('status-changed', neu);
      }
    },
  },

  mounted() {
    // noVNC hides the canvas focus outline, so track focus to show where typing goes.
    this.$refs.view.addEventListener('focusin', this.onFocusIn);
    this.$refs.view.addEventListener('focusout', this.onFocusOut);

    this.$nextTick(() => {
      this.connect();
    });
  },

  beforeUnmount() {
    this.$refs.view?.removeEventListener('focusin', this.onFocusIn);
    this.$refs.view?.removeEventListener('focusout', this.onFocusOut);
    this.isClosed = true;
    this.clearReconnectTimer();
    this.teardown();
  },

  methods: {
    connect(takeOver = false) {
      if (!this.url || this.isClosed) {
        return;
      }

      this.teardown();

      this.failure = '';
      this.status = this.retryTimes > 0 ? CONSOLE_STATUS.RECONNECTING : CONSOLE_STATUS.CONNECTING;

      let rfb;

      try {
        const url = new URL(this.url);

        if (this.preserveSession) {
          url.searchParams.set('preserveSession', takeOver === true ? 'false' : 'true');
        }
        rfb = new ZoomableRFB(this.$refs.view, url.href, { shared: true });
      } catch (err) {
        this.statusDetail = err?.message || `${ err }`;
        this.status = CONSOLE_STATUS.FAILED;

        return;
      }

      rfb.addEventListener('connect', this.onConnect);
      rfb.addEventListener('disconnect', this.onDisconnect);
      rfb.addEventListener('securityfailure', this.onSecurityFailure);
      rfb.addEventListener('credentialsrequired', this.onCredentialsRequired);
      rfb.addEventListener('desktopname', this.onDesktopName);
      rfb.addEventListener('capabilities', this.onCapabilities);

      this.rfb = rfb;
      this.applySettings();
    },

    reconnect() {
      this.clearReconnectTimer();

      this.isClosed = false;
      this.retryTimes = 0;
      this.statusDetail = '';
      this.connect();
    },

    takeOver() {
      this.showTakeOverModal = true;
    },

    cancelTakeOver() {
      this.showTakeOverModal = false;
    },

    confirmTakeOver() {
      this.showTakeOverModal = false;
      this.clearReconnectTimer();
      this.isClosed = false;
      this.retryTimes = 0;
      this.statusDetail = '';
      this.connect(true);
    },

    disconnect() {
      this.isClosed = true;
      this.clearReconnectTimer();
      this.teardown();
      this.status = CONSOLE_STATUS.DISCONNECTED;
    },

    onConnect() {
      this.clearReconnectTimer();

      this.retryTimes = 0;
      this.statusDetail = '';
      this.status = CONSOLE_STATUS.CONNECTED;
      this.applySettings();
      this.focus();
    },

    focus() {
      this.rfb?.focus();
    },

    onFocusIn() {
      this.focused = true;
    },

    onFocusOut() {
      this.focused = false;
    },

    onDisconnect() {
      const wasConnected = this.status === CONSOLE_STATUS.CONNECTED;
      const wasRetrying = this.status === CONSOLE_STATUS.RECONNECTING;

      this.teardown(false);

      if (this.isClosed) {
        if (this.status !== CONSOLE_STATUS.FAILED) {
          this.status = CONSOLE_STATUS.DISCONNECTED;
        }

        return;
      }

      if (wasConnected && !this.preserveSession) {
        // Without preserveSession a retry would take the console back from whoever
        // opened it, and the two sessions would keep kicking each other out.
        this.clearReconnectTimer();
        this.failure = CONSOLE_FAILURE.DROPPED;
        this.statusDetail = this.t('harvester.virtualMachine.detail.console.failureDetail.dropped');
        this.status = CONSOLE_STATUS.DISCONNECTED;
      } else if (wasConnected) {
        this.scheduleReconnect();
      } else if (wasRetrying) {
        // Retries use preserveSession, so they fail while another session owns the
        // console. Keep retrying so the console is picked up once it is released,
        // instead of kicking the other session back out.
        this.statusDetail = this.t('harvester.virtualMachine.detail.console.status.inUse');
        this.scheduleReconnect();
      } else {
        this.clearReconnectTimer();
        this.fail(this.preserveSession && this.vmRunning ? CONSOLE_FAILURE.IN_USE : CONSOLE_FAILURE.UNAVAILABLE);
      }
    },

    // The browser cannot see why a WebSocket handshake failed. With preserveSession and a
    // running VM, a refused connection almost always means another session holds the console.
    fail(failure, detail) {
      this.failure = failure;
      this.statusDetail = detail ?? this.t(`harvester.virtualMachine.detail.console.failureDetail.${ failure }`);
      this.status = CONSOLE_STATUS.FAILED;
    },

    // Authentication problems will not fix themselves, so stop retrying.
    onSecurityFailure(e) {
      this.isClosed = true;
      this.clearReconnectTimer();
      this.fail(CONSOLE_FAILURE.ERROR, e?.detail?.reason || '');
    },

    // noVNC pauses the handshake until credentials are sent, so close the socket
    // to avoid holding the console while the failure is shown.
    onCredentialsRequired() {
      this.isClosed = true;
      this.clearReconnectTimer();
      this.teardown();
      this.fail(CONSOLE_FAILURE.ERROR, this.t('harvester.virtualMachine.detail.console.status.credentialsRequired'));
    },

    onDesktopName(e) {
      this.desktopName = e?.detail?.name || '';
    },

    onCapabilities(e) {
      this.$emit('capabilities', e?.detail?.capabilities || {});
    },

    scheduleReconnect() {
      this.clearReconnectTimer();

      if (this.isClosed) {
        return;
      }

      if (this.retryTimes >= this.maximumRetryTimes) {
        this.fail(this.vmRunning ? CONSOLE_FAILURE.IN_USE : CONSOLE_FAILURE.UNAVAILABLE);

        return;
      }

      this.retryTimes += 1;
      this.status = CONSOLE_STATUS.RECONNECTING;

      const delay = Math.min(BASE_RECONNECT_DELAY * (2 ** (this.retryTimes - 1)), MAXIMUM_RECONNECT_DELAY);

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delay);
    },

    clearReconnectTimer() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    },

    teardown(disconnect = true) {
      const rfb = this.rfb;

      if (!rfb) {
        return;
      }

      this.rfb = null;

      rfb.removeEventListener('connect', this.onConnect);
      rfb.removeEventListener('disconnect', this.onDisconnect);
      rfb.removeEventListener('securityfailure', this.onSecurityFailure);
      rfb.removeEventListener('credentialsrequired', this.onCredentialsRequired);
      rfb.removeEventListener('desktopname', this.onDesktopName);
      rfb.removeEventListener('capabilities', this.onCapabilities);

      if (!disconnect) {
        return;
      }

      try {
        rfb.disconnect();
      } catch (err) {
        // The socket may already be gone, nothing left to clean up.
      }
    },

    applySettings() {
      const rfb = this.rfb;

      if (!rfb) {
        return;
      }

      const settings = this.settings || {};

      rfb.viewOnly = !!settings.viewOnly;
      rfb.scaleViewport = !!settings.scaleViewport;
      rfb.resizeSession = !!settings.resizeSession;
      rfb.clipViewport = !!settings.clipViewport;
      rfb.dragViewport = !!settings.dragViewport;
      rfb.zoomPercent = settings.zoomPercent;
      rfb.focusOnClick = settings.focusOnClick !== false;
      rfb.qualityLevel = clampLevel(settings.qualityLevel, 6);
      rfb.compressionLevel = clampLevel(settings.compressionLevel, 2);
    },

    ctrlAltDelete() {
      this.rfb?.sendCtrlAltDel();
    },

    sendKey(keysym, code, down) {
      this.rfb?.sendKey(keysym, code, down);
    },

  }
};
</script>

<template>
  <div class="novnc-console">
    <div
      ref="view"
      class="novnc-screen"
      :class="{ 'is-focused': focused }"
    />

    <div
      v-if="showError || showReconnecting"
      class="novnc-overlay"
    >
      <div
        v-if="showError"
        class="novnc-overlay__card text-center"
      >
        <h3>
          {{ failureTitle }}
        </h3>
        <p
          v-if="statusDetail"
          class="mt-10"
        >
          {{ statusDetail }}
        </p>
        <button
          class="btn role-primary mt-20"
          @click="reconnect"
        >
          {{ t('harvester.action.reconnect') }}
        </button>
        <button
          v-if="canTakeOver"
          class="btn role-secondary mt-20 ml-10"
          @click="takeOver"
        >
          {{ t('harvester.virtualMachine.detail.console.takeOver.label') }}
        </button>
      </div>

      <div
        v-else
        class="text-center"
      >
        <h2>
          {{ t('vncConsole.reconnecting.message') }}：{{ retryTimes }} of {{ maximumRetryTimes }}
        </h2>
        <p
          v-if="statusDetail"
          class="mt-10"
        >
          {{ statusDetail }}
        </p>
      </div>
    </div>

    <ModalWithCard
      v-if="showTakeOverModal"
      name="takeOverConsole"
      :width="480"
      @finish="cancelTakeOver"
    >
      <template #title>
        {{ t('harvester.virtualMachine.detail.console.takeOver.title') }}
      </template>

      <template #content>
        <p>{{ t('harvester.virtualMachine.detail.console.takeOver.confirm') }}</p>
      </template>

      <template #footer>
        <div class="take-over-actions">
          <button
            class="btn role-secondary mr-10"
            @click="cancelTakeOver"
          >
            {{ t('generic.cancel') }}
          </button>
          <button
            class="btn role-primary"
            @click="confirmTakeOver"
          >
            {{ t('harvester.virtualMachine.detail.console.takeOver.label') }}
          </button>
        </div>
      </template>
    </ModalWithCard>
  </div>
</template>

<style lang="scss" scoped>
  .novnc-console {
    position: relative;
    box-sizing: border-box;
    height: 100%;
    padding: 8px;
    overflow: hidden;
  }

  .novnc-screen {
    height: 100%;
  }

  .novnc-overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: auto;
    background: rgba(0, 0, 0, 0.75);
    // The overlay is always dark, so its text cannot follow the theme's text colours.
    color: #fff;

    h2,
    h3 {
      color: #fff;
    }

    p {
      color: rgba(255, 255, 255, 0.8);
    }

    &__card {
      max-width: 480px;
      padding: 0 20px;
    }
  }

  .take-over-actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
</style>

<style lang="scss">
  // noVNC sets an inline `outline: none` on its canvas, so mark keyboard focus with a ring instead.
  .novnc-screen.is-focused canvas {
    box-shadow: 0 0 0 2px var(--primary);
  }
</style>
