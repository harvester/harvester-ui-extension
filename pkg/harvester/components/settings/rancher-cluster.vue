<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { RadioGroup } from '@components/Form/Radio';
import { TextAreaAutoGrow } from '@components/Form/TextArea';
import { SECRET } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import FileSelector, { createOnSelected } from '@shell/components/form/FileSelector';
import { deleteSecretWithCSRF } from '@/pkg/harvester/utils/promise.js';

export default {
  name: 'HarvesterRancherCluster',

  components: {
    RadioGroup,
    TextAreaAutoGrow,
    FileSelector
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:    Object,
      default: () => ({}),
    },
    registerBeforeHook: {
      type:     Function,
      required: false,
      default:  () => {},
    },
    mode: {
      type:    String,
      default: 'edit',
    },
  },

  data() {
    let parseDefaultValue = {};
    const radioDisabled = false;

    try {
      const parsed = JSON.parse(this.value.value || this.value.default || '{}');

      parseDefaultValue = {
        kubeConfig:                                  '',
        removeUpstreamClusterWhenNamespaceIsDeleted: parsed.removeUpstreamClusterWhenNamespaceIsDeleted || false
      };
    } catch (error) {
      parseDefaultValue = {
        kubeConfig:                                  '',
        removeUpstreamClusterWhenNamespaceIsDeleted: false
      };
    }

    return {
      parseDefaultValue,
      errors:           [],
      isCreatingSecret: false,
      existingSecret:   null,
      radioDisabled
    };
  },

  computed: {
    hasKubeConfig() {
      return !!this.parseDefaultValue.kubeConfig;
    }
  },

  async created() {
    this.update();
    await this.checkExistingSecret();
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  methods: {
    onKeySelected: createOnSelected('parseDefaultValue.kubeConfig'),

    update() {
      // Only save the removeUpstreamClusterWhenNamespaceIsDeleted setting
      // kubeConfig is handled separately via secret creation
      const settingValue = { removeUpstreamClusterWhenNamespaceIsDeleted: this.parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted };
      const value = JSON.stringify(settingValue);

      this.value['value'] = value;
    },

    async checkExistingSecret() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      await this.$store.dispatch(`${ inStore }/findAll`, { type: SECRET });
      const secrets = this.$store.getters[`${ inStore }/all`](SECRET) || [];

      this.existingSecret = secrets.find((secret) => secret.metadata.name === 'rancher-cluster-config' &&
        secret.metadata.namespace === 'harvester-system'
      );
      if (this.existingSecret && this.existingSecret.data && this.existingSecret.data.kubeConfig) {
        const decodedContent = atob(this.existingSecret.data.kubeConfig);

        this.parseDefaultValue.kubeConfig = decodedContent;
        this.$nextTick(() => {
          this.update();
        });
      }
    },

    async createOrUpdateRancherKubeConfigSecret() {
      this.errors = [];
      this.isCreatingSecret = true;
      if (!this.parseDefaultValue.kubeConfig) {
        this.errors.push(this.t('validation.required', { key: this.t('harvester.setting.rancherCluster.kubeConfig') }, true));
        this.isCreatingSecret = false;

        return Promise.reject(this.errors);
      }
      try {
        const inStore = this.$store.getters['currentProduct'].inStore;
        let secret;
        const isUpdate = !!this.existingSecret;

        if (this.existingSecret) {
          secret = this.existingSecret;
          secret.setData('kubeConfig', this.parseDefaultValue.kubeConfig);
        } else {
          secret = await this.$store.dispatch(`${ inStore }/create`, {
            apiVersion: 'v1',
            kind:       'Secret',
            metadata:   {
              name:      'rancher-cluster-config',
              namespace: 'harvester-system'
            },
            type: 'secret',
            data: { kubeConfig: btoa(this.parseDefaultValue.kubeConfig) }
          });
        }
        await secret.save();
        await this.checkExistingSecret();
        this.$store.dispatch('growl/success', { message: isUpdate ? this.t('harvester.setting.rancherCluster.secretUpdated') : this.t('harvester.setting.rancherCluster.secretCreated') }, { root: true });
        this.isCreatingSecret = false;

        return Promise.resolve();
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        this.isCreatingSecret = false;

        return Promise.reject(this.errors);
      }
    },

    async deleteRancherKubeConfigSecret() {
      await deleteSecretWithCSRF('/v1/harvester/secrets/harvester-system/rancher-cluster-config');
      this.clearKubeConfigState();
    },

    async willSave() {
      // Only send secret API if enabled
      if (this.parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted) {
        await this.createOrUpdateRancherKubeConfigSecret();
      } else {
        await this.deleteRancherKubeConfigSecret();
      }
      this.update();

      return Promise.resolve();
    },

    clearKubeConfigState() {
      this.parseDefaultValue.kubeConfig = '';
      this.existingSecret = null;
    },

    useDefault() {
      let defaultVal = false;

      try {
        const parsed = JSON.parse(this.value.default || '{}');

        defaultVal = parsed.removeUpstreamClusterWhenNamespaceIsDeleted || false;
      } catch (e) {
        defaultVal = false;
      }
      this.parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted = defaultVal;
      this.clearKubeConfigState();
      this.update();
    }
  },

  watch: {
    value: {
      handler(neu) {
        const parsed = JSON.parse(neu.value || neu.default || '{}');

        this['parseDefaultValue'] = {
          kubeConfig:                                  this.parseDefaultValue?.kubeConfig || '',
          removeUpstreamClusterWhenNamespaceIsDeleted: parsed.removeUpstreamClusterWhenNamespaceIsDeleted || false
        };
      },
      deep: true
    },
    'parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted'(val, oldVal) {
      if (val && !oldVal && this.existingSecret && this.existingSecret.data && this.existingSecret.data.kubeConfig) {
        // Populate kubeConfig with the existing secret value
        this.parseDefaultValue.kubeConfig = atob(this.existingSecret.data.kubeConfig);
      }
    }
  }
};
</script>

<template>
  <div>
    <div class="row mt-20">
      <div class="col span-12">
        <FileSelector
          v-if="parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted"
          class="btn btn-sm bg-primary mb-10"
          :label="t('generic.readFromFile')"
          @selected="onKeySelected"
        />
        <div v-if="parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted">
          <TextAreaAutoGrow
            v-model:value="parseDefaultValue.kubeConfig"
            :min-height="254"
            @update:value="update"
          />
        </div>
      </div>
    </div>

    <div class="row mt-20">
      <div class="col span-12">
        <RadioGroup
          v-model:value="parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted"
          :label="t('harvester.setting.rancherCluster.removeUpstreamClusterWhenNamespaceIsDeleted')"
          name="removeUpstreamClusterWhenNamespaceIsDeleted"
          :options="[true, false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
          :disabled="radioDisabled"
          @update:value="update"
        />
      </div>
    </div>

    <div
      v-if="errors.length"
      class="error mt-10"
    >
      <div
        v-for="error in errors"
        :key="error"
      >
        {{ error }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.error {
  color: #d9534f;
  margin-top: 5px;
}

:deep(textarea) {
  overflow-y: auto !important;
}
</style>
