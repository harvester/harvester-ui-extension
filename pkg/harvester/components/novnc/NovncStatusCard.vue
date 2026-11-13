<script>
import NovncIcon from './NovncIcon';

// The card the console shows on its black screen when there is nothing to type into: a failed
// connection, or a virtual machine that is not running.
export default {
  name: 'NovncStatusCard',

  components: { NovncIcon },

  props: {
    icon: {
      type:    String,
      default: 'wifi-off',
    },

    title: {
      type:     String,
      required: true,
    },

    detail: {
      type:    String,
      default: '',
    },
  },
};
</script>

<template>
  <div class="status-card">
    <span
      class="status-card__badge"
      aria-hidden="true"
    >
      <NovncIcon :type="icon" />
    </span>
    <h3 class="status-card__title">
      {{ title }}
    </h3>
    <p
      v-if="detail"
      class="status-card__detail"
    >
      {{ detail }}
    </p>
    <div
      v-if="$slots.default"
      class="status-card__actions"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  // Always on the black screen, whatever the theme, so the text is light.
  .status-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    padding: 32px;
    color: #fff;
    text-align: center;

    &__badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      color: rgba(255, 255, 255, 0.8);

      .novnc-icon {
        width: 24px;
        height: 24px;
      }
    }

    &__title {
      margin: 0;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
    }

    &__detail {
      margin: 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      line-height: 16px;
    }

    &__actions {
      display: flex;
      gap: 12px;
      padding-top: 8px;
    }
  }
</style>
