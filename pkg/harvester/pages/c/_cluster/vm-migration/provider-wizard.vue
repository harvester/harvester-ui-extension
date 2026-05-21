<script setup>
import { reactive, ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute } from 'vue-router';
import CruResource from '@shell/components/CruResource';
import { SECRET } from '@shell/config/types';
import { useI18n } from '@shell/composables/useI18n';
import ConfigureProviderStep from '../../../../components/vm-migration/ConfigureProviderStep';
import ConfigureMappingsStep from '../../../../components/vm-migration/ConfigureMappingsStep';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { currentRouter } from '../../../../utils/router';
import { HCI } from '../../../../types';

const store = useStore();
const route = useRoute();
const { t } = useI18n(store);

const cruRef = ref(null);
const providerStepRef = ref(null);
const mappingsStepRef = ref(null);

const providerName = ref('');
const provider = ref(null);
const errors = ref([]);

const providerReady = ref(false);
const providerFormValid = ref(false);
const providerTesting = ref(false);
const mappingsReady = ref(false);

const existingNetworkMap = ref(null);
const existingStorageMap = ref(null);
const initialLoading = ref(true);

const dummyResource = ref({ save: () => Promise.resolve() });

const providerId = route.query?.providerId || null;
const isEditMode = !!providerId;

const stepData = reactive({
  provider: {
    selectedProvider: isEditMode ? '' : '__create_new__',
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
  mappings: {
    networkEntries:  [],
    storageEntries:  [],
  },
});

const steps = reactive([
  {
    name:    'configure-provider',
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
]);

steps[0].label = t('harvester.addons.vmMigration.wizard.steps.configureProvider.label');
steps[0].subtext = t('harvester.addons.vmMigration.wizard.steps.configureProvider.description');
steps[1].label = t('harvester.addons.vmMigration.wizard.steps.configureMappings.label');
steps[1].subtext = t('harvester.addons.vmMigration.wizard.steps.configureMappings.description');

watch([providerFormValid, providerTesting], () => {
  steps[0].ready = providerFormValid.value && !providerTesting.value;
}, { immediate: true });
watch(mappingsReady, (val) => {
  steps[1].ready = val;
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

const wizardTitle = computed(() => {
  return isEditMode ? t('harvester.addons.vmMigration.providerWizard.editTitle') : t('harvester.addons.vmMigration.providerWizard.title');
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

const onMappingsReady = (ready) => {
  mappingsReady.value = ready;
};

// Clear mappings when provider changes
watch(() => stepData.provider.providerName, (newVal, oldVal) => {
  if (oldVal && newVal !== oldVal) {
    stepData.mappings.networkEntries = [];
    stepData.mappings.storageEntries = [];
    mappingsReady.value = false;
  }
});

const providerListLocation = {
  name:   `${ PRODUCT_NAME }-c-cluster-resource`,
  params: {
    product:  store.getters['productId'],
    cluster:  store.getters['clusterId'],
    resource: HCI.FORKLIFT_PROVIDER,
  }
};

const onFinish = async(buttonCb) => {
  try {
    await mappingsStepRef.value.saveMappings();
    buttonCb(true);
    currentRouter().push(providerListLocation);
  } catch (err) {
    errors.value = [err instanceof Error ? err.message : String(err)];
    buttonCb(false);
  }
};

const onCancel = () => {
  currentRouter().push(providerListLocation);
};

const init = async() => {
  if (!isEditMode) {
    initialLoading.value = false;

    return;
  }

  const inStore = store.getters['currentProduct'].inStore;

  try {
    const fetchedProvider = await store.dispatch(`${ inStore }/find`, {
      type: HCI.FORKLIFT_PROVIDER,
      id:   providerId,
      opt:  { force: true },
    });

    provider.value = fetchedProvider;
    providerName.value = fetchedProvider.metadata.name;

    stepData.provider.selectedProvider = fetchedProvider.metadata.name;
    stepData.provider.providerName = fetchedProvider.metadata.name;
    stepData.provider.url = fetchedProvider.spec?.url || '';
    stepData.provider.createdProvider = fetchedProvider;

    const secretRef = fetchedProvider.spec?.secret;

    if (secretRef) {
      const allSecrets = await store.dispatch(`${ inStore }/findAll`, {
        type: SECRET,
        opt:  { labelSelector: `ui.forklift/created-for-resource-type=${ HCI.FORKLIFT_PROVIDER }` },
      });

      const secret = allSecrets.find(
        (s) => s.metadata.name === secretRef.name && s.metadata.namespace === secretRef.namespace
      );

      if (secret?.data) {
        stepData.provider.username = atob(secret.data.user || '');
        stepData.provider.password = atob(secret.data.password || '');
        stepData.provider.skipTlsVerify = atob(secret.data.insecureSkipVerify || '') === 'true';
        stepData.provider.createdSecret = secret;
      }
    }

    // Fetch existing default maps for this provider
    try {
      const allNetworkMaps = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP });
      const allStorageMaps = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP });

      existingNetworkMap.value = allNetworkMaps.find(
        (nm) => nm.metadata.name === `${ fetchedProvider.metadata.name }-network-map-default`
      ) || null;

      existingStorageMap.value = allStorageMaps.find(
        (sm) => sm.metadata.name === `${ fetchedProvider.metadata.name }-storage-map-default`
      ) || null;
    } catch (e) {
      // Maps may not exist yet
    }
  } catch (err) {
    errors.value = [`Failed to load provider: ${ err.message || err }`];
  }

  initialLoading.value = false;
};

init();
</script>

<template>
  <div v-if="initialLoading" />
  <CruResource
    v-else
    ref="cruRef"
    :resource="dummyResource"
    :mode="isEditMode ? 'edit' : 'create'"
    :steps="steps"
    :errors="errors"
    :validation-passed="true"
    :can-yaml="false"
    :cancel-event="true"
    :title="wizardTitle"
    finish-mode="finish"
    class="wizard"
    @cancel="onCancel"
    @finish="onFinish"
  >
    <template #configure-provider>
      <ConfigureProviderStep
        ref="providerStepRef"
        :step-data="stepData.provider"
        :create-only="true"
        :edit-mode="isEditMode"
        @complete="onProviderComplete"
        @ready="onProviderReady"
        @form-valid="onProviderFormValid"
        @testing="onProviderTesting"
      />
    </template>
    <template #configure-mappings>
      <ConfigureMappingsStep
        ref="mappingsStepRef"
        :provider-name="providerName"
        :provider="provider"
        :step-data="stepData.mappings"
        :use-all-provider-data="true"
        :existing-network-map="existingNetworkMap"
        :existing-storage-map="existingStorageMap"
        @ready="onMappingsReady"
      />
    </template>
  </CruResource>
</template>
