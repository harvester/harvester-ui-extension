<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import SortableTable from '@shell/components/SortableTable';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { BadgeState } from '@components/BadgeState';
import { Checkbox } from '@components/Form/Checkbox';
import { useI18n } from '@shell/composables/useI18n';
import IgnoreCheckDropdown from './IgnoreCheckDropdown.vue';
import {
  AFFECTED_RESOURCES_TRUNCATE_COUNT, COMPONENT_HEALTH_SEVERITIES, IGNORE_RULE_SOURCE_LABEL, IGNORED_BY_MIN_SEVERITY,
  MESSAGE_TRUNCATE_LENGTH, NODE_LABEL, activeAffectedResourceNames, affectedResourceKind, allAffectedResourceNames,
  componentOf, resourceIgnoredBy, severityColor
} from '../../utils/component-health';

const props = defineProps({
  componentHealths: {
    type:    Array,
    default: () => [],
  },
  ignoreRules: {
    type:    Array,
    default: () => [],
  },
});

const store = useStore();
const { t } = useI18n(store);

const headers = [
  {
    name:     'severity',
    labelKey: 'harvester.dashboard.sections.componentHealth.severity',
    value:    'severityRank',
    sort:     'severityRank',
    width:    110,
  },
  {
    name:     'node',
    labelKey: 'harvester.dashboard.sections.componentHealth.node',
    value:    'node',
    sort:     'node',
  },
  {
    name:     'checkName',
    labelKey: 'harvester.dashboard.sections.componentHealth.check',
    value:    'checkName',
    sort:     'checkName',
  },
  {
    name:          'message',
    labelKey:      'harvester.dashboard.sections.componentHealth.message',
    value:         'message',
    canBeVariable: true,
  },
  {
    name:          'affectedCount',
    labelKey:      'harvester.dashboard.sections.componentHealth.affectedCount',
    value:         'affectedCount',
    sort:          'affectedCount',
    width:         260,
    canBeVariable: true,
  },
  {
    align:         'right',
    name:          'lastUpdatedAt',
    labelKey:      'harvester.dashboard.sections.componentHealth.lastUpdatedAt',
    value:         'lastUpdatedAt',
    sort:          'lastUpdatedAt:desc',
    formatter:     'LiveDate',
    formatterOpts: { addSuffix: true },
    width:         140,
  },
  {
    align:    'right',
    name:     'actions',
    labelKey: 'harvester.dashboard.sections.componentHealth.actions',
    width:    120,
  },
];

const showIgnored = ref(false);
const severityFilters = ref({});
const expandedMessageIds = ref([]);
const expandedResourceIds = ref([]);

