<script>
export default {
  props: {
    row: {
      type:     Object,
      required: true,
    },
  },
  computed: {
    descriptionText() {
      return this.row?.description || '';
    },
  },
};
</script>

<template>
  <span
    v-clean-tooltip="{content: descriptionText, skidding: -30, placement: 'top-start', popperClass: ['harvester-description-tooltip']}"
    class="harvester-description-text"
  >
    {{ descriptionText }}
  </span>
</template>

<style lang="scss">
  .harvester-description-text {
    display: block;
    width: inherit;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .harvester-description-tooltip {
    overflow-wrap: break-word;
  }
</style>
