<script setup>
import { computed, ref, watch } from 'vue';
import { useStore } from 'vuex';
import SortableTable from '@shell/components/SortableTable';
import { BadgeState } from '@components/BadgeState';
import { RcCounterBadge, RcTag } from '@components/Pill';
import { RcButton } from '@components/RcButton';
import { useI18n } from '@shell/composables/useI18n';
import { _CREATE, _EDIT, _VIEW } from '@shell/config/query-params';
import { HCI } from '../../types';
import {
  AFFECTED_RESOURCES_TRUNCATE_COUNT, MESSAGE_TRUNCATE_LENGTH,
  activeAffectedResourceNames, affectedResourceLabel, allAffectedResourceNames, resourceIgnoredBy, severityColor
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
  // what is typed in the filter box of the table this one sits in
  filterText: {
    type:    String,
    default: '',
  },
});

const emit = defineEmits(['open-rule', 'delete-rule']);

const store = useStore();
const { t } = useI18n(store);

const headers = [
  {
    name:     'severity',
    labelKey: 'harvester.dashboard.sections.componentHealth.severity',
    value:    'severityRank',
    sort:     'severityRank',
    search:   false,
    width:    110,
  },
  {
    name:     'checkName',
    labelKey: 'harvester.dashboard.sections.componentHealth.check',
    value:    'checkName',
    sort:     'checkName',
    // all that a row shows, so the filter also finds a resource hidden behind "more"
    search:   'filterText',
  },
  {
    name:          'message',
    labelKey:      'harvester.dashboard.sections.componentHealth.message',
    value:         'message',
    search:        false,
    canBeVariable: true,
  },
  {
    name:          'affectedCount',
    labelKey:      'harvester.dashboard.sections.componentHealth.affectedCount',
    value:         'affectedCount',
    sort:          'affectedCount',
    search:        false,
    width:         340,
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
    search:        false,
    width:         140,
  },
];

const table = ref(null);

// this table has no filter box of its own, but it filters its rows the same way
watch([table, () => props.filterText], ([checksTable, text]) => {
  if (checksTable) {
    checksTable.searchQuery = text;
  }
});

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

function isResourceIgnored(row, name) {
  return row.ignored || !!resourceIgnoredBy(row, name);
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
    ref="table"
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
      <span :class="{ 'text-muted': row.ignored }">
        {{ value }}
        <template v-if="row.ignored">
          ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }})
        </template>
      </span>
    </template>
    <template #cell:message="{row, value}">
      <span :class="{ 'text-muted': row.ignored }">
        {{ displayedMessage(row, value) }}
        <RcButton
          v-if="isMessageTruncated(value)"
          variant="link"
          size="small"
          class="compact-link"
          :aria-expanded="expandedMessageIds.includes(row.id)"
          @click="toggleId(expandedMessageIds, row.id)"
        >
          {{ expandedMessageIds.includes(row.id) ? t('generic.showLess') : t('generic.showMore') }}
        </RcButton>
      </span>
    </template>
    <template #cell:affectedCount="{row, value}">
      <div
        v-if="affectedResourceNames(row).length"
        class="affected-resources"
      >
        <div class="affected-title">
          <span class="text-label">{{ affectedResourceLabel(row, store) }}</span>
          <RcCounterBadge
            :count="value || affectedResourceNames(row).length"
            type="inactive"
          />
          <span class="api-version text-muted">{{ row.affectedResources.apiVersion }}</span>
        </div>
        <div class="affected-names">
          <RcTag
            v-for="name in visibleAffectedResourceNames(row)"
            :key="name"
            class="affected-name"
            :class="{ ignored: isResourceIgnored(row, name) }"
            type="inactive"
            :disabled="isResourceIgnored(row, name)"
          >
            <span class="name">{{ name }}</span>
            <!-- when all of the check is ignored its name says so -->
            <span v-if="!row.ignored && isResourceIgnored(row, name)">
              ({{ t('harvester.dashboard.sections.componentHealth.ignore.ignored') }})
            </span>
          </RcTag>
        </div>
        <RcButton
          v-if="remainingAffectedResourcesCount(row)"
          variant="link"
          size="small"
          class="compact-link"
          :aria-expanded="expandedResourceIds.includes(row.id)"
          @click="toggleId(expandedResourceIds, row.id)"
        >
          {{ expandedResourceIds.includes(row.id) ? t('generic.showLess') : t('generic.plusMore', { n: remainingAffectedResourcesCount(row) }) }}
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

  .affected-resources {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 4px 0;
  }

  .affected-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin-bottom: 4px;
  }

  .api-version {
    font-size: 12px;
  }

  .affected-names {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .affected-name {
    max-width: 100%;
    font-size: 12px;

    // a long name wraps, so none is ever cut off
    .name {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    // the ones that count are filled, the ignored ones are only outlined
    &.rc-tag.ignored {
      background: transparent;
      border-style: dashed;
      border-color: var(--rc-disabled-text-color);
    }
  }
</style>
