<script>
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';
import {
  PV, PVC, SCHEMA, LONGHORN, STORAGE_CLASS
} from '@shell/config/types';
import { STATE, AGE, NAME, NAMESPACE } from '@shell/config/table-headers';
import HarvesterVolumeState from '../formatters/HarvesterVolumeState';
import { allSettled } from '../utils/promise';
import { HCI, VOLUME_SNAPSHOT } from '../types';
import { INTERNAL_STORAGE_CLASS } from '../config/types';

const schema = {
  id:         HCI.VOLUME,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.VOLUME,
    namespaced: true
  },
  metadata: { name: HCI.VOLUME },
};

export default {
  name:       'HarvesterListVolume',
  components: {
    Loading, ResourceTable, HarvesterVolumeState
  },

  inheritAttrs: false,

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const _hash = {
      pvcs: this.$store.dispatch(`${ inStore }/findAll`, { type: PVC }),
      pvs:  this.$store.dispatch(`${ inStore }/findAll`, { type: PV }),
      vms:  this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VM }),
      scs:  this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }),
    };

    const volumeSnapshotSchema = this.$store.getters[`${ inStore }/schemaFor`](VOLUME_SNAPSHOT);

    if (volumeSnapshotSchema) {
      _hash.snapshots = this.$store.dispatch(`${ inStore }/findAll`, { type: VOLUME_SNAPSHOT });
    }

    if (this.$store.getters[`${ inStore }/schemaFor`](LONGHORN.VOLUMES)) {
      _hash.longhornVolumes = this.$store.dispatch(`${ inStore }/findAll`, { type: LONGHORN.VOLUMES });
    }

    if (this.$store.getters[`${ inStore }/schemaFor`](LONGHORN.ENGINES)) {
      _hash.longhornEngines = this.$store.dispatch(`${ inStore }/findAll`, { type: LONGHORN.ENGINES });
    }

    const hash = await allSettled(_hash);

    const pvcSchema = this.$store.getters[`${ inStore }/schemaFor`](PVC);

    if (!pvcSchema?.collectionMethods.find((x) => x.toLowerCase() === 'post')) {
      this.$store.dispatch('type-map/configureType', { match: HCI.VOLUME, isCreatable: false });
    }
    this.rows = hash.pvcs;
  },

  data() {
    return { rows: [] };
  },

  computed: {
    schema() {
      return schema;
    },
    filterRows() {
      // we only show the non golden image PVCs in the list
      return this.rows.filter((pvc) => !pvc?.isGoldenImageVolume);
    },
    headers() {
      return [
        STATE,
        NAME,
        NAMESPACE,
        {
          name:          'size',
          labelKey:      'tableHeaders.size',
          value:         'spec.resources.requests.storage',
          sort:          'volumeSort',
          formatter:     'Si',
          formatterOpts: {
            opts: {
              increment: 1024, addSuffix: true, maxExponent: 3, minExponent: 3, suffix: 'i',
            },
            needParseSi: true
          },
        },
        {
          name:     'storageClass',
          labelKey: 'tableHeaders.storageClass',
          value:    'spec.storageClassName',
          sort:     'spec.storageClassName'
        },
        {
          name:     'AttachedVM',
          labelKey: 'tableHeaders.attachedVM',
          type:     'attached',
          value:    'spec.claimRef',
          sort:     'name',
        },
        {
          name:      'VolumeSnapshotCounts',
          labelKey:  'harvester.tableHeaders.volumeSnapshotCounts',
          value:     'relatedVolumeSnapshotCounts',
          formatter: 'RelatedVolumeSnapshotCounts',
          sort:      'name',
          align:     'center',
        },
        {
          ...STATE,
          name:          'phase',
          labelKey:      'tableHeaders.phase',
          formatterOpts: { arbitrary: true },
          value:         'phaseState',
        },
        AGE,
      ];
    },
  },

  methods: {
    goTo(row) {
      return row?.attachVM?.detailLocation;
    },

    getVMName(row) {
      return row.attachVM?.metadata?.name || '';
    },

    isInternalStorageClass(storageClassName) {
      return this.$store.getters['type-map/labelFor'](INTERNAL_STORAGE_CLASS, storageClassName);
    }
  },

  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](schema, 99);
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <ResourceTable
    v-else
    v-bind="$attrs"
    :headers="headers"
    :groupable="true"
    default-sort-by="age"
    :namespaced="true"
    :rows="filterRows"
    :schema="schema"
    key-field="_key"
  >
    <template #cell:state="{row}">
      <div class="state">
        <HarvesterVolumeState
          class="vmstate"
          :row="row"
        />
      </div>
    </template>
    <template #cell:AttachedVM="{row}">
      <div>
        <router-link
          v-if="getVMName(row)"
          :to="goTo(row)"
        >
          {{ getVMName(row) }}
        </router-link>
      </div>
    </template>
    <template #col:name="{ row }">
      <td>
        <span>
          <router-link
            v-if="row?.detailLocation"
            :to="row.detailLocation"
          >
            {{ row.nameDisplay }}
            <i
              v-if="row.isEncrypted"
              class="icon icon-lock"
            />
          </router-link>
          <span v-else>
            {{ row.nameDisplay }}
          </span>
        </span>
      </td>
    </template>
  </ResourceTable>
</template>

<style lang="scss" scoped>
.state {
  display: flex;

  .vmstate {
    margin-right: 6px;
  }
}
</style>
