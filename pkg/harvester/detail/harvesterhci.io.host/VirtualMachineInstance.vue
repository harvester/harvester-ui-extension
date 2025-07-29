<script>
import { STATE, AGE, NAME } from '@shell/config/table-headers';
import SortableTable from '@shell/components/SortableTable';
import Loading from '@shell/components/Loading';
import { allHash } from '@shell/utils/promise';
import { HOSTNAME } from '@shell/config/labels-annotations';
import HarvesterVmState from '../../formatters/HarvesterVmState';
import { HCI } from '../../types';

export default {
  name: 'InstanceNode',

  components: {
    SortableTable,
    Loading,
    HarvesterVmState,
  },

  props: {
    node: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    await allHash({
      vms:               this.$store.dispatch('harvester/findAll', { type: HCI.VM }),
      vmis:              this.$store.dispatch('harvester/findAll', { type: HCI.VMI }),
      allClusterNetwork: this.$store.dispatch('harvester/findAll', { type: HCI.CLUSTER_NETWORK }),
    });
  },

  computed: {
    allClusterNetwork() {
      return this.$store.getters['harvester/all'](HCI.CLUSTER_NETWORK);
    },

    rows() {
      const vms = this.$store.getters['harvester/all'](HCI.VM);

      return vms.filter((vm) => vm.vmi?.status?.nodeName === this.node?.metadata?.labels?.[HOSTNAME]);
    },

    headers() {
      return [
        STATE,
        NAME,
        {
          name:        'CPU',
          label:       'CPU',
          sort:        ['displayCPU'],
          value:       'displayCPU',
          align:       'center',
          dashIfEmpty: true,
        },
        {
          name:          'Memory',
          value:         'displayMemory',
          sort:          ['memorySort'],
          align:         'center',
          labelKey:      'tableHeaders.memory',
          formatter:     'Si',
          formatterOpts: {
            opts: {
              increment: 1024, addSuffix: true, maxExponent: 3, minExponent: 3, suffix: 'i',
            },
            needParseSi: true
          },
        },
        {
          name:      'ip',
          label:     'IP Address',
          labelKey:  'harvester.tableHeaders.vm.ipAddress',
          value:     'id',
          formatter: 'HarvesterIpAddress'
        },
        {
          ...AGE,
          sort: 'metadata.creationTimestamp:desc',
        }
      ];
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div
    v-else
    id="host-instances"
    class="row"
  >
    <div class="col span-12">
      <SortableTable
        v-bind="$attrs"
        :headers="headers"
        default-sort-by="age"
        :rows="rows"
        key-field="_key"
      >
        <template
          #cell:state="scope"
          class="state-col"
        >
          <div class="state">
            <HarvesterVmState
              class="vmstate"
              :row="scope.row"
              :all-cluster-network="allClusterNetwork"
            />
          </div>
        </template>
      </Sortabletable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
#host-instances {
  :deep() thead th {
    vertical-align: middle;
  }

  :deep() .state {
    display: flex;

    .vmstate {
      margin-right: 6px;
    }
  }
}
</style>
