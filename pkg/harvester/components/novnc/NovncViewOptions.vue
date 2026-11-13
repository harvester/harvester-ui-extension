<script>
import ButtonGroup from '@shell/components/ButtonGroup';
import { RcButton } from '@components/RcButton';
import { RcIcon } from '@components/RcIcon';
import { MAXIMUM_ZOOM, MINIMUM_ZOOM, ZOOM_STEP } from './ZoomableRFB';

export const VIEW_MODE = {
  SCALE: 'scale',
  NONE:  'none',
};

const MAXIMUM_LEVEL = 9;

export default {
  name: 'NovncViewOptions',

  components: {
    ButtonGroup, RcButton, RcIcon
  },

  props: {
    settings: {
      type:     Object,
      required: true,
    },
  },

  emits: ['update', 'reset'],

  computed: {
    modeOptions() {
      return [
        { value: VIEW_MODE.SCALE, label: this.t('harvester.virtualMachine.detail.console.viewOptions.automatic') },
        { value: VIEW_MODE.NONE, label: this.t('harvester.virtualMachine.detail.console.viewOptions.manual') },
      ];
    },

    isManual() {
      return this.settings.viewMode === VIEW_MODE.NONE;
    },

    zoom() {
      return {
        min: MINIMUM_ZOOM, max: MAXIMUM_ZOOM, step: ZOOM_STEP
      };
    },

    maximumLevel() {
      return MAXIMUM_LEVEL;
    },
  },

  methods: {
    update(key, value) {
      this.$emit('update', { ...this.settings, [key]: value });
    },

    stepZoom(direction) {
      const next = this.settings.zoomPercent + (direction * ZOOM_STEP);

      this.update('zoomPercent', Math.min(Math.max(next, MINIMUM_ZOOM), MAXIMUM_ZOOM));
    },

    // Feeds the filled part of the track, which native range inputs do not draw on their own.
    fill(value, min, max) {
      return { '--fill': `${ ((value - min) / (max - min)) * 100 }%` };
    },
  },
};
</script>

<template>
  <div
    class="view-options"
    data-testid="vnc-view-options"
  >
    <section class="view-options__section">
      <span class="view-options__label">{{ t('harvester.virtualMachine.detail.console.viewOptions.scaling') }}</span>
      <ButtonGroup
        class="view-options__mode"
        size="medium"
        :value="settings.viewMode"
        :options="modeOptions"
        @update:value="update('viewMode', $event)"
      />
      <p class="view-options__help">
        {{ t(`harvester.virtualMachine.detail.console.viewOptions.${ isManual ? 'manualHelp' : 'automaticHelp' }`) }}
      </p>
    </section>

    <section class="view-options__section">
      <label
        for="vnc-zoom"
        class="view-options__row"
      >
        <span class="view-options__label">{{ t('harvester.virtualMachine.detail.console.viewOptions.zoom') }}</span>
        <span class="view-options__value">{{ settings.zoomPercent }}%</span>
      </label>
      <div class="view-options__zoom">
        <RcButton
          variant="secondary"
          size="small"
          :aria-label="t('harvester.virtualMachine.detail.console.viewOptions.zoomOut')"
          :disabled="!isManual || settings.zoomPercent <= zoom.min"
          @click="stepZoom(-1)"
        >
          <RcIcon
            type="minus"
            size="inherit"
          />
        </RcButton>
        <input
          id="vnc-zoom"
          class="view-options__slider"
          type="range"
          :min="zoom.min"
          :max="zoom.max"
          :step="zoom.step"
          :value="settings.zoomPercent"
          :disabled="!isManual"
          :aria-valuetext="`${ settings.zoomPercent }%`"
          :style="fill(settings.zoomPercent, zoom.min, zoom.max)"
          @input="update('zoomPercent', Number($event.target.value))"
        >
        <RcButton
          variant="secondary"
          size="small"
          :aria-label="t('harvester.virtualMachine.detail.console.viewOptions.zoomIn')"
          :disabled="!isManual || settings.zoomPercent >= zoom.max"
          @click="stepZoom(1)"
        >
          <RcIcon
            type="plus"
            size="inherit"
          />
        </RcButton>
      </div>
    </section>

    <hr class="view-options__divider">

    <section
      v-for="level in ['qualityLevel', 'compressionLevel']"
      :key="level"
      class="view-options__section"
    >
      <label
        :for="`vnc-${ level }`"
        class="view-options__row"
      >
        <span class="view-options__label">{{ t(`harvester.virtualMachine.detail.console.viewOptions.${ level }.label`) }}</span>
        <span class="view-options__value">{{ t('harvester.virtualMachine.detail.console.viewOptions.levelOf', { value: settings[level], max: maximumLevel }) }}</span>
      </label>
      <input
        :id="`vnc-${ level }`"
        class="view-options__slider"
        type="range"
        min="0"
        :max="maximumLevel"
        step="1"
        :value="settings[level]"
        :style="fill(settings[level], 0, maximumLevel)"
        @input="update(level, Number($event.target.value))"
      >
      <p class="view-options__help">
        {{ t(`harvester.virtualMachine.detail.console.viewOptions.${ level }.help`) }}
      </p>
    </section>

    <RcButton
      variant="link"
      class="view-options__reset"
      data-testid="vnc-view-reset"
      @click="$emit('reset')"
    >
      {{ t('harvester.virtualMachine.detail.console.viewOptions.reset') }}
    </RcButton>
  </div>
</template>

<style lang="scss" scoped>
  .view-options {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 336px;
    padding: 16px;
    box-sizing: border-box;

    &__section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 0;
    }

    &__label {
      color: var(--body-text);
      font-size: 12px;
      font-weight: 700;
      line-height: 18px;
    }

    &__value,
    &__help {
      color: var(--muted);
      font-size: 12px;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }

    &__help {
      margin: 0;
    }

    &__mode {
      display: flex;

      button {
        flex: 1;
      }
    }

    &__zoom {
      display: flex;
      align-items: center;
      gap: 8px;

      // Between the zoom buttons the slider takes the room that is left. In the other sections, which
      // are columns, the same rule would set its height and squash it to the track.
      .view-options__slider {
        flex: 1;
      }
    }

    &__divider {
      margin: 0;
      border: 0;
      border-top: 1px solid var(--border);
    }

    // Links sit flush with the panel text instead of carrying button padding.
    &__reset {
      align-self: flex-start;
      --rc-button-padding: 0;
    }

    &__slider {
      width: 100%;
      height: 20px;
      margin: 0;
      background: transparent;
      cursor: pointer;
      appearance: none;

      &::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: 2px;
        background: linear-gradient(to right, var(--primary) var(--fill), var(--muted) var(--fill));
      }

      &::-moz-range-track {
        height: 4px;
        border-radius: 2px;
        background: linear-gradient(to right, var(--primary) var(--fill), var(--muted) var(--fill));
      }

      &::-webkit-slider-thumb {
        width: 16px;
        height: 16px;
        margin-top: -6px;
        border: 2px solid var(--nav-bg);
        border-radius: 50%;
        background: var(--primary);
        appearance: none;
      }

      &::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border: 2px solid var(--nav-bg);
        border-radius: 50%;
        background: var(--primary);
      }

      &:focus-visible {
        @include focus-outline;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    }
  }
</style>
