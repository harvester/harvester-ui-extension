<script>
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LVM_DRIVER } from '../models/harvester/storage.k8s.io.storageclass';
import { isInternalStorageClass } from '../utils/storage-class';

export function getUpgradeRepositoryStorageClassDefault(storageClasses) {
  return storageClasses.find((storageClass) => storageClass.isDefault &&
    !storageClass.parameters?.backingImage &&
    storageClass.provisioner !== LVM_DRIVER &&
    !isInternalStorageClass(storageClass.name))?.name || '';
}

export default {
  name: 'UpgradeRepositoryStorageClass',

  components: { LabeledSelect },

  props: {
    value: {
      type:    String,
      default: '',
    },

    storageClasses: {
      type:    Array,
      default: () => [],
    },

    disabled: {
      type:    Boolean,
      default: false,
    },
  },

  emits: ['update:value'],

  computed: {
    storageClassOptions() {
      const t = this.$store.getters['i18n/t'];

      return this.storageClasses
        .filter((storageClass) => !storageClass.parameters?.backingImage && storageClass.provisioner !== LVM_DRIVER)
        .map((storageClass) => {
          let label = storageClass.isDefault ? `${ storageClass.name } (${ t('generic.default') })` : storageClass.name;
          let disabled = false;

          if (isInternalStorageClass(storageClass.name)) {
            label += ` (${ t('harvester.storage.internal.label') })`;
            disabled = true;
          }

          return {
            label,
            value: storageClass.name,
            disabled
          };
        });
    },
  },
};
</script>

<template>
  <LabeledSelect
    :value="value"
    :label="t('harvester.upgradePage.repositoryStorageClass')"
    :tooltip="t('harvester.upgradePage.repositoryStorageClassTooltip')"
    :placeholder="t('harvester.upgradePage.repositoryStorageClassPlaceholder')"
    :options="storageClassOptions"
    :disabled="disabled"
    required
    @update:value="$emit('update:value', $event)"
  >
    <template #no-options="{ searching }">
      <span
        v-if="!searching"
        class="text-muted"
      >
        {{ t('harvester.upgradePage.repositoryStorageClassNoOptions', null, true) }}
      </span>
    </template>
  </LabeledSelect>
</template>
