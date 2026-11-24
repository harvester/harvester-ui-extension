<script setup>
import { onMounted } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';

const store = useStore();
const { t } = useI18n(store);

// Unlike the shell logout page, skip the Rancher auth provider lookup (it 404s on Harvester).
// `auth/logout` ends the session on the server, then goes to the login page.
onMounted(() => store.dispatch('auth/logout', { force: true }, { root: true }));
</script>

<template>
  <main
    class="main-layout"
    :aria-label="t('layouts.logout')"
  >
    <div>
      <h1>{{ t('logout.message') }}</h1>
    </div>
  </main>
</template>

<style lang="scss" scoped>
main > div {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}
</style>
