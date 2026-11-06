<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import dayjs from 'dayjs';
import Banner from '@components/Banner/Banner.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { RcButton } from '@components/RcButton';
import { RcModal } from '@components/RcModal';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { useI18n } from '@shell/composables/useI18n';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../types';
import { IGNORE_DURATION_DAYS, IGNORE_RULE_SOURCE_LABEL, activeAffectedResourceNames } from '../../utils/component-health';

const props = defineProps({
  row: {
    type:     Object,
    required: true,
  },
  // `show` and the `close` handler, from whoever owns this modal's visibility
  modal: {
    type:     Object,
    required: true,
  },
});

const store = useStore();
const { t } = useI18n(store);

const activeResources = computed(() => activeAffectedResourceNames(props.row));

const chosenScope = ref(null);
const scope = computed({
  get: () => chosenScope.value || (activeResources.value.length ? 'resources' : 'check'),
  set: (value) => {
    chosenScope.value = value;
  },
});
// null selects every resource, the ones that are not selected are kept visible
const selected = ref(null);
const duration = ref('days7');
const reason = ref('');
const errors = ref([]);
const saving = ref(false);

const selectedResources = computed(() => {
  return selected.value === null ? activeResources.value : activeResources.value.filter((name) => selected.value.includes(name));
});

// a rule that lists no resource would ignore the entire check
const canIgnore = computed(() => scope.value === 'check' || selectedResources.value.length > 0);

const scopeOptions = computed(() => [
  { label: t('harvester.dashboard.sections.componentHealth.ignore.scopeResources'), value: 'resources' },
  { label: t('harvester.dashboard.sections.componentHealth.ignore.scopeCheck'), value: 'check' },
]);

const durationOptions = computed(() => Object.keys(IGNORE_DURATION_DAYS).map((key) => ({
  label: t(`harvester.dashboard.sections.componentHealth.ignore.${ key }`),
  value: key,
})));

function close() {
  // stays open while the rule is saved, so a failure can still be shown
  if (!saving.value) {
    props.modal.onClose();
  }
}

async function ignoreCheck() {
  const spec = {
    componentHealth: props.row.componentHealthName,
    checkKey:        props.row.checkName,
  };

  // the rule only lists the selected resources, so it does not swallow the ones coming later
  if (scope.value === 'resources') {
    spec.resources = selectedResources.value;
  }

  const days = IGNORE_DURATION_DAYS[duration.value];

  if (days) {
    spec.expiresAt = dayjs().add(days, 'day').toISOString();
  }

  if (reason.value) {
    spec.reason = reason.value;
  }

  errors.value = [];
  saving.value = true;

  try {
    const rule = await store.dispatch('harvester/create', {
      type:     HCI.HEALTH_IGNORE_RULE,
      metadata: {
        generateName: 'ignore-',
        labels:       { [IGNORE_RULE_SOURCE_LABEL]: 'user' },
      },
      spec,
    });

    await rule.save();

    store.dispatch('growl/success', {
      title:   t('generic.notification.title.succeed'),
      message: t('harvester.dashboard.sections.componentHealth.ignore.success', { name: props.row.checkName }),
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
    :title="t('harvester.dashboard.sections.componentHealth.ignore.title', { name: row.checkName })"
    data-testid="component-health-ignore-modal"
    @close="close"
    @primary-action="ignoreCheck"
  >
    <RadioGroup
      v-if="activeResources.length"
      v-model:value="scope"
      name="ignore-scope"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.scope')"
      :options="scopeOptions"
    />
    <LabeledSelect
      v-if="scope === 'resources' && activeResources.length"
      class="ignore-resources"
      :value="selectedResources"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.resources')"
      :options="activeResources"
      :multiple="true"
      :close-on-select="false"
      :clearable="false"
      @update:value="selected = $event"
    />
    <RadioGroup
      v-model:value="duration"
      name="ignore-duration"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.duration')"
      :options="durationOptions"
    />
    <LabeledInput
      v-model:value="reason"
      :label="t('harvester.dashboard.sections.componentHealth.ignore.reason')"
      :placeholder="t('harvester.dashboard.sections.componentHealth.ignore.reasonPlaceholder')"
    />
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      class="m-0"
      color="error"
      :label="err"
    />

    <template #primary-action="{ primaryAction }">
      <RcButton
        variant="primary"
        size="large"
        :disabled="!canIgnore || saving"
        :aria-busy="saving"
        data-testid="component-health-ignore-confirm"
        @click="primaryAction"
      >
        {{ t('harvester.dashboard.sections.componentHealth.ignore.action') }}
      </RcButton>
    </template>
  </RcModal>
</template>

<style lang="scss" scoped>
  // the modal's body is a flex column, it would squeeze a select with a lot of resources instead of scrolling
  .ignore-resources {
    flex-shrink: 0;
  }
</style>
