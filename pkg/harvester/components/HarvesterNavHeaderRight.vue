<script setup>
import HarvesterConnectionStatus from './HarvesterConnectionStatus';
import HarvesterUpgradeHeader from './HarvesterUpgradeHeader';
</script>

<template>
  <div class="harvester-nav-header-right">
    <HarvesterConnectionStatus />
    <HarvesterUpgradeHeader />
  </div>
</template>

<style lang="scss" scoped>
.harvester-nav-header-right {
  display: flex;
  align-items: center;
}
</style>
