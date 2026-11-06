<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { HCI } from '../../types';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { Checkbox } from '@components/Form/Checkbox';
import { RcButton } from '@components/RcButton';
import { useModal } from '@components/RcModal';
import ComponentChecksTable from './ComponentChecksTable.vue';
import IgnoreCheckModal from './IgnoreCheckModal.vue';
import {
  COMPONENT_HEALTH_SEVERITIES, HEALTH_SUMMARY_SEVERITY_RANK, NODE_LABEL, activeAffectedResourceNames, affectedResourceKind,
  allAffectedResourceNames, componentOf, healthSummarySeverity, severityColor
} from '../../utils/component-health';

const store = useStore();
const { t } = useI18n(store);
const table = ref(null);
const loading = ref(true);
const healthSummaries = ref([]);
const componentHealths = ref([]);
const ignoreRules = ref([]);

const headers = [
  {
    name:     'severity',
    labelKey: 'harvester.dashboard.sections.healthSummary.severity',
    value:    'severityRank',
    sort:     'severityRank',
    search:   'severity',
    width:    110,
  },
  {
    name:     'component',
    labelKey: 'harvester.dashboard.sections.healthSummary.component',
    value:    'component',
    sort:     'component',
    // the table's filter only looks at its own rows, the checks are in the sub-rows
    search:   ['component', 'checksFilterText'],
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
    search:        false,
    width:         140,
  },
];

const {
  open: openIgnoreModal, isOpen: ignoreModalOpen, payload: checkToIgnore, modal: ignoreModal
} = useModal();

const showIgnored = ref(false);
const filterText = computed(() => (table.value?.searchQuery || '').trim().toLowerCase());

const checks = computed(() => {
  const result = [];

  (componentHealths.value || []).forEach((componentHealth) => {
    const component = componentOf(componentHealth);
    const node = componentHealth?.metadata?.labels?.[NODE_LABEL] || '';
    const statusChecks = componentHealth?.status?.checks || {};
    const lastUpdatedAt = componentHealth?.status?.lastUpdatedAt;

    Object.entries(statusChecks).forEach(([checkName, check]) => {
      result.push({
        id:                  `${ componentHealth.id }/${ checkName }`,
        component,
        componentHealthName: componentHealth.metadata?.name,
        node,
        checkName,
        ignored:             !!check.ignored,
        ignoredBy:           check.ignoredBy,
        severity:            check.severity,
        // the table sorts on a row property, the severities are not in alphabetical order
        severityRank:        COMPONENT_HEALTH_SEVERITIES.indexOf(check.severity),
        message:             check.message,
        affectedCount:       check.affectedCount,
        affectedResources:   check.affectedResources,
        lastUpdatedAt,
      });
    });
  });

  return result;
});

const shownChecks = computed(() => checks.value.filter((check) => showIgnored.value || !check.ignored).map((check) => ({
  ...check,
  filterText: [
    check.component,
    check.severity,
    check.node,
    check.checkName,
    check.message,
    affectedResourceKind(check),
    ...(showIgnored.value ? allAffectedResourceNames(check) : activeAffectedResourceNames(check)),
  ].join(' ').toLowerCase(),
})));

const hasIgnored = computed(() => {
  return checks.value.some((check) => check.ignored || allAffectedResourceNames(check).length !== activeAffectedResourceNames(check).length);
});

const rows = computed(() => {
  const result = [];
  // split as the table splits what it filters by
  const filterWords = filterText.value.split(/\s*[, ]\s*/);

  (healthSummaries.value || []).forEach((healthSummary) => {
    const components = healthSummary?.status?.components || {};
    const lastUpdatedAt = healthSummary?.status?.lastUpdatedAt;

    Object.entries(components).forEach(([component, counts]) => {
      const componentChecks = shownChecks.value.filter((check) => check.component === component);
      const matchingChecks = componentChecks.filter((check) => filterWords.every((word) => check.filterText.includes(word)));
      const row = {
        id:               `${ healthSummary.id }/${ component }`,
        component,
        errorCount:       counts?.errorCount || 0,
        warningCount:     counts?.warningCount || 0,
        lastUpdatedAt,
        checksFilterText: componentChecks.map((check) => check.filterText).join(' '),
        // a row the filter found by its own columns keeps all its checks
        checks:           matchingChecks.length ? matchingChecks : componentChecks,
      };

      row.severity = healthSummarySeverity(row);
      // the table sorts on a row property, so the severity has to be on the row
      row.severityRank = HEALTH_SUMMARY_SEVERITY_RANK[row.severity];

      result.push(row);
    });
  });

  return result;
});

