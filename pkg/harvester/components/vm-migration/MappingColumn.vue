<script setup>
import { useStore } from 'vuex';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RcItemCard } from '@components/RcItemCard';
import { useI18n } from '@shell/composables/useI18n';
import { VOLUME_MODE } from '../../config/types';

const store = useStore();
const { t } = useI18n(store);

const props = defineProps({
  title:                 { type: String, required: true },
  description:           { type: String, default: '' },
  entries:               { type: Array, default: () => [] },
  options:               { type: Array, default: () => [] },
  placeholder:           { type: String, default: '' },
  showUsedBy:            { type: Boolean, default: false },
  clearable:             { type: Boolean, default: false },
  // Storage-specific: show the volume/access mode defaults row with an Edit action.
  showVolumeSettings:    { type: Boolean, default: false },
  // When set, the defaults row shows an "Inherited from provider" hint (migration plan wizard only).
  inheritedProviderName: { type: String, default: '' },
});

const emit = defineEmits(['edit-defaults']);

// Only offer "Remove Map" for entries that already have a target selected;
// entries without a selection just show the regular options.
const optionsFor = (entry) => {
  if (!props.clearable || !entry.target) {
    return props.options;
  }

  return [
    {
      label: t('harvester.addons.vmMigration.configureMappings.removeMap'),
      value: null,
      kind:  'highlighted',
    },
    {
      label:    'divider',
      disabled: true,
      kind:     'divider',
    },
    ...props.options,
  ];
};

const formatModes = (entry) => {
  const volumeMode = entry.volumeMode || VOLUME_MODE.FILE_SYSTEM;
  const accessModes = (entry.accessModes || []).join(', ');

  return t('harvester.addons.vmMigration.storageDefaults.summary', { volumeMode, accessModes });
};
</script>

<template>
  <div class="mapping-column">
    <div>
      <h3 class="mapping-section-title">
        {{ title }}
      </h3>
      <p
        v-if="description"
        class="text-deemphasized line-height-20"
      >
        {{ description }}
      </p>
    </div>

    <RcItemCard
      v-for="entry in entries"
      :id="entry._key"
      :key="entry._key"
      :variant="'small'"
      :header="{}"
      class="bg-light-gray"
    >
      <template #item-card-content>
        <div class="card-content-column">
          <div class="card-content-row">
            <div class="mapping-source">
              <span class="source-name">{{ entry.name }}</span>
              <slot
                name="source-detail"
                :entry="entry"
              />
            </div>
            <div :class="['mapping-arrow', entry.target ? 'text-success' : 'text-deemphasized']">
              <i
                class="icon icon-right-arrow-alt"
                aria-hidden="true"
              />
            </div>
            <div class="mapping-target">
              <LabeledSelect
                v-model:value="entry.target"
                :options="optionsFor(entry)"
                :placeholder="placeholder+'...'"
                :searchable="true"
              />
            </div>
          </div>
          <div
            v-if="showVolumeSettings && entry.target"
            class="storage-defaults-row"
          >
            <div class="storage-defaults">
              <div class="storage-defaults-info">
                <span class="storage-defaults-summary">{{ formatModes(entry) }}</span>
                <span
                  v-if="inheritedProviderName && entry.inheritedFromProvider && !entry.overridden"
                  class="text-deemphasized storage-defaults-inherited"
                >
                  {{ t('harvester.addons.vmMigration.storageDefaults.inherited', { provider: inheritedProviderName }) }}
                </span>
              </div>
              <a
                role="button"
                class="storage-defaults-edit"
                @click.prevent="emit('edit-defaults', entry)"
              >
                {{ t('harvester.addons.vmMigration.storageDefaults.edit') }}
              </a>
            </div>
          </div>
          <div v-if="showUsedBy && entry.usedBy && entry.usedBy.length">
            <span class="used-by">
              {{ t('harvester.addons.vmMigration.generic.usedBy') }} <b>{{ entry.usedBy.join(', ') }}</b>
            </span>
          </div>
        </div>
      </template>
    </RcItemCard>
  </div>
</template>

<style lang="scss" scoped>
  .mapping-column {
    display: flex;
    gap: 12px;
    flex-direction: column;

    :deep(.item-card-header) {
      display: none;
    }
  }

  .mapping-section-title {
    font-weight: 600;
    margin: 0 0 5px 0;
    line-height: 28px;
  }

  .card-content-row {
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
  }

  .card-content-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mapping-source {
    display: flex;
    flex-direction: column;
    flex: 2;
    min-width: 100px;
    font-size: 14px;
    line-height: 20px;

    .source-name {
      font-weight: 600;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-detail {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .used-by {
      margin-top: 4px;
      font-size: 14px;
      line-height: 24px;
    }
  }

  .mapping-arrow {
    font-size: 22px;
    flex-shrink: 0;
  }

  .mapping-target {
    flex: 3;
    min-width: 0;
    overflow: hidden;
  }

  .line-height-20 {
    line-height: 20px;
  }

  .storage-defaults-row {
    width: 100%;
  }

  .storage-defaults {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 4px;
    background-color: var(--body-bg);

    .storage-defaults-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .storage-defaults-summary {
      font-size: 13px;
      line-height: 20px;
    }

    .storage-defaults-inherited {
      font-size: 12px;
      line-height: 18px;
    }

    .storage-defaults-edit {
      flex-shrink: 0;
      cursor: pointer;
    }
  }

  .bg-light-gray {
    background-color: var(--category-active) !important;
    border: 0;
  }
</style>
