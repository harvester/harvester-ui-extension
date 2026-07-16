<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import CruResource from '@shell/components/CruResource';
import { useI18n } from '@shell/composables/useI18n';
import ConfigureProviderStep from '@pkg/harvester/components/vm-migration/ConfigureProviderStep.vue';
import SelectVmsStep from '@pkg/harvester/components/vm-migration/SelectVmsStep.vue';
import ConfigureMappingsStep from '@pkg/harvester/components/vm-migration/ConfigureMappingsStep.vue';
import ReviewMigrationStep from '@pkg/harvester/components/vm-migration/ReviewMigrationStep.vue';
import { PRODUCT_NAME } from '@pkg/harvester/config/harvester';
import { currentRouter } from '@pkg/harvester/utils/router';
import { exceptionToErrorsArray, stringify } from '@shell/utils/error';

const store = useStore();
const { t } = useI18n(store);

const cruRef = ref(null);
const providerStepRef = ref(null);
const reviewStepRef = ref(null);

const providerName = ref('');
const provider = ref(null);
const selectedVMs = ref([]);
const errors = ref([]);

const providerReady = ref(false);
const providerFormValid = ref(false);
const providerTesting = ref(false);
const vmsReady = ref(false);
const vmsLoading = ref(true);
const mappingsReady = ref(false);
const reviewReady = ref(false);

const dummyResource = ref({ save: () => Promise.resolve() });

const stepData = reactive({
  provider: {
    selectedProvider: '__create_new__',
    providerName:     '',
    url:              '',
    username:         '',
    password:         '',
    skipTlsVerify:    false,
    testPassed:       false,
    testResult:       null,
    testError:        null,
    createdProvider:  null,
    createdSecret:    null,
  },
  vms: {
    discoveredVMs: [],
    selectedVMIds: new Set(),
    tableRows:     [],
  },
  mappings: {
    networkEntries:  [],
    storageEntries:  [],
  },
  review: { planName: '', targetNamespace: '' },
});

const steps = reactive([
  {
    name:    'configure-provider',
    label:   t('harvester.addons.vmMigration.wizard.steps.configureProvider.label'),
    subtext: t('harvester.addons.vmMigration.wizard.steps.configureProvider.description'),
    ready:   false,
  },
  {
    name:    'select-vms',
    label:   t('harvester.addons.vmMigration.wizard.steps.selectVms.label'),
    subtext: t('harvester.addons.vmMigration.wizard.steps.selectVms.description'),
    ready:   false,
  },
  {
    name:    'configure-mappings',
    label:   t('harvester.addons.vmMigration.wizard.steps.configureMappings.label'),
    subtext: t('harvester.addons.vmMigration.wizard.steps.configureMappings.description'),
    ready:   false,
  },
  {
    name:    'review-migration',
    label:   t('harvester.addons.vmMigration.wizard.steps.reviewMigration.label'),
    subtext: t('harvester.addons.vmMigration.wizard.steps.reviewMigration.description'),
    ready:   false,
  },
]);

watch([providerFormValid, providerTesting], () => {
  steps[0].ready = providerFormValid.value && !providerTesting.value;
}, { immediate: true });
watch([vmsReady, vmsLoading], () => {
  steps[1].ready = vmsReady.value && !vmsLoading.value;
});
watch(mappingsReady, (val) => {
  steps[2].ready = val;
});
watch(reviewReady, (val) => {
  steps[3].ready = val;
});

// CruResource exposes its inner Wizard via $refs; we reach into it to drive the
// "test connection before advancing" handshake, since the provider must be verified
// before the user can leave the first step.
const wizardComponent = computed(() => cruRef.value?.$refs?.Wizard);

const pendingProceed = ref(false);

// Handshake to gate step 1 -> 2 on a successful connection test:
// 1. When the user tries to advance off the provider step before it's ready,
//    snap back (goToStep is 1-based, so goToStep(1) == the provider step) and
//    programmatically trigger the async "Test connection" button.
// 2. Once the test flips `providerReady` (watcher below), mark the step ready and
//    advance to the next step (goToStep(2)). If the test fails, `providerTesting`
//    watcher clears `pendingProceed` and the user stays put.
watch(
  () => wizardComponent.value?.activeStepIndex,
  (newIdx, oldIdx) => {
    if (oldIdx === 0 && newIdx === 1 && !providerReady.value) {
      wizardComponent.value.goToStep(1);
      pendingProceed.value = true;
      providerStepRef.value.clickTestButton();
    }
  }
);

