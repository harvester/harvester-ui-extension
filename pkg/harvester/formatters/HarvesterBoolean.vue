<script>
export default {
  name:  'HarvesterBooleanFormatter',
  props: {
    value: {
      type:    Boolean,
      default: false,
    },
  },
};
</script>

<template>
  <span v-if="value">
    <i class="icon icon-checkmark" />
  </span>
  <span
    v-else
    class="text-muted"
  >
    &mdash;
  </span>
</template>
