<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import dayjs from 'dayjs';
import isEqual from 'lodash/isEqual';
import Banner from '@components/Banner/Banner.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { RcButton } from '@components/RcButton';
import { RcHeading } from '@components/RcHeading';
import { RcModal } from '@components/RcModal';
import LabelValue from '@shell/components/LabelValue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { useI18n } from '@shell/composables/useI18n';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { dateTimeFormat } from '@shell/utils/time';
import { HCI } from '../../types';
import { IGNORE_DURATION_DAYS, IGNORE_RULE_SOURCE_LABEL, allAffectedResourceNames, ignoreRuleName } from '../../utils/component-health';

const props = defineProps({
  row: {
    type:     Object,
    required: true,
  },
  // empty when the rule is created
  rule: {
    type:    Object,
    default: null,
  },
  mode: {
    type:    String,
    default: _CREATE,
  },
  // `show` and the `close` handler, from whoever owns this modal's visibility
  modal: {
    type:     Object,
    required: true,
  },
});

const store = useStore();
const { t } = useI18n(store);

const isView = computed(() => props.mode === _VIEW);

const ruleResources = props.rule?.spec?.resources || [];
const expiresAt = props.rule?.spec?.expiresAt;
const hasExpired = !!expiresAt && !dayjs(expiresAt).isAfter(dayjs());

// a rule can still list resources that are no longer affected
const resourceOptions = computed(() => [...new Set([...allAffectedResourceNames(props.row), ...ruleResources])]);

// a rule that lists no resource ignores the entire check
const chosenScope = ref(props.rule && !ruleResources.length ? 'check' : null);
const scope = computed({
  get: () => chosenScope.value || (resourceOptions.value.length ? 'resources' : 'check'),
  set: (value) => {
    chosenScope.value = value;
  },
});
// null selects every resource, the ones that are not selected are kept visible
const selected = ref(ruleResources.length ? ruleResources : null);
// a rule keeps the expiry it has until another duration is chosen
const duration = ref(props.rule ? null : 'days7');
const reason = ref(props.rule?.spec?.reason || '');
const errors = ref([]);
const saving = ref(false);

const selectedResources = computed(() => {
  return selected.value === null ? resourceOptions.value : resourceOptions.value.filter((name) => selected.value.includes(name));
});

const scopeOptions = computed(() => [
  { label: t('harvester.dashboard.sections.componentHealth.ignore.scopeCheck'), value: 'check' },
  { label: t('harvester.dashboard.sections.componentHealth.ignore.scopeResources'), value: 'resources' },
]);

const durationOptions = computed(() => Object.keys(IGNORE_DURATION_DAYS).map((key) => ({
  label: t(`harvester.dashboard.sections.componentHealth.ignore.${ key }`),
  value: key,
})));

// worked out once for each choice, so the date shown is the date saved
const newExpiresAt = computed(() => {
  const days = IGNORE_DURATION_DAYS[duration.value];

  return days ? dayjs().add(days, 'day').toISOString() : undefined;
});

const spec = computed(() => {
  const out = {
    componentHealth: props.row.componentHealthName,
    checkKey:        props.row.checkName,
  };

  // the rule only lists the selected resources, so it does not swallow the ones coming later
  if (scope.value === 'resources') {
    out.resources = selectedResources.value;
  }

  const expiry = duration.value ? newExpiresAt.value : expiresAt;

  if (expiry) {
    out.expiresAt = expiry;
  }

  if (reason.value) {
    out.reason = reason.value;
  }

  return out;
});

// what the form changes, in an order that does not depend on the options
const editable = (ruleSpec) => ({
  resources: [...(ruleSpec?.resources || [])].sort(),
  expiresAt: ruleSpec?.expiresAt || '',
  reason:    ruleSpec?.reason || '',
});

const hasChanges = computed(() => !props.rule || !isEqual(editable(spec.value), editable(props.rule.spec)));

// an expired rule applies to nothing, so it only takes changes once it has a new expiration
const locked = computed(() => hasExpired && !isView.value && !duration.value);

// a rule that lists no resource would ignore the entire check
const canSave = computed(() => !locked.value && (scope.value === 'check' || selectedResources.value.length > 0) && hasChanges.value);

const currentExpiry = computed(() => {
  if (!expiresAt) {
    return t('harvester.dashboard.sections.componentHealth.ignore.neverExpires');
  }

  return t(`harvester.dashboard.sections.componentHealth.ignore.${ hasExpired ? 'expiredOn' : 'expiresOn' }`, { date: dateTimeFormat(expiresAt, store) });
});

const newExpiry = computed(() => {
  if (!newExpiresAt.value) {
    return t('harvester.dashboard.sections.componentHealth.ignore.willNeverExpire');
  }

  return t('harvester.dashboard.sections.componentHealth.ignore.willExpireOn', { date: dateTimeFormat(newExpiresAt.value, store) });
});

