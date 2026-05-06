<script setup>
defineProps({
  networkEntries: {
    type:    Array,
    default: () => [],
  },
  storageEntries: {
    type:    Array,
    default: () => [],
  },
});
</script>

<template>
  <div class="mappings-cell">
    <div
      v-for="(entry, idx) in networkEntries"
      :key="'net-' + idx"
      class="mapping-entry"
    >
      <i class="icon icon-cluster" />
      <span>{{ entry }}</span>
    </div>
    <div
      v-for="(entry, idx) in storageEntries"
      :key="'stor-' + idx"
      class="mapping-entry"
    >
      <i class="icon icon-storage" />
      <span>{{ entry }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .mappings-cell {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mapping-entry {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);

    .icon {
      font-size: 16px;
    }
  }
</style>
