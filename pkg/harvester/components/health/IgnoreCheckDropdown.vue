<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import dayjs from 'dayjs';
import Banner from '@components/Banner/Banner.vue';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import AsyncButton from '@shell/components/AsyncButton';
import { useI18n } from '@shell/composables/useI18n';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../types';
import { IGNORE_DURATION_DAYS, IGNORE_RULE_SOURCE_LABEL, activeAffectedResourceNames } from '../../utils/component-health';

const props = defineProps({
  row: {
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

async function ignoreCheck(hide, buttonCb) {
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

    errors.value = [];
    buttonCb(true);
    hide();
  } catch (err) {
    errors.value = exceptionToErrorsArray(err?.data || err);
    buttonCb(false);
  }
}
</script>

<template>
  <v-dropdown
    :triggers="['click']"
    placement="bottom-end"
    :distance="10"
  >
    <button class="btn btn-sm role-secondary">
      {{ t('harvester.dashboard.sections.componentHealth.ignore.action') }}
    </button>

    <template #popper="{ hide }">
      <div class="ignore-popup">
        <RadioGroup
          v-if="activeResources.length"
          v-model:value="scope"
          :name="`ignore-scope-${ row.id }`"
          :label="t('harvester.dashboard.sections.componentHealth.ignore.scope')"
          :options="scopeOptions"
        />
        <LabeledSelect
          v-if="scope === 'resources' && activeResources.length"
          :value="selectedResources"
          :label="t('harvester.dashboard.sections.componentHealth.ignore.resources')"
          :options="activeResources"
          :multiple="true"
          :close-on-select="false"
          :clearable="false"
          :append-to-body="false"
          @update:value="selected = $event"
        />
        <RadioGroup
          v-model:value="duration"
          :name="`ignore-duration-${ row.id }`"
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
          color="error"
          :label="err"
        />
        <div class="text-right">
          <AsyncButton
            mode="apply"
            :action-label="t('harvester.dashboard.sections.componentHealth.ignore.action')"
            :disabled="!canIgnore"
            @click="ignoreCheck(hide, $event)"
          />
        </div>
      </div>
    </template>
  </v-dropdown>
</template>

<style lang="scss" scoped>
  .ignore-popup {
    display: grid;
    gap: 10px;
    padding: 10px;
    width: 440px;
    max-height: 420px;
    overflow-y: auto;
  }
</style>
