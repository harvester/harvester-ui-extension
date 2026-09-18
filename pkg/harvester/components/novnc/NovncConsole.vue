<script>
import BrandImage from '@shell/components/BrandImage';
import ZoomableRFB from './ZoomableRFB';

export const CONSOLE_STATUS = {
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  RECONNECTING: 'reconnecting',
  DISCONNECTED: 'disconnected',
  FAILED:       'failed',
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

  components: { BrandImage },

  props: {
    url: {
      type:    String,
      default: ''
    },

    settings: {
      type:    Object,
      default: () => ({})
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
      return this.status === CONSOLE_STATUS.FAILED;
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
    this.$nextTick(() => {
      this.connect();
    });
  },

  beforeUnmount() {
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

      this.status = this.retryTimes > 0 ? CONSOLE_STATUS.RECONNECTING : CONSOLE_STATUS.CONNECTING;

      let rfb;

      try {
        const url = new URL(this.url);

        url.searchParams.set('preserveSession', takeOver === true ? 'false' : 'true');
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
      if (!window.confirm(this.t('harvester.virtualMachine.detail.console.takeOver.confirm'))) {
        return;
      }

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
    },

    onDisconnect() {
      const wasConnected = this.status === CONSOLE_STATUS.CONNECTED;

      this.teardown(false);

      if (this.isClosed) {
        if (this.status !== CONSOLE_STATUS.FAILED) {
          this.status = CONSOLE_STATUS.DISCONNECTED;
        }

        return;
      }

      if (wasConnected) {
        this.scheduleReconnect();
      } else {
        this.clearReconnectTimer();
        this.statusDetail = this.t('harvester.virtualMachine.detail.console.status.unavailable');
        this.status = CONSOLE_STATUS.FAILED;
      }
    },

    // Authentication problems will not fix themselves, so stop retrying.
    onSecurityFailure(e) {
      this.statusDetail = e?.detail?.reason || '';
      this.isClosed = true;
      this.clearReconnectTimer();
      this.status = CONSOLE_STATUS.FAILED;
    },

    onCredentialsRequired() {
      this.statusDetail = this.t('harvester.virtualMachine.detail.console.status.credentialsRequired');
      this.isClosed = true;
      this.clearReconnectTimer();
      this.status = CONSOLE_STATUS.FAILED;
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
        this.status = CONSOLE_STATUS.FAILED;

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
    />

    <div
      v-if="showError || showReconnecting"
      class="novnc-overlay"
    >
      <div
        v-if="showError"
        class="text-center"
      >
        <BrandImage
          file-name="error-desert-landscape.svg"
          width="900"
          height="300"
        />
        <h1>
          {{ t('generic.notification.title.warning') }}
        </h1>
        <h2 class="text-secondary mt-20">
          {{ t('vncConsole.error.message') }}
        </h2>
        <p
          v-if="statusDetail"
          class="text-muted mt-10"
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
          v-if="!isClosed"
          class="btn role-secondary mt-20 ml-10"
          @click="takeOver"
        >
          {{ t('harvester.virtualMachine.detail.console.takeOver.label') }}
        </button>
      </div>

      <h2
        v-else
        class="text-secondary"
      >
        {{ t('vncConsole.reconnecting.message') }}：{{ retryTimes }} of {{ maximumRetryTimes }}
      </h2>
    </div>
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

    h1 {
      font-size: 5rem;
    }

    img {
      max-width: 100%;
    }
  }
</style>
