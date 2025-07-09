<script>
import Loading from '@shell/components/Loading';
import ResourceTable from '@shell/components/ResourceTable';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../config/harvester';
import { NAME, AGE, NAMESPACE, STATE } from '@shell/config/table-headers';
import { HCI } from '../types';
import { VPC } from '../config/query-params';
import { ADD_ONS } from '../config/harvester-map';
import { allHash } from '@shell/utils/promise';
import MessageLink from '@shell/components/MessageLink';
import Banner from '@components/Banner/Banner.vue';

export default {
  name: 'HarvesterVPC',

  components: {
    ResourceTable,
    Loading,
    MessageLink,
    Banner
  },

  inheritAttrs: false,

  props: {
    schema: {
      type:     Object,
      required: true,
    }
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = await allHash({ addons: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS }) });

    this.enabledKubeOvnAddon = hash.addons.find((addon) => addon.name === ADD_ONS.KUBEOVN_OPERATOR)?.spec?.enabled === true;

    if (this.enabledKubeOvnAddon) {
      try {
        await allHash({
          rows: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
          vpcs: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
        });
        this.$store.dispatch('type-map/configureType', { match: HCI.SUBNET, isCreatable: this.enabledKubeOvnAddon });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching VPC and Subnet data:', e);
      }
    }
  },

  data() {
    return {
      HCI,
      hasBothSchema:       false,
      enabledKubeOvnAddon: false,
      to:                  `${ HCI.ADD_ONS }/kube-system/${ ADD_ONS.KUBEOVN_OPERATOR }?mode=edit`
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
        const hasChild = v.status?.subnets?.length > 0 || false;

        return {
          ...v,
          hasChild
        };
      });

      return out;
    },

    isSubnetCreatable() {
      return (this.subnetSchema?.collectionMethods || []).includes('POST');
    },

    rowsWithFakeVpcs() {
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

      return [...this.rows, ...fakeRows];
    },

    createVPCLocation() {
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

    subnetSchema() {
      return this.$store.getters[`harvester/schemaFor`](HCI.SUBNET);
    },
  },
  methods: {
    groupLabel(group) {
      return `${ this.t('harvester.vpc.label') }: ${ group.key }`;
    },

    slotName(vpc) {
      return `main-row:${ vpc }`;
    },

    createSubnetLocation(group) {
      const vpc = group.key;

      const location = {
        name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-create`,
        params: {
          product:  HARVESTER_PRODUCT,
          resource: HCI.SUBNET,
        },
      };

      location.query = { [VPC]: vpc };

      return location;
    },

    showVpcAction(event, group) {
      const vpc = group.key;

      const resource = this.$store.getters[`harvester/byId`](HCI.VPC, vpc);

      this.$store.commit(`action-menu/show`, {
        resources: [resource],
        elem:      event.target
      });
    },
  },

  typeDisplay() {
    return this.t('harvester.vpc.label');
  }
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else-if="!enabledKubeOvnAddon">
    <Banner color="warning">
      <MessageLink
        :to="to"
        prefix-label="harvester.vpc.noAddonEnabled.prefix"
        middle-label="harvester.vpc.noAddonEnabled.middle"
        suffix-label="harvester.vpc.noAddonEnabled.suffix"
      />
    </Banner>
  </div>
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
          <div class="right">
            <router-link
              v-if="isSubnetCreatable"
              class="btn btn-sm role-secondary mr-5"
              :to="createSubnetLocation(group)"
            >
              {{ t('harvester.vpc.createSubnet') }}
            </router-link>
            <button
              type="button"
              class="btn btn-sm role-multi-action actions mr-10"
              @click="showVpcAction($event, group)"
            >
              <i class="icon icon-actions" />
            </button>
          </div>
        </div>
      </template>
      <template
        v-for="(vpc) in vpcWithoutSubnets"
        :key="vpc.id"
        v-slot:[slotName(vpc.id)]
      >
        <tr
          v-show="!vpc.hasChild"
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
