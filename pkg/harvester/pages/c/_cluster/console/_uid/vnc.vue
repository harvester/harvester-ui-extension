<script>
import { defineAsyncComponent } from 'vue';
import Loading from '@shell/components/Loading';
import TabTitle from '@shell/components/TabTitle';
import { HCI } from '../../../../../types';

export default {
  components: {
    NovncConsoleWrapper: defineAsyncComponent({
      loader:           () => import('../../../../../components/novnc/NovncConsoleWrapper.vue'),
      loadingComponent: Loading,
    }),
    Loading,
    TabTitle
  },

  async fetch() {
    this.rows = await this.$store.dispatch('harvester/findAll', { type: HCI.VMI });
  },

  data() {
    return { uid: this.$route.params.uid };
  },

  computed: {
    vmi() {
      const vmiList = this.$store.getters['harvester/all'](HCI.VMI) || [];

      const vmi = vmiList.find( (VMI) => {
        return VMI?.metadata?.ownerReferences?.[0]?.uid === this.uid;
      });

      return vmi;
    },
  },

  mounted() {
    window.addEventListener('beforeunload', () => {
      this.$refs.console?.close();
    });
  },

};
</script>

<template>
  <TabTitle
    v-if="vmi?.metadata?.name"
    :breadcrumb="false"
    :show-child="false"
  >
    {{ vmi.metadata.name }}
  </TabTitle>
  <Loading v-if="$fetchState.pending" />
  <NovncConsoleWrapper
    v-else
    ref="console"
    v-model:value="vmi"
    class="novnc-wrapper"
  />
</template>

<style>
HTML, BODY, MAIN, #__nuxt, #__layout, #app, .vm-console, .vm-console > DIV, .vm-console > DIV > DIV {
  height: 100%;
}
</style>
