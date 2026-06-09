<script>
export default {
  name:  'HarvesterHostNetworkConfigModeFormatter',
  props: {
    value: {
      type:    String,
      default: '',
    },
  },

  computed: {
    displayMode() {
      if (this.value?.toLowerCase() === 'dhcp') {
        return 'DHCP';
      }

      if (this.value?.toLowerCase() === 'static') {
        return 'Static';
      }

      return this.value;
    },
  },
};
</script>

<template>
  <span>{{ displayMode }}</span>
</template>
