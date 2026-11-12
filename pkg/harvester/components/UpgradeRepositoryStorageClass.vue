<script>
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LVM_DRIVER } from '../models/harvester/storage.k8s.io.storageclass';
import { isInternalStorageClass } from '../utils/storage-class';

export default {
  name: 'UpgradeRepositoryStorageClass',

  components: { LabeledSelect },

  props: {
    modelValue: {
      type:    String,
      default: '',
    },

    storageClasses: {
      type:    Array,
      default: () => [],
    },
  },

  emits: ['update:modelValue'],

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
    :value="modelValue"
    :label="t('harvester.upgradePage.repositoryStorageClass')"
    :tooltip="t('harvester.upgradePage.repositoryStorageClassTooltip')"
    :placeholder="t('harvester.upgradePage.repositoryStorageClassPlaceholder')"
    :options="storageClassOptions"
    required
    @update:value="$emit('update:modelValue', $event)"
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
