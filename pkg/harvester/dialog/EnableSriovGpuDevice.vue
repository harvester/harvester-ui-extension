<script>
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import AsyncButton from '@shell/components/AsyncButton';
import { Checkbox } from '@components/Form/Checkbox';
import { escapeHtml } from '@shell/utils/string';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';

export default {
  name: 'HarvesterEnableSriovGpuDevice',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    Checkbox,
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return { skipMigConfiguration: this.resources[0]?.metadata?.annotations?.[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION] === 'true' };
  },

  computed: { ...mapGetters({ t: 'i18n/t' }) },

  methods: {
    close() {
      this.$emit('close');
    },

    async save(buttonCb) {
      const actionResource = this.resources[0];
      const prevEnabled = actionResource.spec.enabled;
      const prevAnnotation = actionResource.metadata.annotations?.[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION];

      try {
        if (this.skipMigConfiguration) {
          if (!actionResource.metadata.annotations) {
            actionResource.metadata.annotations = {};
          }
          actionResource.metadata.annotations[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION] = 'true';
        } else {
          if (actionResource.metadata.annotations) {
            delete actionResource.metadata.annotations[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION];
          }
        }

        actionResource.spec.enabled = true;
        await actionResource.save();
        buttonCb(true);
        this.close();
      } catch (err) {
        actionResource.spec.enabled = prevEnabled;
        if (prevAnnotation !== undefined) {
          actionResource.metadata.annotations[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION] = prevAnnotation;
        } else if (actionResource.metadata.annotations) {
          delete actionResource.metadata.annotations[HCI_ANNOTATIONS.SKIP_MIG_CONFIGURATION];
        }

        this.$store.dispatch('growl/fromError', {
          title: this.t('generic.notification.title.error', { name: escapeHtml(actionResource.metadata.name) }),
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
        v-clean-html="t('harvester.sriovgpu.enable.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <div class="body">
        <Checkbox
          v-model:value="skipMigConfiguration"
          :label="t('harvester.sriovgpu.enable.skipMigConfiguration')"
        />
        <p class="note mt-10">
          {{ t('harvester.sriovgpu.enable.note') }}
        </p>
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
          @click="save"
        />
      </div>
    </template>
  </Card>
</template>

<style lang="scss" scoped>
.actions {
  width: 100%;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.note {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
</style>
