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
  AFFECTED_RESOURCES_TRUNCATE_COUNT, MESSAGE_TRUNCATE_LENGTH, activeAffectedResourceNames, affectedResourceLabel,
  allAffectedResourceNames, hasIgnored, ignoreRuleName, ignoredResourceCount, resourceIgnoredBy, severityColor
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
  // what is typed in the filter box of the table this one sits in
  filterText: {
    type:    String,
    default: '',
  },
  // the checks could not be loaded, so having none does not mean there are no issues
  loadFailed: {
    type:    Boolean,
    default: false,
  },
});

const emit = defineEmits(['open-rule']);

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

// only the rule the UI made for the check, others on it are left as they are
function actionsOf(row) {
  const name = ignoreRuleName(row.componentHealthName, row.checkName);
  const rule = props.ignoreRules.find(({ metadata }) => metadata?.name === name);
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
    actions.push({ divider: true }, action('delete', 'icon-trash', () => rule.promptRemove()));
  }

  return actions;
}

// the table's action menu reads them from the row, as it does on a resource
const rowsWithActions = computed(() => props.rows.map((row) => ({ ...row, availableActions: actionsOf(row) })));

// a menu that could only say there is nothing to do is left out
const hasActions = computed(() => rowsWithActions.value.some((row) => row.availableActions.length));

const expandedMessageIds = ref([]);
const expandedResourceIds = ref([]);
const shownIgnoredIds = ref([]);

// a check ignored as a whole lists all its resources, the others only the ones still reported
function listedResourceNames(row) {
  return row.ignored ? allAffectedResourceNames(row) : activeAffectedResourceNames(row);
}

function ignoredResourceNames(row) {
  const active = activeAffectedResourceNames(row);

  return allAffectedResourceNames(row).filter((name) => !active.includes(name));
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

// the ignored resources come after the others, once their link is used
function visibleAffectedResourceNames(row) {
  const names = listedResourceNames(row);
  const shown = expandedResourceIds.value.includes(row.id) ? names : names.slice(0, AFFECTED_RESOURCES_TRUNCATE_COUNT);

  return shownIgnoredIds.value.includes(row.id) ? [...shown, ...ignoredResourceNames(row)] : shown;
}

function remainingAffectedResourcesCount(row) {
  return Math.max(listedResourceNames(row).length - AFFECTED_RESOURCES_TRUNCATE_COUNT, 0);
}

function isResourceIgnored(row, name) {
  return row.ignored || !!resourceIgnoredBy(row, name);
}

// the ignored resources of a check that is still reported, which have a link of their own
function ignoredLinkCount(row) {
  return row.ignored ? 0 : ignoredResourceCount(row);
}
</script>

<template>
  <div
    v-if="!rows.length"
    class="text-muted"
  >
    {{ t(`harvester.dashboard.sections.componentHealth.${ loadFailed ? 'checksNotLoaded' : 'noIssues' }`) }}
  </div>
  <SortableTable
    v-else
    ref="table"
    :rows="rowsWithActions"
    :headers="headers"
    key-field="id"
    :search="false"
    :table-actions="false"
    :row-actions="hasActions"
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
      <span :class="{ 'text-muted': row.ignored, 'has-ignored': hasIgnored(row) }">
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
        v-if="allAffectedResourceNames(row).length"
        class="affected-resources"
      >
        <div class="affected-title">
          <span class="text-label">{{ affectedResourceLabel(row, store) }}</span>
          <RcCounterBadge
            :count="value || allAffectedResourceNames(row).length"
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
        <div
          v-if="remainingAffectedResourcesCount(row) || ignoredLinkCount(row)"
          class="affected-links"
        >
          <RcButton
            v-if="remainingAffectedResourcesCount(row)"
            variant="link"
            size="small"
            class="compact-link more-link"
            :aria-expanded="expandedResourceIds.includes(row.id)"
            @click="toggleId(expandedResourceIds, row.id)"
          >
            {{ expandedResourceIds.includes(row.id) ? t('generic.showLess') : t('generic.plusMore', { n: remainingAffectedResourcesCount(row) }) }}
          </RcButton>
          <RcButton
            v-if="ignoredLinkCount(row)"
            variant="link"
            size="small"
            class="compact-link ignored-link"
            :aria-expanded="shownIgnoredIds.includes(row.id)"
            @click="toggleId(shownIgnoredIds, row.id)"
          >
            {{ shownIgnoredIds.includes(row.id) ? t('harvester.dashboard.sections.componentHealth.ignore.hideIgnored') : t('harvester.dashboard.sections.componentHealth.ignore.plusIgnored', { n: ignoredLinkCount(row) }) }}
          </RcButton>
        </div>
      </div>
      <span v-else>
        {{ t('harvester.dashboard.sections.componentHealth.noAffectedResources') }}
      </span>
    </template>
  </SortableTable>
</template>

<style lang="scss" scoped>
  // a check with anything ignored stands out, in the colour of a warning banner
  :deep(tbody tr.main-row:has(.has-ignored)) {
    background-color: var(--warning-banner-bg);
  }

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

  .affected-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
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