watch(providerReady, (val) => {
  if (val && pendingProceed.value) {
    pendingProceed.value = false;
    steps[0].ready = true;
    wizardComponent.value.goToStep(2);
  }
});

watch(providerTesting, (testing) => {
  if (!testing && pendingProceed.value && !providerReady.value) {
    pendingProceed.value = false;
  }
});

const onProviderComplete = (data) => {
  providerName.value = data.providerName;
  provider.value = data.provider;
  providerReady.value = true;
};

const onProviderFormValid = (valid) => {
  providerFormValid.value = valid;
};

const onProviderTesting = (testing) => {
  providerTesting.value = testing;
};

const onProviderReady = (ready) => {
  providerReady.value = ready;
};

const onVmsComplete = (data) => {
  selectedVMs.value = data.selectedVMs;
  vmsReady.value = data.selectedVMs.length > 0;
};

const onVmsLoading = (val) => {
  vmsLoading.value = val;
};

const onMappingsReady = (ready) => {
  mappingsReady.value = ready;
};

const onReviewReady = (ready) => {
  reviewReady.value = ready;
};

// Clear downstream data when provider changes
watch(() => stepData.provider.providerName, (newVal, oldVal) => {
  if (oldVal && newVal !== oldVal) {
    stepData.vms.discoveredVMs = [];
    stepData.vms.selectedVMIds = new Set();
    stepData.vms.tableRows = [];
    selectedVMs.value = [];
    vmsReady.value = false;

    stepData.mappings.networkEntries = [];
    stepData.mappings.storageEntries = [];
    mappingsReady.value = false;

    stepData.review.planName = '';
    reviewReady.value = false;
  }
});

// Clear mappings and review when VM selection changes
watch(selectedVMs, (newVal, oldVal) => {
  const newIds = new Set(newVal.map((v) => v.id));
  const oldIds = new Set(oldVal.map((v) => v.id));
  const changed = newIds.size !== oldIds.size || [...newIds].some((id) => !oldIds.has(id));

  if (oldVal.length > 0 && changed) {
    stepData.mappings.networkEntries = [];
    stepData.mappings.storageEntries = [];
    mappingsReady.value = false;

    stepData.review.planName = '';
    reviewReady.value = false;
  }
});

const migrationListLocation = {
  name:   `${ PRODUCT_NAME }-c-cluster-vm-migration`,
  params: {
    product: store.getters['productId'],
    cluster: store.getters['clusterId'],
  }
};

const onFinish = async(buttonCb) => {
  try {
    await reviewStepRef.value.startMigration();
    buttonCb(true);
    currentRouter().push(migrationListLocation);
  } catch (err) {
    errors.value = exceptionToErrorsArray(err).map((e) => {
      if (typeof e === 'string') {
        return e;
      }

      return stringify(e);
    });
    buttonCb(false);
  }
};

const onCancel = () => {
  currentRouter().push(migrationListLocation);
};
</script>

<template>
  <CruResource
    ref="cruRef"
    :resource="dummyResource"
    :mode="'create'"
    :steps="steps"
    :errors="errors"
    :validation-passed="true"
    :can-yaml="false"
    :cancel-event="true"
    finish-mode="finish"
    finish-button-mode="createAndStart"
    class="wizard"
    @cancel="onCancel"
    @finish="onFinish"
  >
    <template #configure-provider>
      <ConfigureProviderStep
        ref="providerStepRef"
        :step-data="stepData.provider"
        @complete="onProviderComplete"
        @ready="onProviderReady"
        @form-valid="onProviderFormValid"
        @testing="onProviderTesting"
      />
    </template>
    <template #select-vms>
      <SelectVmsStep
        :provider-name="providerName"
        :provider="provider"
        :step-data="stepData.vms"
        @complete="onVmsComplete"
        @loading="onVmsLoading"
      />
    </template>
    <template #configure-mappings>
      <ConfigureMappingsStep
        :provider-name="providerName"
        :provider="provider"
        :selected-vms="selectedVMs"
        :step-data="stepData.mappings"
        @ready="onMappingsReady"
      />
    </template>
    <template #review-migration>
      <ReviewMigrationStep
        ref="reviewStepRef"
        :provider-name="providerName"
        :provider="provider"
        :selected-vms="selectedVMs"
        :mapping-entries="stepData.mappings"
        :step-data="stepData.review"
        @ready="onReviewReady"
      />
    </template>
  </CruResource>
</template>
