<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { RadioGroup } from '@components/Form/Radio';
import { TextAreaAutoGrow } from '@components/Form/TextArea';
import { SECRET } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import FileSelector, { createOnSelected } from '@shell/components/form/FileSelector';

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
  },

  data() {
    let parseDefaultValue = {};

    try {
      const data = this.value.value || this.value.default || '{}';
      const parsed = JSON.parse(data);

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
      existingSecret:   null,
    };
  },

  async created() {
    await this.checkExistingSecret();
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  methods: {
    onKeySelected: createOnSelected('parseDefaultValue.kubeConfig'),

    update() {
      if (this.parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted) {
        this.value['value'] = JSON.stringify({ removeUpstreamClusterWhenNamespaceIsDeleted: true });
      } else {
        this.value['value'] = this.value.default || '{}';
      }
    },

    async checkExistingSecret() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      await this.$store.dispatch(`${ inStore }/findAll`, { type: SECRET });
      const secrets = this.$store.getters[`${ inStore }/all`](SECRET) || [];

      this.existingSecret = secrets.find((secret) => secret.metadata.name === 'rancher-cluster-config' &&
        secret.metadata.namespace === 'harvester-system'
      );

      // If the secret exists and has data, populate the kubeConfig
      if (this.existingSecret?.data?.kubeConfig) {
        const decodedContent = atob(this.existingSecret.data.kubeConfig);

        this.parseDefaultValue.kubeConfig = decodedContent;
        this.$nextTick(() => {
          this.update();
        });
      }
    },

    async createOrUpdateRancherKubeConfigSecret() {
      this.errors = [];
      // Check if kubeConfig is provided
      if (!this.parseDefaultValue.kubeConfig) {
        this.errors.push(this.t('validation.required', { key: this.t('harvester.setting.rancherCluster.kubeConfig') }, true));

        return Promise.reject(this.errors);
      }

      try {
        let secret;

        if (this.existingSecret) {
          secret = this.existingSecret;
          secret.setData('kubeConfig', this.parseDefaultValue.kubeConfig);
        } else {
          const inStore = this.$store.getters['currentProduct'].inStore;

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

        return Promise.resolve();
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);

        return Promise.reject(this.errors);
      }
    },

    async deleteRancherKubeConfigSecret() {
      if (this.existingSecret) {
        this.existingSecret.remove();
      }
    },

    async willSave() {
      // Only create or update secret if enabled
      if (this.parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted) {
        await this.createOrUpdateRancherKubeConfigSecret();
      } else {
        await this.deleteRancherKubeConfigSecret();
      }

      return Promise.resolve();
    },

    useDefault() {
      this.parseDefaultValue = {
        kubeConfig:                                  '',
        removeUpstreamClusterWhenNamespaceIsDeleted: false
      };
    }
  },

  watch: {
    'parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted'(val, oldVal) {
      if (val && !oldVal && this.existingSecret?.data?.kubeConfig) {
        // Populate kubeConfig with the existing secret value
        this.parseDefaultValue.kubeConfig = atob(this.existingSecret.data.kubeConfig);
      }
    }
  }
};
</script>

<template>
  <div>
    <div
      v-if="parseDefaultValue.removeUpstreamClusterWhenNamespaceIsDeleted"
      class="row mt-20"
    >
      <div class="col span-12">
        <FileSelector
          class="btn btn-sm bg-primary mb-10"
          :label="t('generic.readFromFile')"
          @selected="onKeySelected"
        />
        <TextAreaAutoGrow
          v-model:value="parseDefaultValue.kubeConfig"
          :min-height="254"
          @update:value="update"
        />
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
          @update:value="update"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(textarea) {
  overflow-y: auto !important;
}
</style>
