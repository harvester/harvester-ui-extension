<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';
import { Card } from '@components/Card';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import AppModal from '@shell/components/AppModal';
import { useI18n } from '@shell/composables/useI18n';
import { VOLUME_MODE, ACCESS_MODE } from '../../config/types';

const VOLUME_MODE_OPTIONS = [VOLUME_MODE.FILE_SYSTEM, VOLUME_MODE.BLOCK];
const ACCESS_MODE_OPTIONS = [ACCESS_MODE.READ_WRITE_ONCE, ACCESS_MODE.READ_WRITE_MANY, ACCESS_MODE.READ_ONLY_MANY];

const props = defineProps({
  storageClassName:     { type: String, default: '' },
  providerName:         { type: String, default: '' },
  showInherited:        { type: Boolean, default: false },
  volumeMode:           { type: String, default: VOLUME_MODE.FILE_SYSTEM },
  accessModes:          { type: Array, default: () => [ACCESS_MODE.READ_WRITE_MANY] },
  inheritedVolumeMode:  { type: String, default: VOLUME_MODE.FILE_SYSTEM },
  inheritedAccessModes: { type: Array, default: () => [ACCESS_MODE.READ_WRITE_MANY] },
});

const emit = defineEmits(['apply', 'close']);

const store = useStore();
const { t } = useI18n(store);

const localVolumeMode = ref(props.volumeMode || VOLUME_MODE.FILE_SYSTEM);
const localAccessMode = ref(props.accessModes?.[0] || ACCESS_MODE.READ_WRITE_MANY);

const volumeModeOptions = VOLUME_MODE_OPTIONS.map((value) => ({ label: value, value }));
const accessModeOptions = ACCESS_MODE_OPTIONS.map((value) => ({ label: value, value }));

const apply = () => {
  emit('apply', {
    volumeMode:  localVolumeMode.value,
    accessModes: [localAccessMode.value],
  });
  emit('close');
};

// Repopulate the dropdowns with the provider default values; the user then applies.
const reset = () => {
  localVolumeMode.value = props.inheritedVolumeMode || VOLUME_MODE.FILE_SYSTEM;
  localAccessMode.value = props.inheritedAccessModes?.[0] || ACCESS_MODE.READ_WRITE_MANY;
};

const cancel = () => {
  emit('close');
};
</script>

<template>
  <app-modal
    class="storage-defaults-modal"
    name="storageDefaultsDialog"
    :width="620"
    height="auto"
    :click-to-close="false"
    @close="cancel"
  >
    <Card
      class="storage-defaults-card"
      :show-highlight-border="false"
    >
      <template #title>
        <h4 class="text-default-text">
          {{ t('harvester.addons.vmMigration.storageDefaults.title', { name: storageClassName }) }}
        </h4>
      </template>

      <template #body>
        <p class="text-deemphasized description">
          <template v-if="showInherited">
            {{ t('harvester.addons.vmMigration.storageDefaults.descriptionInherited', { name: storageClassName, provider: providerName }) }}
          </template>
          <template v-else>
            {{ t('harvester.addons.vmMigration.storageDefaults.description', { name: storageClassName }) }}
          </template>
        </p>

        <div class="settings-box">
          <LabeledSelect
            v-model:value="localVolumeMode"
            class="volume-mode"
            :label="t('harvester.addons.vmMigration.storageDefaults.volumeMode')"
            :options="volumeModeOptions"
            :searchable="false"
            :clearable="false"
          />

          <LabeledSelect
            v-model:value="localAccessMode"
            class="access-mode"
            :label="t('harvester.addons.vmMigration.storageDefaults.accessMode')"
            :options="accessModeOptions"
            :searchable="false"
            :clearable="false"
          />
        </div>
      </template>

      <template #actions>
        <div class="buttons">
          <button
            class="btn role-secondary"
            @click="cancel"
          >
            {{ t('harvester.addons.vmMigration.storageDefaults.cancel') }}
          </button>
          <div class="right-buttons">
            <button
              v-if="showInherited"
              class="btn role-secondary mr-10"
              @click="reset"
            >
              {{ t('harvester.addons.vmMigration.storageDefaults.resetToProviderDefault') }}
            </button>
            <button
              class="btn role-primary"
              :disabled="!localAccessMode"
              @click="apply"
            >
              {{ showInherited ? t('harvester.addons.vmMigration.storageDefaults.applyOverride') : t('harvester.addons.vmMigration.storageDefaults.apply') }}
            </button>
          </div>
        </div>
      </template>
    </Card>
  </app-modal>
</template>

<style lang="scss" scoped>
  .storage-defaults-modal {
    z-index: 45;
  }

  .storage-defaults-card {
    margin: 0;
    padding: 20px;
  }

  .description {
    margin-bottom: 16px;
    line-height: 20px;
  }

  .settings-box {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
    border-radius: 6px;
    background-color: var(--category-active);
  }

  .volume-mode {
    max-width: 280px;
  }

  .access-mode {
    max-width: 280px;
  }

  .buttons {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .right-buttons {
      display: flex;
    }
  }
</style>
