<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import ForkliftProvider from '../mixins/forklift-provider';
import { HCI } from '../types';
import { STORAGE_CLASS } from '@shell/config/types';
import { mapGetters } from 'vuex';

export default {
  name: 'EditForkliftStorageMap',

  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
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

    try {
      this.allStorageClasses = await this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS });
    } catch {
      this.allStorageClasses = [];
    }
  },

  data() {
    if (!this.value.spec) {
      this.value.spec = {
        map:      [{ source: { id: '' }, destination: { storageClass: '' } }],
        provider: {
          source:      {},
          destination: {},
        },
      };
    }

    return {
      allStorageClasses: [],

      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    storageClassOptions() {
      return this.allStorageClasses.map((sc) => ({
        label: sc.metadata.name,
        value: sc.metadata.name,
      }));
    },

    fvExtraRules() {
      return { nameRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined };
    },

    isFormValid() {
      return this.fvFormIsValid &&
        !!this.value.spec.provider?.source?.name &&
        !!this.value.spec.provider?.destination?.name;
    }
  },

  methods: {
    addMapping() {
      this.value.spec.map.push({ source: { id: '' }, destination: { storageClass: '' } });
    },

    removeMapping(idx) {
      this.value.spec.map.splice(idx, 1);
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
        :weight="3"
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
        :label="t('harvester.addons.forklift.titles.storageMappings')"
        :weight="2"
      >
        <div
          v-for="(entry, idx) in value.spec.map"
          :key="idx"
          class="row mb-20"
        >
          <div class="col span-5">
            <LabeledInput
              v-model:value="entry.source.id"
              :label="t('harvester.addons.forklift.fields.sourceDatastoreId')"
              :placeholder="t('harvester.addons.forklift.placeholders.sourceDatastoreId')"
              :mode="mode"
            />
          </div>
          <div class="col span-5">
            <LabeledSelect
              v-model:value="entry.destination.storageClass"
              :options="storageClassOptions"
              :label="t('harvester.addons.forklift.fields.destStorageClass')"
              :mode="mode"
            />
          </div>
          <div class="col span-2">
            <button
              type="button"
              class="btn role-link"
              :disabled="value.spec.map.length <= 1"
              @click="removeMapping(idx)"
            >
              {{ t('harvester.addons.forklift.actions.remove') }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="btn role-tertiary"
          @click="addMapping"
        >
          {{ t('harvester.addons.forklift.actions.addMapping') }}
        </button>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
