<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { NODE } from '@shell/config/types';
import { HCI } from '../types';

export default {
  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    LabeledSelect,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    }
  },

  data() {
    return { defaultInterface: this.value?.spec?.defaultInterface || '' };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      nodes:        this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      linkMonitors: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.LINK_MONITOR }),
    });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    nodes() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE);

      return nodes.filter((n) => n.isEtcd !== 'true');
    },

    nics() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const linkMonitor = this.$store.getters[`${ inStore }/byId`](HCI.LINK_MONITOR, 'nic') || {};
      const linkStatus = linkMonitor?.status?.linkStatus || {};
      const nodes = this.nodes.map((n) => n.id);

      const out = [];

      // Collect all nics from all nodes
      Object.keys(linkStatus).map((nodeName) => {
        if (nodes.includes(nodeName)) {
          const nics = linkStatus[nodeName] || [];

          nics.map((nic) => {
            out.push({
              ...nic,
              nodeName,
            });
          });
        }
      });

      return out;
    },

    nicOptions() {
      const out = [];
      const seen = new Set();

      (this.nics || []).forEach((nic) => {
        if (!seen.has(nic.name)) {
          seen.add(nic.name);
          out.push({
            label: nic.name,
            value: nic.name,
          });
        }
      });

      return out.sort((a, b) => a.label.localeCompare(b.label));
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      this.value.spec.defaultInterface = this.defaultInterface;
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />

    <div class="mt-20">
      <LabeledSelect
        v-model:value="defaultInterface"
        class="mb-20"
        :options="nicOptions"
        :mode="mode"
        :label="t('harvester.providerNetwork.defaultInterface.label')"
        :placeholder="t('harvester.providerNetwork.defaultInterface.placeholder')"
      />
    </div>
  </CruResource>
</template>
