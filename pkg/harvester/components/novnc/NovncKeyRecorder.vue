<script>
import RcStatusIndicator from '@components/Pill/RcStatusIndicator';
import RcTag from '@components/Pill/RcTag';
import { MODIFIER_KEYS, baseKey, keyLabel, recordKey } from './shortcuts';

export default {
  name: 'NovncKeyRecorder',

  components: { RcStatusIndicator, RcTag },

  props: {
    // The recorded keys, as stored for a shortcut.
    value: {
      type:    Array,
      default: () => [],
    },

    ariaLabelledby: {
      type:    String,
      default: undefined,
    },
  },

  emits: ['update:value'],

  data() {
    return { recording: false, pending: [] };
  },

  computed: {
    state() {
      if (this.recording) {
        return 'recording';
      }

      return this.value.length ? 'captured' : 'empty';
    },

    labels() {
      return this.value.map((K) => keyLabel(baseKey(K, this.value).key));
    },

    valueId() {
      return `vnc-key-recorder-value-${ this.$.uid }`;
    },

    // Read out with the field's label, so screen readers hear what is recorded.
    announcement() {
      if (this.state === 'recording') {
        return this.t('harvester.virtualMachine.detail.console.customKeys.recorder.recordingStatus');
      }

      return this.labels.join('+');
    },
  },

  methods: {
    start() {
      this.pending = [];
      this.recording = true;
    },

    stop() {
      this.recording = false;
      this.pending = [];
    },

    // Modifiers wait for the key they go with; the first other key ends the combination.
    onKeydown(event) {
      if (!this.recording) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.start();
        }

        return;
      }

      // Esc or Tab on their own leave the field, so it never traps the keyboard; with a modifier
      // they are part of the combination (Ctrl+Shift+Esc).
      if (!this.pending.length && (event.key === 'Escape' || event.key === 'Tab')) {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
        }
        this.stop();

        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.repeat) {
        return;
      }

      if (MODIFIER_KEYS.includes(event.key)) {
        if (!this.pending.some((K) => K.key === event.key)) {
          this.pending.push(recordKey(event));
        }

        return;
      }

      this.$emit('update:value', [...this.pending, recordKey(event, this.pending)]);
      this.stop();
    },

    // Modifiers released before any other key are the combination themselves, such as the Windows key on
    // its own. It waits for the last one, so Ctrl+Shift can be let go one key at a time.
    onKeyup(event) {
      if (!this.recording || !this.pending.length || !MODIFIER_KEYS.includes(event.key)) {
        return;
      }

      if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.$emit('update:value', [...this.pending]);
      this.stop();
    },
  },
};
</script>

<template>
  <div
    class="key-recorder"
    :class="`key-recorder--${ state }`"
    role="button"
    tabindex="0"
    :aria-labelledby="ariaLabelledby ? `${ ariaLabelledby } ${ valueId }` : valueId"
    :aria-pressed="recording"
    data-testid="vnc-key-recorder"
    @click="start"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @blur="stop"
  >
    <span
      :id="valueId"
      class="sr-only"
      aria-live="polite"
    >{{ announcement }}</span>

    <template v-if="state === 'recording'">
      <span class="key-recorder__hint">{{ t('harvester.virtualMachine.detail.console.customKeys.recorder.recording') }}</span>
      <span class="key-recorder__status">
        <RcStatusIndicator
          shape="disc"
          status="error"
        />
        {{ t('harvester.virtualMachine.detail.console.customKeys.recorder.recordingStatus') }}
      </span>
    </template>

    <template v-else-if="state === 'captured'">
      <span class="key-recorder__keys">
        <RcTag
          v-for="(label, i) in labels"
          :key="i"
          type="active"
        >
          {{ label }}
        </RcTag>
      </span>
      <span class="key-recorder__again">{{ t('harvester.virtualMachine.detail.console.customKeys.recorder.again') }}</span>
    </template>

    <span
      v-else
      class="key-recorder__hint"
    >{{ t('harvester.virtualMachine.detail.console.customKeys.recorder.empty') }}</span>
  </div>
</template>

<style lang="scss" scoped>
  .key-recorder {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 14px;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: var(--input-bg);
    cursor: pointer;

    &--empty {
      border-style: dashed;
    }

    &--recording {
      border: 2px solid var(--primary-keyboard-focus);
      padding: 0 13px;
    }

    &:focus-visible {
      @include focus-outline;
    }

    &__hint {
      color: var(--muted);
      font-size: 14px;
      line-height: 21px;
    }

    &__keys {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    &__status,
    &__again {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      font-size: 12px;
      line-height: 18px;
    }

    &__again {
      color: var(--muted);
    }
  }
</style>
