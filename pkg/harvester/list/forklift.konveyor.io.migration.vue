<script>
import ResourceTable from '@shell/components/ResourceTable';
import Loading from '@shell/components/Loading';
import { SCHEMA } from '@shell/config/types';
import { HCI } from '../types';

const schema = {
  id:         HCI.FORKLIFT_MIGRATION,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_MIGRATION,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_MIGRATION },
};

export default {
  name:         'HarvesterForkliftMigration',
  components:   { ResourceTable, Loading },
  inheritAttrs: false,

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.rows = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_MIGRATION });

    const configSchema = this.$store.getters[`${ inStore }/schemaFor`](HCI.FORKLIFT_MIGRATION);

    if (!configSchema?.collectionMethods.find((x) => x.toLowerCase() === 'post')) {
      this.$store.dispatch('type-map/configureType', { match: HCI.FORKLIFT_MIGRATION, isCreatable: false });
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
