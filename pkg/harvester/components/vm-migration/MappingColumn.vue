<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { RcItemCard } from '@components/RcItemCard';
import { useI18n } from '@shell/composables/useI18n';

const store = useStore();
const { t } = useI18n(store);

const props = defineProps({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  entries:     { type: Array, default: () => [] },
  options:     { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  showUsedBy:  { type: Boolean, default: false },
  clearable:   { type: Boolean, default: false },
});

const selectOptions = computed(() => {
  if (!props.clearable) {
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
    {
      label:    `${ props.placeholder }:`,
      disabled: true,
      kind:     'title',
    },
    ...props.options,
  ];
});
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
              <i class="icon icon-right-arrow-alt" />
            </div>
            <div class="mapping-target">
              <LabeledSelect
                v-model:value="entry.target"
                :options="selectOptions"
                :placeholder="placeholder+'...'"
                :searchable="true"
              />
            </div>
          </div>
          <div v-if="showUsedBy && entry.usedBy && entry.usedBy.length">
            <span class="used-by">
              Used by: <b>{{ entry.usedBy.join(', ') }}</b>
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
      font-size: 16px;
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

  .bg-light-gray {
    background-color: var(--category-active) !important;
    border: 0;
  }
</style>
