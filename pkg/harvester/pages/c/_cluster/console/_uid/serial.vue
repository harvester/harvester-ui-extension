<script>
import { HCI } from '../../../../../types';
import SerialConsole from '../../../../../components/SerialConsole';

export default {
  components: { SerialConsole },

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
      this.$refs.serialConsole.close();
    });
  },

  head() {
    return { title: this.vmi?.metadata?.name };
  },
};
</script>

<template>
  <div class="serial-console-page">
    <SerialConsole
      ref="serialConsole"
      :value="vmi || {}"
    />
  </div>
</template>

<style lang="scss">
  html,
  body,
  #__nuxt,
  #__layout,
  main {
    height: 100%;
  }

  .serial-console-page {
    position: fixed;
    inset: 0;
    min-height: 0;
    background: var(--body-bg);
    color: var(--terminal-text);

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 6px;
      pointer-events: none;
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.25));
    }

    .harvester-shell-container {
      height: 100%;
      background: var(--terminal-bg);
    }
  }
</style>
