<script>
import merge from 'lodash/merge';
import jsyaml from 'js-yaml';
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton';
import { escapeHtml } from '@shell/utils/string';

const DEFAULT_VALUE = {
  rancher: {
    hostname:          '',
    version:           '',
    bootstrapPassword: '',
  },
};

export default {
  name: 'HarvesterEnableK3k',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    LabeledInput,
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    const addon = this.resources[0];
    let valuesContentJson;

    try {
      valuesContentJson = merge({}, DEFAULT_VALUE, jsyaml.load(addon.spec.valuesContent));
    } catch (e) {
      valuesContentJson = merge({}, DEFAULT_VALUE);
    }

    return { valuesContentJson };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    buttonDisabled() {
      const { rancher } = this.valuesContentJson;

      return !(rancher?.hostname || '').trim() || !(rancher?.version || '').trim() || !(rancher?.bootstrapPassword || '').trim();
    }
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async enable(buttonCb) {
      const addon = this.resources[0];

      try {
        addon.spec.valuesContent = jsyaml.dump(this.valuesContentJson);
        addon.spec.enabled = true;
        await addon.save();
        buttonCb(true);
        this.close();
      } catch (err) {
        addon.spec.enabled = false;
        this.$store.dispatch('growl/fromError', {
          title: this.t('generic.notification.title.error', { name: escapeHtml(addon.metadata.name) }),
          err,
        }, { root: true });
        buttonCb(false);
      }
    }
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      <h4
        v-clean-html="t('harvester.addons.rancherK3k.enable.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <div class="body">
        <div class="row mb-15">
          <div class="col span-6">
            <LabeledInput
              v-model:value="valuesContentJson.rancher.hostname"
              :required="true"
              :label="t('harvester.addons.rancherK3k.hostname')"
              placeholder="rancher.$vip.nip.io"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="valuesContentJson.rancher.version"
              :required="true"
              :label="t('harvester.addons.rancherK3k.version')"
              placeholder="v1.14.0"
            />
          </div>
        </div>
        <div class="row mb-15">
          <div class="col span-12">
            <LabeledInput
              v-model:value="valuesContentJson.rancher.bootstrapPassword"
              :required="true"
              type="password"
              :label="t('harvester.addons.rancherK3k.password')"
              :tooltip="t('harvester.addons.rancherK3k.passwordTooltip')"
            />
          </div>
        </div>
      </div>
    </template>

    <template #actions>
      <div class="buttons actions">
        <button
          class="btn role-secondary mr-10"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>

        <AsyncButton
          mode="enable"
          :disabled="buttonDisabled"
          @click="enable"
        />
      </div>
    </template>
  </Card>
</template>

<style lang="scss" scoped>
.body {
  display: flex;
  flex-direction: column;
  min-width: 400px;
}

.actions {
  width: 100%;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
