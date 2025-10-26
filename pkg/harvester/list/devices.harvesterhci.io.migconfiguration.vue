<script>
import { STATE,  NAME} from '@shell/config/table-headers';
import { allHash } from '@shell/utils/promise';
import Banner from '@components/Banner/Banner.vue';
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';
import { HCI } from '../types';

export default {
  name: 'ListMIGConfigurations',

  inheritAttrs: false,

  components: {
    Banner,
    Loading,
    ResourceTable,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.schema = this.$store.getters[`${ inStore }/schemaFor`](HCI.MIG_CONFIGURATION);

    if (this.hasSchema) {
      try {
        const hash = await allHash({ migconfigs: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.MIG_CONFIGURATION }) });

        this.rows = hash.migconfigs;
      } catch (e) {}
    }
  },

  data() {
    // const inStore = this.$store.getters['currentProduct'].inStore;

    return {
      rows:             [],
      schema:           null,
    };
  },

  computed: {
    hasSchema() {
      return !!this.schema;
    },

    rowsData() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const rows = this.$store.getters[`${ inStore }/all`](HCI.MIG_CONFIGURATION) || [];

      return rows;
    },

    headers() {
      const cols = [
        STATE,
        NAME,
        {
          name:  'address',
          label: 'Address',
          value: 'spec.gpuAddress',
          sort:  ['spec.gpuAddress']
        },
        {
          name:     'Profile Count',
          label:    'Profile Count',
          labelKey: 'harvester.tableHeaders.profileCount',
          value:    'spec.profileSpec.length',
          sort:     ['spec.profileSpec.length'],
          align:    'center'
        },
        {
          name:        'status',
          label:       'Status',
          labelKey:    'tableHeaders.status',
          sort:        ['status.status'],
          value:       'status.status',
        },
      ];

      return cols;
    },
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else-if="hasSchema">
    <Banner
      color="info"
      :label="t('harvester.migconfiguration.infoBanner')"
    />
    <ResourceTable
      v-bind="$attrs"
      :groupable="false"
      :namespaced="false"
      :headers="headers"
      :schema="schema"
      :rows="rowsData"
      key-field="_key"
    />
  </div>
</template>