onMounted(async() => {
  try {
    [healthSummaries.value, componentHealths.value, ignoreRules.value] = await Promise.all([
      store.dispatch('harvester/findAll', { type: HCI.HEALTH_SUMMARY }),
      store.dispatch('harvester/findAll', { type: HCI.COMPONENT_HEALTH }),
      store.dispatch('harvester/findAll', { type: HCI.HEALTH_IGNORE_RULE }),
    ]);
  } catch (err) {
    console.error('Failed fetching component health with error:', err); // eslint-disable-line no-console
  } finally {
    loading.value = false;
  }
});

// a closed row would hide what the filter found
watch(filterText, (text) => {
  if (text) {
    table.value.filteredRows.filter((row) => !table.value.isExpanded(row)).forEach((row) => table.value.toggleExpand(row));
  }
});
</script>

<template>
  <SortableTable
    ref="table"
    :rows="rows"
    :headers="headers"
    :loading="loading"
    key-field="id"
    :table-actions="false"
    :row-actions="false"
    :paging="true"
    :rows-per-page="10"
    :sub-rows="true"
    :sub-expandable="true"
    :sub-expand-column="true"
    default-sort-by="severity"
  >
    <template #header-left>
      <Checkbox
        v-if="hasIgnored"
        v-model:value="showIgnored"
        type="checkbox"
        :label="t('harvester.dashboard.sections.componentHealth.showIgnored')"
      />
    </template>
    <template #cell:severity="{row}">
      <BadgeState
        :color="severityColor(row.severity)"
        :label="row.severity"
      />
    </template>
    <!-- the table's chevron can't take the keyboard focus, this opens the row from the keyboard -->
    <template #cell:component="{row}">
      <RcButton
        variant="link"
        class="component-name"
        :aria-expanded="!!table?.isExpanded(row)"
        @click="table.toggleExpand(row)"
      >
        {{ row.component }}
      </RcButton>
    </template>
    <template #sub-row="{row, fullColspan}">
      <tr class="sub-row">
        <td :colspan="fullColspan">
          <ComponentChecksTable
            class="sub-table"
            :rows="row.checks"
            :ignore-rules="ignoreRules"
            :show-ignored="showIgnored"
            @ignore="openIgnoreModal"
          />
        </td>
      </tr>
    </template>
  </SortableTable>
  <!-- mounted each time it opens, so the form always starts over -->
  <IgnoreCheckModal
    v-if="ignoreModalOpen"
    :row="checkToIgnore"
    :modal="ignoreModal"
  />
</template>

<style lang="scss" scoped>
  // a button is taller than the table's rows
  .component-name {
    --rc-button-padding: 0;

    &.rc-button.btn-medium:not(.btn-sm) {
      min-height: 0;
      line-height: inherit;
    }
  }

  // the shell has this look for a table in a sub-row from 3.0.15, this can go with that bump
  .sub-row {
    background-color: var(--body-bg) !important;

    > td:first-child {
      padding-left: 0;
      padding-right: 0;
    }

    .sub-table {
      padding: 16px 32px;
    }

    :deep(.sortable-table) {
      border: 0;
      border-radius: 0;
      outline: 0;
    }

    :deep(thead tr:hover) {
      background-color: var(--body-bg);
    }

    :deep(thead th) {
      font-weight: 600;
    }

    :deep(tbody tr) {
      border-bottom: 0;
    }
  }
</style>
