<script>

export default {
  name:  'HarvesterVlanFormatter',
  props: {
    value: {
      type:    String,
      default: '',
    },
  },
};
</script>

<template>
  <span v-if="value">
    {{ value }}
  </span>
  <span
    v-else
    class="text-muted"
  >
    &mdash;
  </span>
</template>
