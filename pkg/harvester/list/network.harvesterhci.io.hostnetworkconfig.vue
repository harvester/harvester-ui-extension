<script>
import ResourceTable from '@shell/components/ResourceTable';
import Loading from '@shell/components/Loading';
import { STATE, NAME as NAME_COL, AGE } from '@shell/config/table-headers';
import { HCI } from '../types';

const UNDERLAY = {
  name:      'underlay',
  labelKey:  'harvester.tableHeaders.hostNetworkConfig.underlay',
  tooltip:   'harvester.tableHeaders.hostNetworkConfig.underlayTooltip',
  value:     'spec.underlay',
  sort:      'spec.underlay',
  formatter: 'HarvesterBoolean',
};

const VLAN_ID = {
  name:     'vlanID',
  labelKey: 'harvester.tableHeaders.hostNetworkConfig.vlanID',
  value:    'spec.vlanID',
  sort:     'spec.vlanID',
};

const MODE = {
  name:      'mode',
  labelKey:  'harvester.tableHeaders.hostNetworkConfig.mode',
  value:     'spec.mode',
  sort:      'spec.mode',
  formatter: 'HarvesterHostNetworkConfigMode',
};

const CLUSTER_NETWORK = {
  name:     'clusterNetwork',
  labelKey: 'harvester.tableHeaders.hostNetworkConfig.clusterNetwork',
  value:    'spec.clusterNetwork',
  sort:     'spec.clusterNetwork',
  align:    'center',
};

export default {
  name:       'HarvesterListHostNetworkConfig',
  components: { ResourceTable, Loading },

  inheritAttrs: false,

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.rows = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.HOST_NETWORK_CONFIG });
  },

  data() {
    return { rows: [] };
  },

  computed: {
    schema() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/schemaFor`](HCI.HOST_NETWORK_CONFIG);
    },
    headers() {
      return [
        STATE,
        NAME_COL,
        UNDERLAY,
        VLAN_ID,
        MODE,
        CLUSTER_NETWORK,
        AGE,
      ];
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <ResourceTable
    v-else
    v-bind="$attrs"
    :headers="headers"
    :rows="rows"
    :schema="schema"
    key-field="_key"
  />
</template>
