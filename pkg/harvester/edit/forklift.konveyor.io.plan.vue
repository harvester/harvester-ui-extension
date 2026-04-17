<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { Checkbox } from '@components/Form/Checkbox';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import ForkliftProvider from '../mixins/forklift-provider';
import { HCI } from '../types';
import { FORKLIFT_API_VERSION } from '../config/harvester-map';
import { mapGetters } from 'vuex';

export default {
  name: 'EditForkliftPlan',

  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    Checkbox,
  },

  mixins: [CreateEditView, FormValidation, ForkliftProvider],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
    mode: {
      type:     String,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.allProviders = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });
    this.allNetworkMaps = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP });
    this.allStorageMaps = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP });
  },

  data() {
    if (!this.value.spec) {
      this.value.spec = {
        map: {
          network: {},
          storage: {},
        },
        provider: {
          source:      {},
          destination: {},
        },
        targetNamespace:    'default',
        migrateSharedDisks: true,
        vms:                [{ id: '', name: '' }],
      };
    }

    if (!this.value.metadata.annotations) {
      this.value.metadata.annotations = {};
    }
    this.value.metadata.annotations.populatorLabels = 'True';

    return {
      allProviders:   [],
      allNetworkMaps: [],
      allStorageMaps: [],

      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
        { path: 'spec.targetNamespace', rules: ['targetNsRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    providerOptions() {
      return this.allProviders.map((p) => ({
        label: `${ p.metadata.name } (${ p.spec?.type || 'unknown' })`,
        value: p.metadata.name,
      }));
    },

    networkMapOptions() {
      return this.allNetworkMaps.map((m) => ({
        label: m.metadata.name,
        value: m.metadata.name,
      }));
    },

    storageMapOptions() {
      return this.allStorageMaps.map((m) => ({
        label: m.metadata.name,
        value: m.metadata.name,
      }));
    },

    fvExtraRules() {
      return {
        nameRequired:     (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined,
        targetNsRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.addons.forklift.fields.targetNamespace') }) : undefined,
      };
    },

    isFormValid() {
      return this.fvFormIsValid &&
        !!this.value.spec.provider?.source?.name &&
        !!this.value.spec.provider?.destination?.name;
    }
  },

  methods: {
    addVm() {
      this.value.spec.vms.push({ id: '', name: '' });
    },

    removeVm(idx) {
      this.value.spec.vms.splice(idx, 1);
    },

    updateNetworkMap(val) {
      this.value.spec.map.network = {
        apiVersion: FORKLIFT_API_VERSION,
        kind:       'NetworkMap',
        name:       val,
        namespace:  this.value.metadata.namespace || 'default',
      };
    },

    updateStorageMap(val) {
      this.value.spec.map.storage = {
        apiVersion: FORKLIFT_API_VERSION,
        kind:       'StorageMap',
        name:       val,
        namespace:  this.value.metadata.namespace || 'default',
      };
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
    :validation-passed="isFormValid"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :rules="{ name: fvGetAndReportPathRules('metadata.name') }"
      @update:value="$emit('update:value', $event)"
    />

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="providers"
        :label="t('harvester.addons.forklift.titles.providers')"
        :weight="4"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              :value="value.spec.provider.source.name"
              :options="providerOptions"
              :label="t('harvester.addons.forklift.fields.sourceProvider')"
              :mode="mode"
              required
              @update:value="updateSourceProvider"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              :value="value.spec.provider.destination.name"
              :options="providerOptions"
              :label="t('harvester.addons.forklift.fields.destProvider')"
              :mode="mode"
              required
              @update:value="updateDestProvider"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="mappings"
        :label="t('harvester.addons.forklift.titles.mappings')"
        :weight="3"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              :value="value.spec.map.network.name"
              :options="networkMapOptions"
              :label="t('harvester.addons.forklift.fields.networkMap')"
              :mode="mode"
              required
              @update:value="updateNetworkMap"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              :value="value.spec.map.storage.name"
              :options="storageMapOptions"
              :label="t('harvester.addons.forklift.fields.storageMap')"
              :mode="mode"
              required
              @update:value="updateStorageMap"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="vms"
        :label="t('harvester.addons.forklift.titles.vms')"
        :weight="2"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.targetNamespace"
              :label="t('harvester.addons.forklift.fields.targetNamespace')"
              :mode="mode"
              :rules="fvGetAndReportPathRules('spec.targetNamespace')"
              required
            />
          </div>
          <div class="col span-6">
            <Checkbox
              v-model:value="value.spec.migrateSharedDisks"
              :label="t('harvester.addons.forklift.fields.migrateSharedDisks')"
              :mode="mode"
            />
          </div>
        </div>

        <div
          v-for="(vm, idx) in value.spec.vms"
          :key="idx"
          class="row mb-20"
        >
          <div class="col span-5">
            <LabeledInput
              v-model:value="vm.id"
              :label="t('harvester.addons.forklift.fields.vmId')"
              :placeholder="t('harvester.addons.forklift.placeholders.vmId')"
              :mode="mode"
            />
          </div>
          <div class="col span-5">
            <LabeledInput
              v-model:value="vm.name"
              :label="t('harvester.addons.forklift.fields.vmName')"
              :placeholder="t('harvester.addons.forklift.placeholders.vmName')"
              :mode="mode"
            />
          </div>
          <div class="col span-2">
            <button
              type="button"
              class="btn role-link"
              :disabled="value.spec.vms.length <= 1"
              @click="removeVm(idx)"
            >
              {{ t('harvester.addons.forklift.actions.remove') }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="btn role-tertiary"
          @click="addVm"
        >
          {{ t('harvester.addons.forklift.actions.addVm') }}
        </button>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
