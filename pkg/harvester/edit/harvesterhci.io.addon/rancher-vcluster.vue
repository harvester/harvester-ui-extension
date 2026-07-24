<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import jsyaml from 'js-yaml';
import merge from 'lodash/merge';

const DEFAULT_VALUE = {
  hostname:          '',
  rancherVersion:    '',
  bootstrapPassword: '',
  global:            {
    hostname:          '',
    rancherVersion:    '',
    bootstrapPassword: '',
  },
};

// v0.19.0 stores values at the root. All later versions store them under "global".
function usesGlobalValuesFor(version) {
  return version !== 'v0.19.0';
}

function pruneToActiveLayout(values, usesGlobalValues) {
  const pruned = merge({}, values);

  if (usesGlobalValues) {
    delete pruned.hostname;
    delete pruned.rancherVersion;
    delete pruned.bootstrapPassword;
  } else {
    delete pruned.global;
  }

  return pruned;
}

export default {
  name:       'EditAddonVcluster',
  components: { LabeledInput, RadioGroup },

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
    valuesContentJson = pruneToActiveLayout(valuesContentJson, usesGlobalValuesFor(this.value.spec.version));

    return { valuesContentJson };
  },

  computed: {
    usesGlobalValues() {
      return usesGlobalValuesFor(this.value.spec.version);
    },

    hostname: {
      get() {
        return this.getValuesRoot().hostname;
      },
      set(value) {
        this.getValuesRoot().hostname = value;
      },
    },

    rancherVersion: {
      get() {
        return this.getValuesRoot().rancherVersion;
      },
      set(value) {
        this.getValuesRoot().rancherVersion = value;
      },
    },

    bootstrapPassword: {
      get() {
        return this.getValuesRoot().bootstrapPassword;
      },
      set(value) {
        this.getValuesRoot().bootstrapPassword = value;
      },
    },
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  methods: {
    getValuesRoot() {
      if (this.usesGlobalValues) {
        if (!this.valuesContentJson.global || typeof this.valuesContentJson.global !== 'object' || Array.isArray(this.valuesContentJson.global)) {
          this.valuesContentJson.global = merge({}, DEFAULT_VALUE.global);
        }

        return this.valuesContentJson.global;
      }

      return this.valuesContentJson;
    },

    willSave() {
      const errors = [];

      if (!this.value.spec.enabled) {
        return Promise.resolve();
      }

      if (!this.hostname) {
        errors.push(this.t('validation.required', { key: this.t('harvester.addons.rancherVcluster.hostname') }, true));
      }

      if (!this.bootstrapPassword) {
        errors.push(this.t('validation.required', { key: this.t('harvester.addons.rancherVcluster.password') }, true));
      }

      if (errors.length) {
        return Promise.reject(errors);
      }

      return Promise.resolve();
    },
  },

  watch: {
    valuesContentJson: {
      handler(neu) {
        this.value.spec.valuesContent = jsyaml.dump(pruneToActiveLayout(neu, this.usesGlobalValues));
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
          :options="[true, false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
        />
      </div>
    </div>

    <template v-if="value.spec.enabled">
      <div class="row mb-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="hostname"
            label-key="harvester.addons.rancherVcluster.hostname"
            :required="true"
            :mode="mode"
            placeholder="rancher.$vip.nip.io"
          />
        </div>

        <div class="col span-6">
          <LabeledInput
            v-model:value="rancherVersion"
            label-key="harvester.addons.rancherVcluster.rancherVersion"
            :required="true"
            :disabled="true"
          />
        </div>
      </div>

      <div class="row mt-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="bootstrapPassword"
            label-key="harvester.addons.rancherVcluster.password"
            :mode="mode"
            :required="true"
            type="password"
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
