<script>
import ResourceTable from '@shell/components/ResourceTable';
import Loading from '@shell/components/Loading';
import { SCHEMA } from '@shell/config/types';
import { HCI } from '../types';

const schema = {
  id:         HCI.VMIMPORT,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.VMIMPORT,
    namespaced: true
  },
  metadata: { name: HCI.VMIMPORT },
};

export default {
  name:         'HarvesterVMImportVirtualMachine',
  components:   { ResourceTable, Loading },
  inheritAttrs: false,

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.rows = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VMIMPORT });

    const configSchema = this.$store.getters[`${ inStore }/schemaFor`](HCI.VMIMPORT);

    if (!configSchema?.collectionMethods.find((x) => x.toLowerCase() === 'post')) {
      this.$store.dispatch('type-map/configureType', { match: HCI.VMIMPORT, isCreatable: false });
    }
  },

  data() {
    return { rows: [] };
  },

  computed: {
    schema() {
      return schema;
    }
  },

  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](schema, 99);
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <ResourceTable
    v-else
    v-bind="$attrs"
    :groupable="true"
    :schema="schema"
    :rows="rows"
    key-field="_key"
  />
</template>
