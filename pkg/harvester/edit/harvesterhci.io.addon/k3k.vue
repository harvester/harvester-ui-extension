<script>
import merge from 'lodash/merge';
import jsyaml from 'js-yaml';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';

const DEFAULT_VALUE = {
  certManagerVersion: 'v1.20.2',
  rancher:            {
    hostname:          '',
    version:           '',
    bootstrapPassword: '',
  },
  k3kCluster: {
    servers:          1,
    version:          'v1.35.4-k3s1',
    storageClassName: 'harvester-longhorn',
  },
};

export default {
  name:       'EditAddonK3k',
  components: { LabeledInput, RadioGroup },

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },

    mode: {
      type:     String,
      required: true
    },
    registerBeforeHook: {
      type:     Function,
      required: true,
    },
  },

  data() {
    let valuesContentJson = {};

    try {
      valuesContentJson = merge({}, DEFAULT_VALUE, jsyaml.load(this.value.spec.valuesContent));
    } catch (err) {
      valuesContentJson = merge({}, DEFAULT_VALUE);

      this.$store.dispatch('growl/fromError', {
        title: this.$store.getters['i18n/t']('generic.notification.title.error'),
        err:   err.data || err,
      }, { root: true });
    }

    return { valuesContentJson };
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  methods: {
    willSave() {
      const errors = [];

      if (!this.value.spec.enabled) {
        return Promise.resolve();
      }

      if (!this.valuesContentJson.rancher.hostname) {
        errors.push(this.t('validation.required', { key: this.t('harvester.addons.rancherK3k.hostname') }, true));
      }

      if (!this.valuesContentJson.rancher.version) {
        errors.push(this.t('validation.required', { key: this.t('harvester.addons.rancherK3k.version') }, true));
      }

      if (!this.valuesContentJson.rancher.bootstrapPassword) {
        errors.push(this.t('validation.required', { key: this.t('harvester.addons.rancherK3k.password') }, true));
      }

      if (errors.length > 0) {
        return Promise.reject(errors);
      } else {
        return Promise.resolve();
      }
    },
  },

  watch: {
    valuesContentJson: {
      handler(neu) {
        this.value.spec['valuesContent'] = jsyaml.dump(neu);
      },
      deep:      true,
      immediate: true
    },
  },
};
</script>

<template>
  <div>
    <div class="row">
      <div class="col span-12">
        <RadioGroup
          v-model:value="value.spec.enabled"
          class="mb-20"
          name="model"
          :mode="mode"
          :options="[true,false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
        />
      </div>
    </div>

    <template v-if="value.spec.enabled">
      <div class="row mb-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="valuesContentJson.rancher.hostname"
            label-key="harvester.addons.rancherK3k.hostname"
            :required="true"
            :mode="mode"
            placeholder="rancher.$vip.nip.io"
          />
        </div>

        <div class="col span-6">
          <LabeledInput
            v-model:value="valuesContentJson.rancher.version"
            label-key="harvester.addons.rancherK3k.version"
            :required="true"
            :mode="mode"
            placeholder="v1.14.0"
          />
        </div>
      </div>

      <div class="row mt-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="valuesContentJson.rancher.bootstrapPassword"
            label-key="harvester.addons.rancherK3k.password"
            :mode="mode"
            :required="true"
            type="password"
            :tooltip="t('harvester.addons.rancherK3k.passwordTooltip')"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
  :deep() .radio-group {
    display: flex;
    .radio-container {
      margin-right: 30px;
    }
  }
</style>
