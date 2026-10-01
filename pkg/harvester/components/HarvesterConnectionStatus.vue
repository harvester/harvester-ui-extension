<script setup>
import {
  computed, onBeforeUnmount, ref, toRaw, watch
} from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import { EVENT_CONNECTED, EVENT_DISCONNECTED, EVENT_CONNECT_ERROR, EVENT_DISCONNECT_ERROR } from '@shell/utils/socket';
import { PRODUCT_NAME as HARVESTER } from '../config/harvester';

// Steve closes the websocket every 30 minutes and reconnects right away, so only report outages that last longer than this
const GRACE_PERIOD_MS = 10 * 1000;

const store = useStore();
const { t } = useI18n(store);

const disconnected = ref(false);
const gaveUp = ref(false);
let graceTimer = null;
let socket = null;

const enabled = computed(() => store.getters['isVirtualCluster'] && store.getters['currentProduct']?.name === HARVESTER);

const clearGraceTimer = () => {
  clearTimeout(graceTimer);
  graceTimer = null;
};

const onConnected = () => {
  clearGraceTimer();
  disconnected.value = false;
  gaveUp.value = false;
};

const onDisconnected = () => {
  if (!graceTimer && !disconnected.value) {
    graceTimer = setTimeout(() => {
      graceTimer = null;
      disconnected.value = true;
    }, GRACE_PERIOD_MS);
  }
};

const onGaveUp = () => {
  clearGraceTimer();
  disconnected.value = true;
  gaveUp.value = true;
};

const listeners = {
  [EVENT_CONNECTED]:        onConnected,
  [EVENT_DISCONNECTED]:     onDisconnected,
  [EVENT_CONNECT_ERROR]:    onDisconnected,
  [EVENT_DISCONNECT_ERROR]: onGaveUp,
};

const detach = () => {
  Object.entries(listeners).forEach(([event, fn]) => socket?.removeEventListener(event, fn));
  socket = null;
};

// The harvester store creates its socket when the cluster is loaded, so it may not exist yet when this component mounts
watch(() => store.state.harvester?.socket, (neu) => {
  if (toRaw(neu) === socket) {
    return;
  }

  detach();
  onConnected();
  // Socket is an EventTarget, whose methods throw when called on the reactive proxy that vuex hands out
  socket = toRaw(neu);
  Object.entries(listeners).forEach(([event, fn]) => socket?.addEventListener(event, fn));
}, { immediate: true });

onBeforeUnmount(() => {
  clearGraceTimer();
  detach();
});

const tooltip = computed(() => t(gaveUp.value ? 'harvester.connectionStatus.gaveUp' : 'harvester.connectionStatus.reconnecting'));

const reload = () => window.location.reload();
</script>

<template>
  <div
    v-if="enabled && disconnected"
    v-clean-tooltip="{ content: tooltip, placement: 'bottom' }"
    class="connection-status"
    role="alert"
    data-testid="harvester-connection-status"
  >
    <i class="icon icon-warning" />
    <span>{{ t('harvester.connectionStatus.label') }}</span>
    <button
      v-if="gaveUp"
      class="btn btn-sm role-link"
      @click="reload"
    >
      {{ t('harvester.connectionStatus.reload') }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-right: 10px;
  padding: 2px 10px;
  border-radius: var(--border-radius);
  background: var(--error-banner-bg);
  color: var(--error);
  white-space: nowrap;

  .btn {
    padding: 0;
    min-height: auto;
  }
}
</style>
