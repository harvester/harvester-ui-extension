<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { HEALTH_SUMMARY_SEVERITY_RANK, healthSummarySeverity, severityColor } from '../../utils/component-health';

const props = defineProps({
  healthSummaries: {
    type:    Array,
    default: () => [],
  },
});

const store = useStore();
const { t } = useI18n(store);

const headers = [
  {
    name:     'severity',
    labelKey: 'harvester.dashboard.sections.healthSummary.severity',
    value:    'severityRank',
    sort:     'severityRank',
    width:    110,
  },
  {
    name:     'component',
    labelKey: 'harvester.dashboard.sections.healthSummary.component',
    value:    'component',
    sort:     'component',
  },
  {
    align:    'right',
    name:     'errorCount',
    labelKey: 'harvester.dashboard.sections.healthSummary.errorCount',
    value:    'errorCount',
    sort:     'errorCount',
    width:    120,
  },
  {
    align:    'right',
    name:     'warningCount',
    labelKey: 'harvester.dashboard.sections.healthSummary.warningCount',
    value:    'warningCount',
    sort:     'warningCount',
    width:    120,
  },
  {
    align:         'right',
    name:          'lastUpdatedAt',
    labelKey:      'harvester.dashboard.sections.healthSummary.lastUpdatedAt',
    value:         'lastUpdatedAt',
    sort:          'lastUpdatedAt:desc',
    formatter:     'LiveDate',
    formatterOpts: { addSuffix: true },
    width:         140,
  },
];

const rows = computed(() => {
  const result = [];

  (props.healthSummaries || []).forEach((healthSummary) => {
    const components = healthSummary?.status?.components || {};
    const lastUpdatedAt = healthSummary?.status?.lastUpdatedAt;

    Object.entries(components).forEach(([component, counts]) => {
      const row = {
        id:           `${ healthSummary.id }/${ component }`,
        component,
        errorCount:   counts?.errorCount || 0,
        warningCount: counts?.warningCount || 0,
        lastUpdatedAt,
      };

      // the table sorts on a row property, so the severity has to be on the row
      row.severityRank = HEALTH_SUMMARY_SEVERITY_RANK[healthSummarySeverity(row)];

      result.push(row);
    });
  });

  return result;
});
</script>

<template>
  <div
    v-if="rows.length"
    class="mb-40 mt-40"
  >
    <h3>
      {{ t('harvester.dashboard.sections.healthSummary.label') }}
    </h3>
    <SortableTable
      :rows="rows"
      :headers="headers"
      key-field="id"
      :search="false"
      :table-actions="false"
      :row-actions="false"
      :paging="true"
      :rows-per-page="10"
      default-sort-by="severity"
    >
      <template #cell:severity="{row}">
        <BadgeState
          :color="severityColor(healthSummarySeverity(row))"
          :label="healthSummarySeverity(row)"
        />
      </template>
    </SortableTable>
  </div>
</template>
