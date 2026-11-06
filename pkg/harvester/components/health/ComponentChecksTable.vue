<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { RcButton } from '@components/RcButton';
import { useI18n } from '@shell/composables/useI18n';
import {
  AFFECTED_RESOURCES_TRUNCATE_COUNT, IGNORE_RULE_SOURCE_LABEL, IGNORED_BY_MIN_SEVERITY, MESSAGE_TRUNCATE_LENGTH,
  activeAffectedResourceNames, affectedResourceKind, allAffectedResourceNames, resourceIgnoredBy, severityColor
} from '../../utils/component-health';

const props = defineProps({
  rows: {
    type:     Array,
    required: true,
  },
  ignoreRules: {
    type:    Array,
    default: () => [],
  },
  showIgnored: {
    type:    Boolean,
    default: false,
  },
});

const emit = defineEmits(['ignore']);

const store = useStore();
const { t } = useI18n(store);

const allHeaders = [
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

const headers = computed(() => allHeaders.filter((header) => header.name !== 'node' || props.rows.some((row) => row.node)));

const expandedMessageIds = ref([]);
const expandedResourceIds = ref([]);

function affectedResourceNames(row) {
  return props.showIgnored ? allAffectedResourceNames(row) : activeAffectedResourceNames(row);
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
  return props.ignoreRules.find((rule) => rule.metadata?.name === name);
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
    v-if="!rows.length"
    class="text-muted"
  >
    {{ t('harvester.dashboard.sections.componentHealth.noIssues') }}
  </div>
  <SortableTable
    v-else
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
        :color="severityColor(row.severity)"
        :label="row.severity"
      />
    </template>
    <template #cell:actions="{row}">
      <div v-if="row.ignored">
        <RcButton
          v-if="canRestore(row.ignoredBy)"
          variant="link"
          size="small"
          class="compact-link"
          @click="restoreIgnored(row.ignoredBy)"
        >
          {{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}
        </RcButton>
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
      <RcButton
        v-else
        variant="secondary"
        size="small"
        @click="emit('ignore', row)"
      >
        {{ t('harvester.dashboard.sections.componentHealth.ignore.action') }}
      </RcButton>
    </template>
    <template #cell:node="{value}">
      {{ value || '-' }}
    </template>
    <template #cell:message="{row, value}">
      <span>
        {{ displayedMessage(row, value) }}
        <RcButton
          v-if="isMessageTruncated(value)"
          variant="link"
          size="small"
          class="compact-link"
          :aria-expanded="expandedMessageIds.includes(row.id)"
          @click="toggleId(expandedMessageIds, row.id)"
        >
          {{ expandedMessageIds.includes(row.id) ? t('harvester.generic.hideMore') : t('harvester.generic.showMore') }}
        </RcButton>
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
              <RcButton
                variant="link"
                size="small"
                class="compact-link"
                @click="restoreIgnored(resourceIgnoredBy(row, name))"
              >{{ t('harvester.dashboard.sections.componentHealth.ignore.restore') }}</RcButton></template>)
          </span>
        </div>
        <RcButton
          v-if="remainingAffectedResourcesCount(row)"
          variant="link"
          size="small"
          class="compact-link"
          :aria-expanded="expandedResourceIds.includes(row.id)"
          @click="toggleId(expandedResourceIds, row.id)"
        >
          {{ expandedResourceIds.includes(row.id) ? t('harvester.generic.hideMore') : t('harvester.dashboard.sections.componentHealth.moreAffectedResources', { count: remainingAffectedResourcesCount(row) }) }}
        </RcButton>
      </div>
      <span v-else>
        {{ t('harvester.dashboard.sections.componentHealth.noAffectedResources') }}
      </span>
    </template>
  </SortableTable>
</template>

<style lang="scss" scoped>
  // these sit next to text, so they line up with it
  .compact-link {
    --rc-button-padding: 0;
  }
</style>
