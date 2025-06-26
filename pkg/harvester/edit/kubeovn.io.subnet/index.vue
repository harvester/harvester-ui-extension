<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import Tab from '@shell/components/Tabbed/Tab';
import { NETWORK_ATTACHMENT } from '@shell/config/types';
import Loading from '@shell/components/Loading';
import CreateEditView from '@shell/mixins/create-edit-view';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import Checkbox from '@components/Form/Checkbox/Checkbox';
import { RadioGroup } from '@components/Form/Radio';
import { NETWORK_PROTOCOL } from '@pkg/harvester/config/types';
import { set } from '@shell/utils/object';
import ArrayList from '@shell/components/form/ArrayList';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../../types';
import ResourceTabs from '@shell/components/form/ResourceTabs/index';

export default {
  name: 'EditSubnet',

  emits: ['update:value'],

  components: {
    CruResource,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    Tab,
    RadioGroup,
    Checkbox,
    ArrayList,
    ResourceTabs,
    Loading,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  data() {
    // console.log('this.value = ', this.value);
    // set(this.value, 'spec', this.value.spec || {
    //   cidrBlock: '',
    //   protocol:  NETWORK_PROTOCOL.IPv4,
    //   provider:  '',
    //   vpc:       this.$route.query.vpc || '',
    //   gatewayIP:  '',
    //   excludeIps: [],
    //   private:    false
    // });

    return {
      // defaultAddValue: '',
      // vpc: ,
    };
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.validate);
    }

    const vpc = this.$route.query.vpc || '';

     set(this.value, 'spec', this.value.spec || {
      cidrBlock: '',
      protocol:  NETWORK_PROTOCOL.IPv4,
      provider:  '',
      vpc,
      gatewayIP:  '',
      excludeIps: [],
      private:    false
    });
  },
  
  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = {
      vpc: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
      nad: this.$store.dispatch(`${ inStore }/findAll`, { type: NETWORK_ATTACHMENT }),
    };

    await allHash(hash);
  },

  computed: {
    doneLocationOverride() {
      return this.value.doneOverride;
    },
    
    tooltip() {
     this.t('harvester.subnet.private.tooltip', null, true);
    },

    protocolOptions(){
      return Object.values(NETWORK_PROTOCOL);
    },
    provider:{
      get() {
        const raw = this.value.spec.provider;
        if (!raw) {
          return '';
        }
        const ns = raw.split('.')[0] || '';
        const vmNet = raw.split('.')[1] || '';
        return `${ns}/${vmNet}`; 
      },
      set(value) {
        const ns = value.split('/')[0] || '';
        const vmNet = value.split('/')[1] || '';
        const provider = `${vmNet}.${ns}.ovn`;
        set(this.value, 'spec.provider', provider);
      }
    },

    providerOptions(){
      console.log('this.value = ', this.value);
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vmNets = this.$store.getters[`${ inStore }/all`](NETWORK_ATTACHMENT) || []
      return vmNets.map((n) => ({
        label: n.id,
        value: n.id,
      }));;
    },

    vpcOptions(){
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];
      return vpcs.map((n) => ({
        label: n.id,
        value: n.id,
      }));
    }
  },

  watch: {
    value: {
      handler(neu) {
        console.log("🚀 ~ handler ~ neu:", neu.spec)
      },
      deep: true
    }
  },
  methods:{

    validate(){
      console.log('call validate')
      const errors = [];
    }
  }
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
        name="Basic"
        :label="t('generic.basic')"
        :weight="-1"
        class="bordered-table"
      >
        <div class="row mt-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.cidrBlock"
              class="mb-20"
              required
              :placeholder="t('harvester.subnet.cidrBlock.placeholder')"
              :label="t('harvester.subnet.cidrBlock.label')"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.protocol"
              :label="t('harvester.subnet.protocols.label')"
              :options="protocolOptions"
              required
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-10">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="provider"
              :label="t('harvester.subnet.provider.label')"
              :options="providerOptions"
              required
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.vpc"
              :label="t('harvester.subnet.vpc.label')"
              :options="vpcOptions"
              required
              :disabled="true"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.gateway"
              class="mb-20"
              :placeholder="t('harvester.subnet.gateway.placeholder')"
              :label="t('harvester.subnet.gateway.label')"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <RadioGroup
              v-model:value="value.spec.private"
              name="enabled"
              :options="[true, false]"
              :label="t('harvester.subnet.private.label')"
              :labels="[t('generic.enabled'), t('generic.disabled')]"
              :mode="mode"
              tooltip-key="harvester.subnet.private.tooltip"
            />
          </div>
        </div>
        <ArrayList
          v-model:value="value.spec.excludeIps"
          :show-header="true"
          class="mt-20"
          :mode="mode"
          :add-label="t('harvester.setting.storageNetwork.exclude.addIp')"
        >
          <template #column-headers>
            <div class="box">
              <h3 class="key">
                {{ t('harvester.setting.storageNetwork.exclude.label') }}
              </h3>
            </div>
          </template>
          <template #columns="scope">
            <div class="key">
              <input
                v-model="scope.row.value"
                :placeholder="t('harvester.setting.storageNetwork.exclude.placeholder')"
              />
            </div>
          </template>
        </ArrayList>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
.custom-headers {
  align-items: center;
}

</style>
