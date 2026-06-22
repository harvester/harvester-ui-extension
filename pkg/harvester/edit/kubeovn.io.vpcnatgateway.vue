<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import ArrayListSelect from '@shell/components/form/ArrayListSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../types';

export default {
  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    LabeledInput,
    LabeledSelect,
    ArrayListSelect,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    }
  },

  data() {
    return {
      vpc:             this.value?.spec?.vpc || '',
      subnet:          this.value?.spec?.subnet || '',
      lanIP:           this.value?.spec?.lanIp || '',
      externalSubnets: this.value?.spec?.externalSubnets || [],
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      vpcs:    this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
      subnets: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
    });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    vpcOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];

      return vpcs.map((vpc) => ({
        label: vpc.id,
        value: vpc.id,
      }));
    },

    subnetOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const subnets = this.$store.getters[`${ inStore }/all`](HCI.SUBNET) || [];

      return subnets.map((subnet) => ({
        label: subnet.id,
        value: subnet.id,
      }));
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      this.value.spec.vpc = this.vpc;
      this.value.spec.subnet = this.subnet;
      this.value.spec.lanIP = this.lanIP;
      this.value.spec.externalSubnets = (this.externalSubnets || []).filter((subnet) => !!subnet);
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />

    <div class="mt-20">
      <div class="row">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="vpc"
            class="mb-20"
            :options="vpcOptions"
            :mode="mode"
            :label="t('harvester.natGateway.vpc.label')"
            :placeholder="t('harvester.natGateway.vpc.placeholder')"
            required
          />
        </div>
      </div>
      <div class="row">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="subnet"
            class="mb-20"
            :options="subnetOptions"
            :mode="mode"
            :label="t('harvester.natGateway.subnet.label')"
            :placeholder="t('harvester.natGateway.subnet.placeholder')"
            required
          />
        </div>
      </div>
      <div class="row">
        <div class="col span-12">
          <LabeledInput
            v-model:value="lanIP"
            class="mb-20"
            :mode="mode"
            :label="t('harvester.natGateway.lanIP.label')"
            :placeholder="t('harvester.natGateway.lanIP.placeholder')"
            required
          />
        </div>
      </div>
      <div class="row">
        <div class="col span-12">
          <ArrayListSelect
            v-model:value="externalSubnets"
            :mode="mode"
            :options="subnetOptions"
            :enable-default-add-value="false"
            :array-list-props="{
              addLabel: t('harvester.natGateway.externalSubnets.addLabel'),
              initialEmptyRow: true,
              title: t('harvester.natGateway.externalSubnets.label'),
              required: false,
              protip: false,
            }"
            :select-props="{
              placeholder: t('harvester.natGateway.externalSubnets.placeholder'),
            }"
          />
        </div>
      </div>
    </div>
  </CruResource>
</template>
