<script>
import { RcButton } from '@components/RcButton';
import { RcIcon } from '@components/RcIcon';
import { RcModal } from '@components/RcModal';
import NovncStatusCard from './NovncStatusCard';
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
// A VM that just started can refuse VNC for a moment; refusals this soon are retried, not reported.
const STARTUP_GRACE = 60000;

const clampLevel = (value, fallback) => {
  const level = Number.parseInt(value, 10);

  if (Number.isNaN(level)) {
    return fallback;
  }

  return Math.min(Math.max(level, 0), 9);
};

export default {
  name: 'NovncConsole',

  components: {
    RcButton, RcIcon, RcModal, NovncStatusCard
  },

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

    vmName: {
      type:    String,
      default: ''
    },

    // When the VM was seen starting to run on this page (ms), or 0.
    startedAt: {
      type:    Number,
      default: 0
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

    // Only another session holding the console is something taking over can fix.
    canTakeOver() {
      return this.preserveSession && !this.isClosed && this.failure === CONSOLE_FAILURE.IN_USE;
    },

    failureTitle() {
      return this.t(`harvester.virtualMachine.detail.console.failure.${ this.failure || CONSOLE_FAILURE.ERROR }`);
    },

    showConnecting() {
      return this.status === CONSOLE_STATUS.CONNECTING || this.status === CONSOLE_STATUS.RECONNECTING;
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

      // noVNC paints its own grey behind the framebuffer; let the console area show through.
      rfb.background = 'transparent';
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

    // Skip the wait before the next retry, still counting it as one, so a held console keeps
    // being retried instead of turning into the in-use failure.
    retryNow() {
      this.clearReconnectTimer();
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
        this.statusDetail = this.isStartingUp() ? '' : this.t('harvester.virtualMachine.detail.console.status.inUse');
        this.scheduleReconnect();
      } else if (this.isStartingUp()) {
        this.scheduleReconnect();
      } else {
        this.clearReconnectTimer();
        this.fail(this.preserveSession && this.vmRunning ? CONSOLE_FAILURE.IN_USE : CONSOLE_FAILURE.UNAVAILABLE);
      }
    },

    isStartingUp() {
      return !!this.startedAt && Date.now() - this.startedAt < STARTUP_GRACE;
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

      // View only shows the screen but sends no mouse or keyboard input.
      rfb.viewOnly = !!settings.viewOnly;
      rfb.edgeToEdge = !!settings.edgeToEdge;
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
  <div
    class="novnc-console"
    :class="{ 'is-live': status === 'connected' }"
  >
    <div
      ref="view"
      class="novnc-screen"
      :class="{ 'is-focused': focused, 'is-edge-to-edge': settings.edgeToEdge }"
    />

    <div
      v-if="showError || showConnecting"
      class="novnc-overlay"
      data-testid="vnc-overlay"
    >
      <NovncStatusCard
        v-if="showError"
        :title="failureTitle"
        :detail="statusDetail"
      >
        <RcButton
          variant="primary"
          data-testid="vnc-overlay-reconnect"
          @click="reconnect"
        >
          {{ t('harvester.action.reconnect') }}
        </RcButton>
        <RcButton
          v-if="canTakeOver"
          variant="secondary"
          data-testid="vnc-take-over"
          @click="takeOver"
        >
          {{ t('harvester.virtualMachine.detail.console.takeOver.label') }}
        </RcButton>
      </NovncStatusCard>

      <div
        v-else
        class="novnc-overlay__connecting"
      >
        <span class="novnc-overlay__spinner">
          <RcIcon
            type="spinner"
            size="inherit"
            class="icon-spin"
          />
        </span>
        <p class="novnc-overlay__connecting-label">
          {{ t('harvester.virtualMachine.detail.console.overlay.connecting', { name: vmName }) }}
        </p>
        <p
          v-if="retryTimes > 0"
          class="novnc-overlay__detail"
        >
          {{ t('harvester.virtualMachine.detail.console.overlay.attempt', { retryTimes, maximumRetryTimes }) }}
          <template v-if="statusDetail">
            {{ statusDetail }}
          </template>
        </p>
        <RcButton
          v-if="retryTimes > 0"
          variant="secondary"
          data-testid="vnc-reconnect-now"
          @click="retryNow"
        >
          {{ t('harvester.virtualMachine.detail.console.overlay.reconnectNow') }}
        </RcButton>
      </div>
    </div>

    <RcModal
      :show="showTakeOverModal"
      size="small"
      :title="t('harvester.virtualMachine.detail.console.takeOver.title')"
      data-testid="vnc-take-over-modal"
      @close="cancelTakeOver"
    >
      <p>{{ t('harvester.virtualMachine.detail.console.takeOver.confirm') }}</p>

      <template #primary-action>
        <RcButton
          variant="primary"
          size="large"
          data-testid="vnc-take-over-confirm"
          @click="confirmTakeOver"
        >
          {{ t('harvester.virtualMachine.detail.console.takeOver.label') }}
        </RcButton>
      </template>
    </RcModal>
  </div>
</template>

<style lang="scss" scoped>
  // Without a live picture the screen is black like a monitor, so the overlays read the same in
  // every theme; once connected the framebuffer is the screen and the page shows around it.
  .novnc-console {
    position: relative;
    box-sizing: border-box;
    height: 100%;
    overflow: hidden;
    background: #000;

    &.is-live {
      background: transparent;
    }
  }

  .novnc-screen {
    height: 100%;
  }

  // The overlay sits on the black screen, so its text is light whatever the theme.
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
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    text-align: center;

    &__detail {
      margin: 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      line-height: 16px;
    }

    &__connecting {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      max-width: 480px;
      padding: 0 20px;
    }

    // RcIcon has no 20px size, the one the design uses here, so it inherits it.
    &__spinner {
      display: flex;
      font-size: 20px;
    }

    &__connecting-label {
      margin: 0;
      font-size: 16px;
      line-height: 21px;
    }
  }
</style>

<style lang="scss">
  // noVNC sets an inline `outline: none` on its canvas, so frame the screen with a ring instead:
  // a thin border at rest and, while it holds the keyboard, a 2px ring set 2px off the screen so it
  // never blends into a dark framebuffer edge (the SUSE light focus colour is a very dark green).
  .novnc-screen canvas {
    box-shadow: 0 0 0 1px var(--border);
  }

  .novnc-screen.is-focused canvas {
    box-shadow: 0 0 0 2px var(--body-bg), 0 0 0 4px var(--primary-keyboard-focus);
  }

  .novnc-screen.is-edge-to-edge canvas {
    box-shadow: none;
  }
</style>
