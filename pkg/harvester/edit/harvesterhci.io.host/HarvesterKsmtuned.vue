<script>
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import UnitInput from '@shell/components/form/UnitInput';
import { RadioGroup } from '@components/Form/Radio';
import { Checkbox } from '@components/Form/Checkbox';
import { HCI } from '../../types';
import { DOC } from '../../config/doc-links';
import { docLink } from '../../utils/feature-flags';

export const ksmtunedMode = [{
  value: 'standard',
  label: 'Standard'
}, {
  value: 'high',
  label: 'High-Perfomanace'
}, {
  value: 'customized',
  label: 'Customized'
}];

export const ksmtunedRunOption = [{
  label: 'Run',
  value: 'run'
}, {
  label: 'Stop',
  value: 'stop'
}, {
  label: 'Prune',
  value: 'prune'
}];

export default {
  name:       'HarvesterKsmtuned',
  components: {
    Checkbox, LabeledInput, LabeledSelect, RadioGroup, UnitInput
  },

  props: {
    mode: {
      type:     String,
      required: true
    },

    node: {
      type:     Object,
      required: true,
    },

    registerBeforeHook: {
      type:     Function,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.KSTUNED });

    this.ksmtuned = hash.find((node) => {
      return node.id === this.node.id;
    });

    this.enableMergeAcrossNodes = !!this.ksmtuned.spec?.mergeAcrossNodes;
    this.spec = this.ksmtuned.spec;
  },

  data() {
    return {
      ksmtuned:               {},
      spec:                   {},
      thresCoef:              30,
      ksmtunedMode,
      ksmtunedRunOption,
      enableMergeAcrossNodes: true
    };
  },

  created() {
    this.registerBeforeHook(this.saveKsmtuned, 'saveKsmtuned');
  },

  computed: {
    isCustomizedMode() {
      return this.spec.mode === 'customized';
    },

    showKsmt() {
      return this.spec.run === 'run';
    },

    ksmtunedLink() {
      const version = this.$rootGetters['harvester-common/getServerVersion']();

      return docLink(DOC.KSMTUNED_MODE, version);
    }
  },

  methods: {
    async saveKsmtuned() {
      this.spec.mergeAcrossNodes = this.enableMergeAcrossNodes ? 1 : 0;
      this.ksmtuned['spec'] = this.spec;

      await this.ksmtuned.save().catch((reason) => {
        if (reason?.type === 'error') {
          this.$store.dispatch('growl/error', {
            title:   this.t('harvester.notification.title.error'),
            message: reason?.message
          }, { root: true });

          return Promise.reject(new Error('saveKsmtuned error'));
        }
      });
    },
  }
};
</script>

<template>
  <div>
    <LabeledSelect
      v-model:value="spec.run"
      :label="t('harvester.host.ksmtuned.run')"
      :options="ksmtunedRunOption"
      class="mb-20"
      :mode="mode"
      required
    />

    <template v-if="showKsmt">
      <UnitInput
        v-model:value.number="spec.thresCoef"
        :label="t('harvester.host.ksmtuned.thresCoef')"
        suffix="%"
        :delay="0"
        required
        :mode="mode"
        class="mb-20"
      />

      <Checkbox
        v-model:value="enableMergeAcrossNodes"
        :mode="mode"
        class="check mb-20"
        type="checkbox"
        :label="t('harvester.host.ksmtuned.enableMergeNodes')"
      />

      <h3>
        <t
          k="harvester.host.ksmtuned.modeLink"
          :raw="true"
          :url="ksmtunedLink"
        />
      </h3>
      <RadioGroup
        v-model:value="spec.mode"
        class="mb-20"
        :name="t('harvester.host.ksmtuned.mode')"
        :options="ksmtunedMode"
      />

      <template v-if="isCustomizedMode">
        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value.number="spec.ksmtunedParameters.boost"
              required
              type="number"
              :label="t('harvester.host.ksmtuned.parameters.boost')"
              :tooltip="t('harvester.host.ksmtuned.parameters.description.boost')"
              class="mb-20"
              :mode="mode"
            />
          </div>

          <div class="col span-6">
            <LabeledInput
              v-model:value.number="spec.ksmtunedParameters.decay"
              required
              type="number"
              :label="t('harvester.host.ksmtuned.parameters.decay')"
              :tooltip="t('harvester.host.ksmtuned.parameters.description.decay')"
              class="mb-20"
              :mode="mode"
            />
          </div>
        </div>

        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value.number="spec.ksmtunedParameters.minPages"
              required
              type="number"
              :label="t('harvester.host.ksmtuned.parameters.minPages')"
              :tooltip="t('harvester.host.ksmtuned.parameters.description.minPages')"
              class="mb-20"
              :mode="mode"
            />
          </div>

          <div class="col span-6">
            <LabeledInput
              v-model:value.number="spec.ksmtunedParameters.maxPages"
              required
              type="number"
              :label="t('harvester.host.ksmtuned.parameters.maxPages')"
              :tooltip="t('harvester.host.ksmtuned.parameters.description.maxPages')"
              class="mb-20"
              :mode="mode"
            />
          </div>
        </div>

        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value.number="spec.ksmtunedParameters.sleepMsec"
              required
              type="number"
              :label="t('harvester.host.ksmtuned.parameters.sleepMsec')"
              :tooltip="t('harvester.host.ksmtuned.parameters.description.sleepMsec')"
              class="mb-20"
              :mode="mode"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