function close() {
  // stays open while the rule is saved, so a failure can still be shown
  if (!saving.value) {
    props.modal.onClose();
  }
}

async function save() {
  errors.value = [];
  saving.value = true;

  try {
    const rule = props.rule ? await store.dispatch('harvester/clone', { resource: props.rule }) : await store.dispatch('harvester/create', {
      type:     HCI.HEALTH_IGNORE_RULE,
      metadata: {
        name:   ignoreRuleName(props.row.componentHealthName, props.row.checkName),
        labels: { [IGNORE_RULE_SOURCE_LABEL]: 'user' },
      },
    });

    rule.spec = spec.value;
    await rule.save();

    store.dispatch('growl/success', {
      title:   t('generic.notification.title.succeed'),
      message: t(`harvester.dashboard.sections.componentHealth.ignore.${ props.rule ? 'updated' : 'created' }`, { name: props.row.checkName }),
    }, { root: true });

    saving.value = false;
    close();
  } catch (err) {
    errors.value = exceptionToErrorsArray(err?.data || err);
    saving.value = false;
  }
}
</script>

<template>
  <!-- Not v-bind="modal": closing goes through close(), which refuses while the rule is saved -->
  <RcModal
    :show="modal.show"
    :title="t(`harvester.dashboard.sections.componentHealth.ignore.${ mode }`)"
    data-testid="component-health-ignore-modal"
    @close="close"
    @primary-action="save"
  >
    <Banner
      v-if="hasExpired && !isView"
      class="m-0"
      color="warning"
      data-testid="component-health-ignore-expired"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.expiredBanner', { date: dateTimeFormat(expiresAt, store) })"
    />
    <div class="row">
      <div class="col span-6">
        <LabelValue
          :name="t('harvester.dashboard.sections.componentHealth.component')"
          :value="row.component"
        />
      </div>
      <div class="col span-6">
        <LabelValue
          :name="t('harvester.dashboard.sections.componentHealth.check')"
          :value="row.checkName"
        />
      </div>
    </div>
    <div v-if="resourceOptions.length">
      <RcHeading :size="4">
        {{ t('harvester.dashboard.sections.componentHealth.ignore.scope') }}
      </RcHeading>
      <RadioGroup
        v-model:value="scope"
        name="ignore-scope"
        :aria-label="t('harvester.dashboard.sections.componentHealth.ignore.scope')"
        :mode="mode"
        :disabled="locked"
        :options="scopeOptions"
      />
      <div
        v-if="scope === 'resources'"
        class="ignore-resources"
      >
        <LabeledSelect
          :value="selectedResources"
          :label="t('harvester.dashboard.sections.componentHealth.ignore.resources')"
          :mode="mode"
          :options="resourceOptions"
          :multiple="true"
          :close-on-select="false"
          :clearable="false"
          :required="!isView"
          :disabled="locked"
          @update:value="selected = $event"
        />
      </div>
    </div>
    <div>
      <RcHeading :size="4">
        {{ t('harvester.dashboard.sections.componentHealth.ignore.duration') }}
      </RcHeading>
      <p
        v-if="rule"
        class="current-expiry mb-10"
        data-testid="component-health-ignore-current-expiry"
      >
        {{ currentExpiry }}
      </p>
      <template v-if="!isView">
        <RadioGroup
          v-model:value="duration"
          name="ignore-duration"
          :aria-label="t('harvester.dashboard.sections.componentHealth.ignore.duration')"
          :mode="mode"
          :options="durationOptions"
          :row="true"
        />
        <p
          v-if="duration"
          class="new-expiry text-muted"
          data-testid="component-health-ignore-new-expiry"
        >
          {{ newExpiry }}
        </p>
      </template>
    </div>
    <LabeledInput
      v-model:value="reason"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.reason')"
      :placeholder="isView ? '' : t('harvester.dashboard.sections.componentHealth.ignore.reasonPlaceholder')"
      :mode="mode"
      :disabled="locked"
    />
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      class="m-0"
      color="error"
      :label="err"
    />

    <template
      v-if="isView"
      #actions="{ close: closeModal }"
    >
      <RcButton
        variant="primary"
        size="large"
        data-testid="component-health-ignore-close"
        @click="closeModal"
      >
        {{ t('generic.close') }}
      </RcButton>
    </template>
    <template
      v-else
      #primary-action="{ primaryAction }"
    >
      <RcButton
        variant="primary"
        size="large"
        :disabled="!canSave || saving"
        :aria-busy="saving"
        data-testid="component-health-ignore-confirm"
        @click="primaryAction"
      >
        {{ t(rule ? 'generic.save' : 'generic.create') }}
      </RcButton>
    </template>
  </RcModal>
</template>

<style lang="scss" scoped>
  // lines the field up with the radio's label
  .ignore-resources {
    margin: 10px 0 0 19px;
  }
</style>
