<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../types';

export default {
  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    ResourceTabs,
    Tab,
    LabeledInput,
    LabeledSelect,
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
      eip:            this.value?.spec?.eip || '',
      externalPort:   this.value?.spec?.externalPort || '',
      internalIp:     this.value?.spec?.internalIp || '',
      internalPort:   this.value?.spec?.internalPort || '',
      protocol:       this.value?.spec?.protocol || '',
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({ eips: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IPTABLES_EIP }) });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    eipOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const eips = this.$store.getters[`${ inStore }/all`](HCI.IPTABLES_EIP) || [];

      return eips.map((eip) => ({
        label: eip.id,
        value: eip.id,
      }));
    },

    protocolOptions() {
      return [
        { label: 'TCP', value: 'tcp' },
        { label: 'UDP', value: 'udp' },
      ];
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      this.value.spec.eip = this.eip;
      this.value.spec.externalPort = this.externalPort;
      this.value.spec.internalIp = this.internalIp;
      this.value.spec.internalPort = this.internalPort;
      this.value.spec.protocol = this.protocol;
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

    <ResourceTabs
      class="mt-15"
      :need-conditions="false"
      :need-related="false"
      :need-events="false"
      :side-tabs="true"
      :mode="mode"
    >
      <Tab
        name="basic"
        label="Basic"
        :weight="99"
      >
        <div class="mt-20">
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="eip"
                class="mb-20"
                :options="eipOptions"
                :mode="mode"
                :label="t('harvester.dnat.eip.label')"
                :placeholder="t('harvester.dnat.eip.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value="externalPort"
                class="mb-20"
                :mode="mode"
                :label="t('harvester.dnat.externalPort.label')"
                :placeholder="t('harvester.dnat.externalPort.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value="internalIp"
                class="mb-20"
                :mode="mode"
                :label="t('harvester.dnat.internalIp.label')"
                :placeholder="t('harvester.dnat.internalIp.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value="internalPort"
                class="mb-20"
                :mode="mode"
                :label="t('harvester.dnat.internalPort.label')"
                :placeholder="t('harvester.dnat.internalPort.placeholder')"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="protocol"
                class="mb-20"
                :options="protocolOptions"
                :mode="mode"
                :label="t('harvester.dnat.protocol.label')"
                :placeholder="t('harvester.dnat.protocol.placeholder')"
                required
              />
            </div>
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
