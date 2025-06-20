<script>
import { Banner } from '@components/Banner';
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';
import BadgeState from '@shell/components/formatter/BadgeStateFormatter';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { NAME, AGE, NAMESPACE, STATE } from '@shell/config/table-headers';
import { SCHEMA } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';
import { HCI as HCI_ANNOTATIONS } from '../config/labels-annotations';
import { HCI } from '../types';

// const schema = {
//   id:         HCI.VPC,
//   type:       SCHEMA,
//   attributes: {
//     kind:       HCI.VPC,
//     namespaced: true
//   },
//   metadata: { name: HCI.VPC },
// };

// export const NETWORK_HEADERS = [
//   NAME,
//   NAMESPACE,
//   {
//     name:     'type',
//     value:    'vlanType',
//     sort:     'spec.config',
//     labelKey: 'tableHeaders.networkType'
//   },
//   // {
//   //   name:     'vlan',
//   //   value:    'vlanId',
//   //   sort:     'spec.config',
//   //   labelKey: 'tableHeaders.networkVlan'
//   // },
//   // {
//   //   name:          'connectivity',
//   //   value:         'connectivity',
//   //   labelKey:      'tableHeaders.routeConnectivity',
//   //   formatter:     'BadgeStateFormatter',
//   //   formatterOpts: { arbitrary: true },
//   //   width:         130,
//   // },
//   AGE
// ];

export default {
  name:       'HarvesterVPC',
  components: {
    ResourceTable,
    Banner,
    Loading,
    BadgeState,
  },

  inheritAttrs: false,

  props: {
    schema: {
      type:     Object,
      required: true,
    }
  },

  async fetch() {
    const _hash = {};

    if(this.$store.getters[`harvester/schemaFor`](HCI.SUBNET)){
      _hash.rows = this.$store.dispatch(`harvester/findAll`, { type: HCI.SUBNET })
    }

    if (this.$store.getters[`harvester/schemaFor`](HCI.VPC)) {
      _hash.vpcs = this.$store.dispatch(`harvester/findAll`, { type: HCI.VPC });
    }

    const hash = await allHash(_hash);

    this.rows = hash.rows || [];
    this.vpcs = hash.vpcs || [];
  },

  data() {
    return {
      HCI, 
      rows:         [],
      vpcs :        [],
    };
  },

  computed: {
    headers() {
      return [
        STATE,
        NAME,
        NAMESPACE,
        AGE
      ];
    },

    rows() {
      return this.$store.getters[`harvester/all`](HCI.SUBNET) || [];
    },

    vpcWithoutSubnets() {
      const vpcs = this.$store.getters[`harvester/all`](HCI.VPC) || [];

      const out = vpcs.map((v) => {
        const hasChild = v.status.subnets.length > 0
        return {
          ...v,
          hasChild
        };
      });

      return out;
    },

    rowsWithFakeVpcs() {
      console.log('this.vpcWithoutSubnets=',this.vpcWithoutSubnets)
      const fakeRows = this.vpcWithoutSubnets.map((vpc) => {
        return {
          groupByLabel:          vpc.id,
          isFake:                true,
          mainRowKey:            vpc.id,
          nameDisplay:           vpc.id,
          groupByVpc:            vpc.id,
          availableActions:      []
        };
      });
      console.log("🚀 ~ fakeRows ~ fakeRows:", fakeRows)
      console.log("🚀 ~ rowsWithFakeVpcs :",[...this.rows, ...fakeRows])
      return [...this.rows, ...fakeRows];
    },

    createVPCLocation(){
      const location = {
        name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
        params: {
          product:  HARVESTER_PRODUCT,
          resource: HCI.VPC,
        },
      };

      return location;
    },

    vpcSchema() {
      return this.$store.getters[`harvester/schemaFor`](HCI.VPC);
    },

    subnetSchema(){
      return this.$store.getters[`harvester/schemaFor`](HCI.SUBNET);
    },
  },
  methods:{ 
    groupLabel(group) {
      console.log("🚀 ~ groupLabel ~ group:", group)
      const row = group.rows[0];
      console.log("🚀 ~ groupLabel ~ row:", row)

      if (row.isFake) {
        return `${ this.t('harvester.vpc.label') }: ${ row.nameDisplay }`;
      }

      return `${ this.t('harvester.vpc.label') }: ${ group.key }`;
    },

    slotName(vpc) {
      return `main-row:${ vpc }`;
    },
  },

  typeDisplay() {
    return this.t('harvester.vpc.label');
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <Masthead
      :schema="vpcSchema"
      :type-display="t('harvester.vpc.label')"
      :resource="HCI.VPC"
      :create-location="createVPCLocation"
      :create-button-label="t('harvester.clusterNetwork.create.button.label')"
    />
    <ResourceTable
      :rows="rowsWithFakeVpcs"
      :headers="headers"
      :schema="subnetSchema"
      :groupable="true"
      group-by="groupByVpc"
    >
      <template #header-middle>
        <div />
      </template>
      <template #group-by="{group}">
        <div class="group-bar">
          <div class="group-tab">
            <span>
              {{ groupLabel(group) }}
            </span>
          </div>
        </div>
      </template>
      <template
        v-for="(vpc, i) in vpcWithoutSubnets"
        v-slot:[slotName(vpc.id)]
      >
        <tr
          v-show="!vpc.hasChild"
          :key="vpc.id"
          class="main-row"
        >
          <td
            class="empty text-center"
            colspan="12"
          >
            {{ t('harvester.vpc.noChild') }}
          </td>
        </tr>
      </template>
    </ResourceTable>
  </div>
</template>

<style lang="scss" scoped>
.state {
  display: flex;
  justify-content: space-between;

  .icon-warning {
    margin-top: 2px;
  }
}
.group-bar {
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .right {
    margin-top: 5px;
    margin-bottom: 3px;
  }

  .group-tab {
    &, &::after {
        height: 50px;
    }

    &::after {
        right: -20px;
    }

    SPAN {
      color: var(--body-text) !important;
    }
  }
}
</style>