const rows = computed(() => {
  const result = [];

  (props.componentHealths || []).forEach((componentHealth) => {
    const component = componentOf(componentHealth);
    const node = componentHealth?.metadata?.labels?.[NODE_LABEL] || '';
    const checks = componentHealth?.status?.checks || {};
    const lastUpdatedAt = componentHealth?.status?.lastUpdatedAt;

    Object.entries(checks).forEach(([checkName, check]) => {
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

function affectedResourceNames(row) {
  return showIgnored.value ? allAffectedResourceNames(row) : activeAffectedResourceNames(row);
}

function filtersFor(component) {
  return severityFilters.value[component] || COMPONENT_HEALTH_SEVERITIES;
}

function isRowVisible(row) {
  return showIgnored.value || !row.ignored;
}

function hasIgnoredRows(groupRows) {
  return groupRows.some((row) => row.ignored || allAffectedResourceNames(row).length !== activeAffectedResourceNames(row).length);
}

const groups = computed(() => {
  const rowsByComponent = {};

  rows.value.forEach((row) => {
    rowsByComponent[row.component] = rowsByComponent[row.component] || [];
    rowsByComponent[row.component].push(row);
  });

  // a component without any check still gets a tab
  (props.componentHealths || []).forEach((componentHealth) => {
    const component = componentOf(componentHealth);

    rowsByComponent[component] = rowsByComponent[component] || [];
  });

  return Object.keys(rowsByComponent).sort().map((component) => {
    const groupRows = rowsByComponent[component];
    const shownRows = groupRows.filter((row) => isRowVisible(row));
    const visibleRows = shownRows.filter((row) => filtersFor(component).includes(row.severity));

    return {
      component,
      hasIgnored: hasIgnoredRows(groupRows),
      // tells an empty severity filter result from a health report without any check
      hasChecks:  shownRows.length > 0,
      filters:    COMPONENT_HEALTH_SEVERITIES.map((severity) => ({
        severity,
        count: groupRows.filter((row) => row.severity === severity && isRowVisible(row)).length,
      })),
      rows:    visibleRows,
      headers: headers.filter((header) => header.name !== 'node' || visibleRows.some((row) => row.node)),
    };
  });
});

function toggleSeverity(component, severity, enabled) {
  const filters = filtersFor(component);

  severityFilters.value = {
    ...severityFilters.value,
    [component]: enabled ? [...filters, severity] : filters.filter((filter) => filter !== severity),
  };
}

// called from the template, where the refs are unwrapped, so the array is changed in place
function toggleId(list, id) {
  const index = list.indexOf(id);

  if (index === -1) {
    list.push(id);
  } else {
    list.splice(index, 1);
  }
}

function isMessageTruncated(message) {
  return !!message && message.length > MESSAGE_TRUNCATE_LENGTH;
}

function displayedMessage(row, message) {
  return expandedMessageIds.value.includes(row.id) || !isMessageTruncated(message) ? message : message.slice(0, MESSAGE_TRUNCATE_LENGTH);
}

function visibleAffectedResourceNames(row) {
  const names = affectedResourceNames(row);

  return expandedResourceIds.value.includes(row.id) ? names : names.slice(0, AFFECTED_RESOURCES_TRUNCATE_COUNT);
}

function remainingAffectedResourcesCount(row) {
  return Math.max(affectedResourceNames(row).length - AFFECTED_RESOURCES_TRUNCATE_COUNT, 0);
}

function ignoreRuleByName(name) {
  return (props.ignoreRules || []).find((rule) => rule.metadata?.name === name);
}

// the rules shipped by the addon values are managed by Helm, they are not removed from the dashboard
function canRestore(ignoredBy) {
  const rule = ignoreRuleByName(ignoredBy);

  return !!rule && rule.metadata?.labels?.[IGNORE_RULE_SOURCE_LABEL] !== 'default';
}

async function restoreIgnored(ignoredBy) {
  const rule = ignoreRuleByName(ignoredBy);

  if (!rule) {
    return;
  }

  try {
    await rule.remove();

    store.dispatch('growl/success', {
      title:   t('generic.notification.title.succeed'),
      message: t('harvester.dashboard.sections.componentHealth.ignore.restored'),
    }, { root: true });
  } catch (err) {
    store.dispatch('growl/fromError', { title: t('generic.notification.title.error'), err }, { root: true });
  }
}
</script>

<template>
  <div
    v-if="groups.length"
    class="mb-40 mt-40"
  >
    <h3>
      {{ t('harvester.dashboard.sections.componentHealth.label') }}
    </h3>
    <Tabbed
      class="mt-20"
      :side-tabs="true"
      :use-hash="false"
    >
      <Tab
        v-for="group in groups"
        :key="group.component"
        :name="group.component"
        :label="group.component"
      >
        <div class="component-health-filter mb-20">
          <v-dropdown
            popper-class="component-health-filter-dropdown"
            :triggers="['click']"
            placement="bottom-start"
            :distance="20"
          >
            <button class="btn bg-primary">
              {{ t('harvester.dashboard.sections.componentHealth.filter') }}
            </button>

            <template #popper>
              <div class="filter-popup">
                <Checkbox
                  v-for="filter in group.filters"
                  :key="filter.severity"
                  :value="filtersFor(group.component).includes(filter.severity)"
                  type="checkbox"
                  :label="`${ filter.severity } (${ filter.count })`"
                  @update:value="toggleSeverity(group.component, filter.severity, $event)"
                />
              </div>
            </template>
          </v-dropdown>
          <Checkbox
            v-if="group.hasIgnored"
            v-model:value="showIgnored"
            class="ml-20"
            type="checkbox"
            :label="t('harvester.dashboard.sections.componentHealth.showIgnored')"
          />
        </div>
        <div
          v-if="!group.rows.length"
          class="text-muted"
        >
          {{ group.hasChecks ? t('harvester.dashboard.sections.componentHealth.noMatchingChecks') : t('harvester.dashboard.sections.componentHealth.noIssues') }}
        </div>
        <SortableTable
          v-else
          :rows="group.rows"
          :headers="group.headers"
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
              :color="severityColor(row.severity)"
              :label="row.severity"
            />
          </template>
          <template #cell:actions="{row}">
            <div v-if="row.ignored">
              <button
                v-if="canRestore(row.ignoredBy)"
                type="button"
                class="btn btn-sm role-link pl-0"
                @click="restoreIgnored(row.ignoredBy)"
              >
                {{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}
              </button>
              <span
                v-else-if="row.ignoredBy === IGNORED_BY_MIN_SEVERITY"
                v-clean-tooltip="t('harvester.dashboard.sections.componentHealth.ignore.minSeverity')"
                class="text-muted"
              >
                {{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}
              </span>
              <span
                v-else
                v-clean-tooltip="t('harvester.dashboard.sections.componentHealth.ignore.managedByAddon')"
                class="text-muted"
              >
                {{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}
              </span>
            </div>
            <IgnoreCheckDropdown
              v-else
              :row="row"
            />
          </template>
          <template #cell:node="{value}">
            {{ value || '-' }}
          </template>
          <template #cell:message="{row, value}">
            <span>
              {{ displayedMessage(row, value) }}
              <button
                v-if="isMessageTruncated(value)"
                type="button"
                class="btn btn-sm role-link pl-0"
                :aria-expanded="expandedMessageIds.includes(row.id)"
                @click="toggleId(expandedMessageIds, row.id)"
              >
                {{ expandedMessageIds.includes(row.id) ? t('harvester.generic.hideMore') : t('harvester.generic.showMore') }}
              </button>
            </span>
          </template>
          <template #cell:affectedCount="{row, value}">
            <div v-if="affectedResourceNames(row).length">
              <div class="text-muted">
                {{ affectedResourceKind(row) }} ({{ value }})
              </div>
              <div
                v-for="name in visibleAffectedResourceNames(row)"
                :key="name"
                :class="{ 'text-muted': resourceIgnoredBy(row, name) }"
              >
                {{ name }}
                <span v-if="resourceIgnoredBy(row, name)">
                  ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }}<template v-if="canRestore(resourceIgnoredBy(row, name))">,
                    <button
                      type="button"
                      class="btn btn-sm role-link p-0"
                      @click="restoreIgnored(resourceIgnoredBy(row, name))"
                    >{{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}</button></template>)
                </span>
              </div>
              <button
                v-if="remainingAffectedResourcesCount(row)"
                type="button"
                class="btn btn-sm role-link pl-0"
                :aria-expanded="expandedResourceIds.includes(row.id)"
                @click="toggleId(expandedResourceIds, row.id)"
              >
                {{ expandedResourceIds.includes(row.id) ? t('harvester.generic.hideMore') : t('harvester.dashboard.sections.componentHealth.moreAffectedResources', { count: remainingAffectedResourcesCount(row) }) }}
              </button>
            </div>
            <span v-else>
              {{ t('harvester.dashboard.sections.componentHealth.noAffectedResources') }}
            </span>
          </template>
        </SortableTable>
      </Tab>
    </Tabbed>
  </div>
</template>

<style lang="scss" scoped>
  .component-health-filter {
    display: flex;
    align-items: center;
  }

  .component-health-filter-dropdown .filter-popup {
    display: grid;
    gap: 10px;
    padding: 10px;
  }
</style>
