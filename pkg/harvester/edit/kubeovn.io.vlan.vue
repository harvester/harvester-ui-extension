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
      vlanId:   this.value?.spec?.id || '',
      provider: this.value?.spec?.provider || '',
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({ providerNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.PROVIDER_NETWORK }) });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    providerNetworks() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const providerNetworks = this.$store.getters[`${ inStore }/all`](HCI.PROVIDER_NETWORK) || [];

      return providerNetworks.map((pn) => ({
        label: pn.id,
        value: pn.id,
      }));
    },
  },

  methods: {
    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      if (this.vlanId !== '') {
        this.value.spec.id = Number(this.vlanId);
      }

      this.value.spec.provider = this.provider;
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
        :label="t('generic.basic')"
        :weight="99"
      >
        <div class="mt-20">
          <div class="row">
            <div class="col span-12">
              <LabeledInput
                v-model:value.number="vlanId"
                class="mb-20"
                type="number"
                :min="1"
                :max="4094"
                :label="t('harvester.vlan.id.label')"
                :placeholder="t('harvester.vlan.id.placeholder')"
                :mode="mode"
                required
              />
            </div>
          </div>
          <div class="row">
            <div class="col span-12">
              <LabeledSelect
                v-model:value="provider"
                class="mb-20"
                :options="providerNetworks"
                :mode="mode"
                :label="t('harvester.vlan.provider.label')"
                :placeholder="t('harvester.vlan.provider.placeholder')"
                required
              />
            </div>
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
