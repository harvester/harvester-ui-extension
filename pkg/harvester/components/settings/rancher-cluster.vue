<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { RadioGroup } from '@components/Form/Radio';
import { TextAreaAutoGrow } from '@components/Form/TextArea';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { SECRET } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import FileSelector, { createOnSelected } from '@shell/components/form/FileSelector';

export default {
  name: 'HarvesterRancherCluster',

  components: {
    RadioGroup,
    TextAreaAutoGrow,
    Banner,
    AsyncButton,
    FileSelector
  },

  mixins: [CreateEditView],

  data() {
    let parseDefaultValue = {};

    try {
      const parsed = JSON.parse(this.value.value || this.value.default || '{}');

      // Initialize with both fields, but only removeUpstreamClusterWhenNamespaceIsDeleted will be saved
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
      existingSecret:   null
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

      // Force refresh secrets from the store
      await this.$store.dispatch(`${ inStore }/findAll`, { type: SECRET });

      const secrets = this.$store.getters[`${ inStore }/all`](SECRET) || [];

      this.existingSecret = secrets.find((secret) => secret.metadata.name === 'rancher-cluster-config' &&
        secret.metadata.namespace === 'harvester-system'
      );

      // Load existing kubeconfig content if secret exists
      if (this.existingSecret && this.existingSecret.data && this.existingSecret.data.kubeConfig) {
        // Decode base64 content
        const decodedContent = atob(this.existingSecret.data.kubeConfig);

        this.parseDefaultValue.kubeConfig = decodedContent;

        // Trigger update to make it behave like pasted content
        this.$nextTick(() => {
          this.update();
        });
      }
    },

    async createOrUpdateRancherKubeConfigSecret(buttonCb) {
      this.errors = [];
      this.isCreatingSecret = true;

      if (!this.parseDefaultValue.kubeConfig) {
        this.errors.push(this.t('validation.required', { key: this.t('harvester.setting.rancherCluster.kubeConfig') }, true));
        buttonCb(false);
        this.isCreatingSecret = false;

        return;
      }

      try {
        const inStore = this.$store.getters['currentProduct'].inStore;

        let secret;
        const isUpdate = !!this.existingSecret;

        if (this.existingSecret) {
          // Update existing secret
          secret = this.existingSecret;
          secret.setData('kubeConfig', this.parseDefaultValue.kubeConfig);
        } else {
          // Create new secret
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

        // Refresh the secret list and update the existing secret reference
        await this.checkExistingSecret();

        const message = isUpdate ? this.t('harvester.setting.rancherCluster.secretUpdated') : this.t('harvester.setting.rancherCluster.secretCreated');

        this.$store.dispatch('growl/success', { message }, { root: true });

        buttonCb(true);
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        buttonCb(false);
      } finally {
        this.isCreatingSecret = false;
      }
    }
  },

  watch: {
    value: {
      handler(neu) {
        const parsed = JSON.parse(neu.value || neu.default || '{}');

        // Keep kubeConfig field for UI, but only save removeUpstreamClusterWhenNamespaceIsDeleted
        this['parseDefaultValue'] = {
          kubeConfig:                                  this.parseDefaultValue?.kubeConfig || '',
          removeUpstreamClusterWhenNamespaceIsDeleted: parsed.removeUpstreamClusterWhenNamespaceIsDeleted || false
        };
      },
      deep: true
    }
  }
};
</script>

<template>
  <div>
    <Banner color="info">
      {{ t('harvester.setting.rancherCluster.description') }}
    </Banner>

    <div class="row mt-20">
      <div class="col span-12">
        <FileSelector
          class="btn btn-sm bg-primary mb-10"
          :label="t('generic.readFromFile')"
          @selected="onKeySelected"
        />

        <div>
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
          @update:value="update"
        />
      </div>
    </div>

    <div class="row mt-20">
      <div class="col span-12">
        <div
          v-if="existingSecret"
          class="mb-10"
        >
          <Banner color="success">
            {{ t('harvester.setting.rancherCluster.secretExists') }}
          </Banner>
        </div>
        <AsyncButton
          :action-label="existingSecret ? t('harvester.setting.rancherCluster.updateSecret') : t('harvester.setting.rancherCluster.createSecret')"
          :waiting-label="existingSecret ? t('harvester.setting.rancherCluster.updatingSecret') : t('harvester.setting.rancherCluster.creatingSecret')"
          :success-label="existingSecret ? t('harvester.setting.rancherCluster.secretUpdated') : t('harvester.setting.rancherCluster.secretCreated')"
          :error-label="t('harvester.setting.rancherCluster.secretCreationFailed')"
          :loading="isCreatingSecret"
          :disabled="!hasKubeConfig"
          @click="createOrUpdateRancherKubeConfigSecret"
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
