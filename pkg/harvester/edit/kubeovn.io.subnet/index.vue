<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
// import LabeledSelect from '@shell/components/form/LabeledSelect';
import Tab from '@shell/components/Tabbed/Tab';
// import ArrayListSelect from '@shell/components/form/ArrayListSelect';
import Loading from '@shell/components/Loading';
// import { Banner } from '@components/Banner';
import CreateEditView from '@shell/mixins/create-edit-view';
// import { NODE } from '@shell/config/types';
import { _CREATE, _VIEW } from '@shell/config/query-params';
// import { isEmpty, throttle } from 'lodash';
import { set } from '@shell/utils/object';
// import { uniq, findBy } from '@shell/utils/array';
// import ArrayList from '@shell/components/form/ArrayList';
// import { allHash } from '@shell/utils/promise';
// import { HOSTNAME } from '@shell/config/labels-annotations';
// import { matching } from '@shell/utils/selector';
// import { HCI } from '../../types';
import ResourceTabs from '@shell/components/form/ResourceTabs/index';

// const createObject = {
//   apiVersion: 'harvesterhci.io/v1beta1',
//   kind:       'Vpc',
//   metadata:   { name: '', annotations: [] },
//   type:       HCI.VPC,
//   spec:       {
//     staticRoutes: [],
//     vpcPeerings:  [],
//   }
// };

export default {
  name: 'EditSubnet',

  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    Tab,
    ResourceTabs,
    Loading,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  data() {
    set(this.value, 'spec', this.value.spec || {
      staticRoutes: [],
      vpcPeerings:  [],
    });

    return {
      staticRoutes: [],
      // defaultStaticRoutes: {
      //   cidr:      '',
      //   nextHopIP: [],
      // },
    };
  },

  // async fetch() {
  //   const inStore = this.$store.getters['currentProduct'].inStore;

  //   const hash = {
  //     linkMonitors: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.LINK_MONITOR }),
  //     nodes:        this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
  //   };

  //   await allHash(hash);
  // },

  computed: {
    modeOverride() {
      return this.isCreate ? _CREATE : _VIEW;
    },
    // nodeOptions() {
    //   const inStore = this.$store.getters['currentProduct'].inStore;
    //   const nodes = this.$store.getters[`${ inStore }/all`](NODE);

    //   return nodes.filter((n) => n.isEtcd !== 'true').map((node) => {
    //     return {
    //       label: node.nameDisplay,
    //       value: node.id
    //     };
    //   });
    // },

    // mtu: {
    //   get() {
    //     return this.value?.spec?.uplink?.linkAttributes?.mtu;
    //   },

    //   set(value) {
    //     set(this.value, 'spec.uplink.linkAttributes.mtu', value);
    //   }
    // },

    // bondOptionMode: {
    //   get() {
    //     return this.value?.spec?.uplink?.bondOptions?.mode;
    //   },

    //   set(value) {
    //     set(this.value, 'spec.uplink.bondOptions.mode', value);
    //   },
    // },

    // miimon: {
    //   get() {
    //     return this.value?.spec?.uplink?.bondOptions?.miimon;
    //   },

    //   set(value) {
    //     set(this.value, 'spec.uplink.bondOptions.miimon', value);
    //   },
    // },

    // bondOptions() {
    //   return [
    //     'balance-rr',
    //     'active-backup',
    //     'balance-xor',
    //     'broadcast',
    //     '802.3ad',
    //     'balance-tlb',
    //     'balance-alb',
    //   ];
    // },

    // doneLocationOverride() {
    //   return this.value.doneOverride;
    // },

    // nics() {
    //   const inStore = this.$store.getters['currentProduct'].inStore;
    //   const linkMonitor = this.$store.getters[`${ inStore }/byId`](HCI.LINK_MONITOR, 'nic') || {};
    //   const linkStatus = linkMonitor?.status?.linkStatus || {};
    //   const nodes = this.nodes.map((n) => n.id);

    //   const out = [];

    //   // The node name in the Link monitor is not deleted after the nodes is deleted
    //   // So the UI needs to filter it first.
    //   Object.keys(linkStatus).map((nodeName) => {
    //     if (nodes.includes(nodeName)) {
    //       const nics = linkStatus[nodeName] || [];

    //       nics.map((nic) => {
    //         out.push({
    //           ...nic,
    //           nodeName,
    //         });
    //       });
    //     }
    //   });

    //   return out;
    // },

    // nicOptions() {
    //   const out = [];
    //   const map = {};

    //   (this.matchNICs || []).map((nic) => {
    //     if (nic.masterIndex && !this.originNics.includes(nic.name)) {
    //       set(map, `${ nic.name }.masterIndex`, true);
    //     } else if (!findBy(out, 'name', nic.name)) {
    //       out.push(nic);

    //       set(map, `${ nic.name }.total`, 1);
    //       set(map, `${ nic.name }.down`, nic.state === 'down' ? 1 : 0);
    //     } else if (findBy(out, 'name', nic.name)) {
    //       set(map, `${ nic.name }.total`, map[nic.name].total + 1);
    //       set(map, `${ nic.name }.down`, nic.state === 'down' ? map[nic.name].down + 1 : map[nic.name].down);
    //     }
    //   });

    //   return out.filter((o) => !map[o.name].masterIndex).map((o) => {
    //     let label = '';

    //     if (map[o.name].down === 0) {
    //       label = `${ o.name } (Up)`;
    //     } else if (map[o.name].total === 1) {
    //       label = `${ o.name } (Down)`;
    //     } else {
    //       label = `${ o.name } (${ map[o.name].down }/${ map[o.name].total } Down)`;
    //     }

    //     return {
    //       label,
    //       value:    o.name,
    //       disabled: map[o.name].down > 0,
    //     };
    //   });
    // },

    // nodes() {
    //   const inStore = this.$store.getters['currentProduct'].inStore;
    //   const nodes = this.$store.getters[`${ inStore }/all`](NODE);

    //   return nodes.filter((n) => n.isEtcd !== 'true');
    // },
  },

  watch: {
    value: {
      handler(neu) {
        // const parseDefaultValue = JSON.parse(neu.value);

        // this['parseDefaultValue'] = parseDefaultValue;
      },
      deep: true
    }
  },
};

</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :apply-hooks="applyHooks"
    :errors="errors"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />
    <ResourceTabs
      class="mt-15"
      :mode="mode"
      :side-tabs="true"
    >
      <Tab
        name="staticRoutes"
        :label="t('harvester.vpc.staticRoutes.label')"
        :weight="-1"
        class="bordered-table"
      >
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
.custom-headers {
    align-items: center;
}

</style>
