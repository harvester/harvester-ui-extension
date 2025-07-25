<script>
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';

import { allHash } from '@shell/utils/promise';
import { SCHEMA, STORAGE_CLASS } from '@shell/config/types';
import {
  STATE, AGE, NAME, STORAGE_CLASS_PROVISIONER, STORAGE_CLASS_DEFAULT
} from '@shell/config/table-headers';
import { HCI } from '../types';

const schema = {
  id:         HCI.STORAGE,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.STORAGE,
    namespaced: false
  },
  metadata: { name: HCI.STORAGE },
};

export default {
  name: 'ListHarvesterStorages',

  components: {
    ResourceTable,
    Loading,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({ storages: this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }) });

    const storageSchema = this.$store.getters[`${ inStore }/schemaFor`](STORAGE_CLASS);

    if ( storageSchema && !storageSchema?.collectionMethods.find((x) => ['blocked-post', 'post'].includes(x.toLowerCase())) ) {
      this.$store.dispatch('type-map/configureType', { match: HCI.STORAGE, isCreatable: false });
    }
  },

  data() {
    return { schema };
  },

  computed: {
    rows() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      const storages = this.$store.getters[`${ inStore }/all`](STORAGE_CLASS);

      return storages.filter((s) => !s.parameters?.backingImage);
    },

    headers() {
      return [
        STATE,
        NAME,
        STORAGE_CLASS_PROVISIONER,
        STORAGE_CLASS_DEFAULT,
        {
          name:     'numberOfReplicas',
          labelKey: 'harvester.storage.numberOfReplicas.label',
          value:    'parameters.numberOfReplicas',
          sort:     ['parameters.numberOfReplicas'],
          align:    'center'
        },
        AGE,
      ];
    },
  },

  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](schema, 99);
  },
};
</script>

<template>
  <div>
    <Loading v-if="$fetchState.pending" />
    <ResourceTable
      :rows="rows"
      :schema="schema"
      :headers="headers"
    >
      <template #cell:name="{ row }">
        <td>
          <div>
            <router-link
              v-if="row?.detailLocation"
              :to="row.detailLocation"
            >
              {{ row.nameDisplay }}
              <i
                v-if="row.isInternalStorageClass && typeof row.isInternalStorageClass === 'function' ? row.isInternalStorageClass() : false"
                v-clean-tooltip="t('harvester.storage.internal.cannotDeleteOrDefaultTooltip')"
                class="icon icon-info text-info"
                style="margin-left: 0.4em;"
              />
            </router-link>
            <span v-else>
              {{ row.nameDisplay }}
              <i
                v-if="row.isInternalStorageClass && typeof row.isInternalStorageClass === 'function' ? row.isInternalStorageClass() : false"
                v-clean-tooltip="t('harvester.storage.internal.cannotDeleteOrDefaultTooltip')"
                class="icon icon-info text-info"
                style="margin-left: 0.4em;"
              />
            </span>
          </div>
        </td>
      </template>
    </ResourceTable>
  </div>
</template>
