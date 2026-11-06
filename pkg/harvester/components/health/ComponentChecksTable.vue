<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { RcButton } from '@components/RcButton';
import { useI18n } from '@shell/composables/useI18n';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
import { HCI } from '../../types';
import {
  AFFECTED_RESOURCES_TRUNCATE_COUNT, MESSAGE_TRUNCATE_LENGTH,
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

const emit = defineEmits(['open-rule', 'delete-rule']);

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
];

const headers = computed(() => allHeaders.filter((header) => header.name !== 'node' || props.rows.some((row) => row.node)));

const canCreateRule = computed(() => {
  const schema = store.getters['harvester/schemaFor'](HCI.HEALTH_IGNORE_RULE);

  return !!schema?.collectionMethods?.find((method) => method.toLowerCase() === 'post');
});

function actionsOf(row) {
  const rule = props.ignoreRules.find(({ spec }) => spec?.componentHealth === row.componentHealthName && spec?.checkKey === row.checkName);
  const action = (key, icon, invoke) => ({
    action:  key,
    label:   t(`harvester.dashboard.sections.componentHealth.ignore.${ key }`),
    icon:    `icon ${ icon }`,
    enabled: true,
    invoke,
  });
  const open = (mode) => () => emit('open-rule', {
    row, rule, mode
  });

  if (!rule) {
    return canCreateRule.value ? [action(_CREATE, 'icon-plus', open(_CREATE))] : [];
  }

  const actions = [action(_VIEW, 'icon-document', open(_VIEW))];

  if (rule.canUpdate) {
    actions.push(action(_EDIT, 'icon-edit', open(_EDIT)));
  }

  if (rule.canDelete) {
    actions.push({ divider: true }, action('delete', 'icon-trash', () => emit('delete-rule', { row, rule })));
  }

  return actions;
}

// the table's action menu reads them from the row, as it does on a resource
const rowsWithActions = computed(() => props.rows.map((row) => ({ ...row, availableActions: actionsOf(row) })));

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
    :rows="rowsWithActions"
    :headers="headers"
    key-field="id"
    :search="false"
    :table-actions="false"
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
    <template #cell:checkName="{row, value}">
      {{ value }}
      <span
        v-if="row.ignored"
        class="text-muted"
      >
        ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }})
      </span>
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
            ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }})
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
