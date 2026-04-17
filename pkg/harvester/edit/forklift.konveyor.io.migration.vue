<script>
import CruResource from '@shell/components/CruResource';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import { HCI } from '../types';
import { mapGetters } from 'vuex';

export default {
  name: 'EditForkliftMigration',

  emits: ['update:value'],

  components: {
    CruResource,
    LabeledSelect,
    NameNsDescription,
  },

  mixins: [CreateEditView, FormValidation],

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

    this.allPlans = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PLAN });
  },

  data() {
    if (!this.value.spec) {
      this.value.spec = { plan: {} };
    }

    return {
      allPlans: [],

      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    planOptions() {
      return this.allPlans.map((p) => ({
        label: p.metadata.name,
        value: p.metadata.name,
      }));
    },

    fvExtraRules() {
      return { nameRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined };
    },

    isFormValid() {
      return this.fvFormIsValid && !!this.value.spec.plan?.name;
    }
  },

  methods: {
    updatePlan(val) {
      const plan = this.allPlans.find((p) => p.metadata.name === val);

      this.value.spec.plan = {
        name:      val,
        namespace: plan?.metadata?.namespace || this.value.metadata.namespace || 'default',
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

    <div class="row mb-20 mt-20">
      <div class="col span-6">
        <LabeledSelect
          :value="value.spec.plan.name"
          :options="planOptions"
          :label="t('harvester.addons.forklift.fields.plan')"
          :mode="mode"
          required
          @update:value="updatePlan"
        />
      </div>
    </div>
  </CruResource>
</template>
