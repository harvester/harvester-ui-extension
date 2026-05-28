<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import CruResource from '@shell/components/CruResource';
import { useI18n } from '@shell/composables/useI18n';
import ConfigureProviderStep from '../../../../components/vm-migration/ConfigureProviderStep';
import SelectVmsStep from '../../../../components/vm-migration/SelectVmsStep';
import ConfigureMappingsStep from '../../../../components/vm-migration/ConfigureMappingsStep';
import ReviewMigrationStep from '../../../../components/vm-migration/ReviewMigrationStep';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { currentRouter } from '../../../../utils/router';

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
  review: { planName: '' },
});

const steps = reactive([
  {
    name:    'configure-provider',
    label:   '',
    subtext: '',
    ready:   false,
  },
  {
    name:    'select-vms',
    label:   '',
    subtext: '',
    ready:   false,
  },
  {
    name:    'configure-mappings',
    label:   '',
    subtext: '',
    ready:   false,
  },
  {
    name:    'review-migration',
    label:   '',
    subtext: '',
    ready:   false,
  },
]);

steps[0].label = t('harvester.addons.vmMigration.wizard.steps.configureProvider.label');
steps[0].subtext = t('harvester.addons.vmMigration.wizard.steps.configureProvider.description');
steps[1].label = t('harvester.addons.vmMigration.wizard.steps.selectVms.label');
steps[1].subtext = t('harvester.addons.vmMigration.wizard.steps.selectVms.description');
steps[2].label = t('harvester.addons.vmMigration.wizard.steps.configureMappings.label');
steps[2].subtext = t('harvester.addons.vmMigration.wizard.steps.configureMappings.description');
steps[3].label = t('harvester.addons.vmMigration.wizard.steps.reviewMigration.label');
steps[3].subtext = t('harvester.addons.vmMigration.wizard.steps.reviewMigration.description');

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

const wizardComponent = computed(() => cruRef.value?.$refs?.Wizard);

const pendingProceed = ref(false);

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
  if (oldVal.length > 0 && JSON.stringify(newVal.map((v) => v.id).sort()) !== JSON.stringify(oldVal.map((v) => v.id).sort())) {
    stepData.mappings.networkEntries = [];
    stepData.mappings.storageEntries = [];
    mappingsReady.value = false;

    stepData.review.planName = '';
    reviewReady.value = false;
  }
});

const onFinish = async(buttonCb) => {
  try {
    await reviewStepRef.value.startMigration();
    buttonCb(true);

    currentRouter().push({
      name:   `${ PRODUCT_NAME }-c-cluster-vm-migration`,
      params: {
        product: store.getters['productId'],
        cluster: store.getters['clusterId'],
      }
    });
  } catch (err) {
    errors.value = [err instanceof Error ? err.message : String(err)];
    buttonCb(false);
  }
};

const onCancel = () => {
  currentRouter().push({
    name:   `${ PRODUCT_NAME }-c-cluster-vm-migration`,
    params: {
      product: store.getters['productId'],
      cluster: store.getters['clusterId'],
    }
  });
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
