<script setup>
import { computed, onMounted, ref } from 'vue';
import { HCI } from '../../types';
import { useStore } from 'vuex';
import { useI18n } from '@shell/composables/useI18n';
import SortableTable from '@shell/components/SortableTable';
import { exceptionToErrorsArray } from '@shell/utils/error';
import Banner from '@components/Banner/Banner.vue';
import { BadgeState } from '@components/BadgeState';
import { Checkbox } from '@components/Form/Checkbox';
import { RcCounterBadge } from '@components/Pill';
import { RcButton } from '@components/RcButton';
import { useModal } from '@components/RcModal';
import ComponentChecksTable from './ComponentChecksTable.vue';
import IgnoreRuleModal from './IgnoreRuleModal.vue';
import {
  COMPONENT_HEALTH_SEVERITIES, HEALTH_SUMMARY_SEVERITY_RANK, affectedResourceKind, affectedResourceLabel,
  allAffectedResourceNames, componentOf, healthSummarySeverity, severityColor
} from '../../utils/component-health';

const store = useStore();
const { t } = useI18n(store);
const table = ref(null);
const loading = ref(true);
const lists = {
  healthSummaries:  ref([]),
  componentHealths: ref([]),
  ignoreRules:      ref([]),
};
const { healthSummaries, componentHealths, ignoreRules } = lists;
// the lists that could not be loaded, with why
const loadErrors = ref({});

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
    search:   false,
    width:    120,
  },
  {
    align:    'right',
    name:     'warningCount',
    labelKey: 'harvester.dashboard.sections.healthSummary.warningCount',
    value:    'warningCount',
    sort:     'warningCount',
    search:   false,
    width:    120,
  },
];

const {
  open: openRuleModal, isOpen: ruleModalOpen, payload: ruleToOpen, modal: ruleModal
} = useModal();

const showIgnored = ref(false);
const filterText = computed(() => table.value?.searchQuery || '');

const checks = computed(() => {
  const result = [];

  (componentHealths.value || []).forEach((componentHealth) => {
    const component = componentOf(componentHealth);
    const statusChecks = componentHealth?.status?.checks || {};

    Object.entries(statusChecks).forEach(([checkName, check]) => {
      result.push({
        id:                  `${ componentHealth.id }/${ checkName }`,
        component,
        componentHealthName: componentHealth.metadata?.name,
        checkName,
        ignored:             !!check.ignored,
        severity:            check.severity,
        // the table sorts on a row property, the severities are not in alphabetical order
        severityRank:        COMPONENT_HEALTH_SEVERITIES.indexOf(check.severity),
        message:             check.message,
        affectedCount:       check.affectedCount,
        affectedResources:   check.affectedResources,
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
    check.checkName,
    check.message,
    check.affectedResources?.apiVersion,
    affectedResourceKind(check),
    affectedResourceLabel(check, store),
    // the ignored resources too, they are behind a link like the ones past the first few
    ...allAffectedResourceNames(check),
  ].join(' ').toLowerCase(),
})));

// the checks ignored as a whole, the ones the checkbox brings back
const ignoredCheckCount = computed(() => checks.value.filter((check) => check.ignored).length);

const rows = computed(() => {
  const result = [];

  (healthSummaries.value || []).forEach((healthSummary) => {
    const components = healthSummary?.status?.components || {};

    Object.entries(components).forEach(([component, counts]) => {
      const componentChecks = shownChecks.value.filter((check) => check.component === component);
      const row = {
        id:               `${ healthSummary.id }/${ component }`,
        component,
        errorCount:       counts?.errorCount || 0,
        warningCount:     counts?.warningCount || 0,
        checksFilterText: componentChecks.map((check) => check.filterText).join(' '),
        checks:           componentChecks,
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
  const types = {
    healthSummaries:  HCI.HEALTH_SUMMARY,
    componentHealths: HCI.COMPONENT_HEALTH,
  };

  if (store.getters['harvester/schemaFor'](HCI.HEALTH_IGNORE_RULE)) {
    types.ignoreRules = HCI.HEALTH_IGNORE_RULE;
  }

  // a list that fails does not stop the others from showing
  await Promise.all(Object.entries(types).map(async([key, type]) => {
    try {
      lists[key].value = await store.dispatch('harvester/findAll', { type });
    } catch (err) {
      loadErrors.value[key] = exceptionToErrorsArray(err).join(', ');
    }
  }));

  loading.value = false;
});

// the table has these from shell 3.0.15, in the props of its #header-right slot, so they can go with that bump
function expandAll() {
  table.value.expanded = Object.fromEntries(rows.value.map((row) => [row.id, true]));
}

function collapseAll() {
  table.value.expanded = {};
}
</script>

<template>
  <Banner
    v-for="(error, key) in loadErrors"
    :key="key"
    color="error"
    :label="t(`harvester.dashboard.sections.componentHealth.loadFailed.${ key }`, { error })"
  />
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
      <div
        v-if="ignoredCheckCount"
        class="show-ignored"
      >
        <!-- the label holds the badge, so the checkbox is named here -->
        <Checkbox
          v-model:value="showIgnored"
          type="checkbox"
          :alternate-label="`${ t('harvester.dashboard.sections.componentHealth.showIgnored') } ${ ignoredCheckCount }`"
        >
          <template #label>
            <span class="show-ignored-label">
              {{ t('harvester.dashboard.sections.componentHealth.showIgnored') }}
              <RcCounterBadge
                :count="ignoredCheckCount"
                type="inactive"
              />
            </span>
          </template>
        </Checkbox>
      </div>
    </template>
    <template #header-right>
      <div
        v-if="rows.length"
        class="expand-actions"
      >
        <RcButton
          variant="link"
          size="small"
          @click="expandAll"
        >
          {{ t('harvester.dashboard.sections.healthSummary.expandAll') }}
        </RcButton>
        <RcButton
          variant="link"
          size="small"
          @click="collapseAll"
        >
          {{ t('harvester.dashboard.sections.healthSummary.collapseAll') }}
        </RcButton>
      </div>
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
            :filter-text="filterText"
            :load-failed="!!loadErrors.componentHealths"
            @open-rule="openRuleModal"
          />
        </td>
      </tr>
    </template>
  </SortableTable>
  <!-- mounted each time it opens, so the form always starts over -->
  <IgnoreRuleModal
    v-if="ruleModalOpen"
    v-bind="ruleToOpen"
    :modal="ruleModal"
  />
</template>

<style lang="scss" scoped>
  // the filter box in the same row is taller, this lines up with it
  .show-ignored {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .show-ignored-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .expand-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

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
