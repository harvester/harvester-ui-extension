<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../types';
import { FORKLIFT_NAMESPACE } from '../../config/harvester-map';

const CREATE_NEW = '__create_new__';

const props = defineProps({
  stepData:   { type: Object, required: true },
  createOnly: { type: Boolean, default: false },
  editMode:   { type: Boolean, default: false },
});

const emit = defineEmits(['complete', 'ready', 'form-valid', 'testing']);

const store = useStore();
const { t } = useI18n(store);

const allProviders = ref([]);
const allSecrets = ref([]);
const selectedProvider = ref(CREATE_NEW);
const providerName = ref('');
const url = ref('');
const username = ref('');
const password = ref('');
const skipTlsVerify = ref(false);
const testResult = ref(null);
const testError = ref(null);
const errors = ref([]);
const testBtnRef = ref(null);
const createdProvider = ref(null);
const createdSecret = ref(null);
const loading = ref(true);
const testPassed = ref(false);
const testing = ref(false);

// Restore state from stepData on mount
selectedProvider.value = props.stepData.selectedProvider;
providerName.value = props.stepData.providerName;
url.value = props.stepData.url;
username.value = props.stepData.username;
password.value = props.stepData.password;
skipTlsVerify.value = props.stepData.skipTlsVerify;
testPassed.value = props.stepData.testPassed;
testResult.value = props.stepData.testResult;
testError.value = props.stepData.testError;
createdProvider.value = props.stepData.createdProvider;
createdSecret.value = props.stepData.createdSecret;

// Sync state back to stepData
watch(selectedProvider, (val) => {
  props.stepData.selectedProvider = val;
});
watch(providerName, (val) => {
  props.stepData.providerName = val;
});
watch(url, (val) => {
  props.stepData.url = val;
});
watch(username, (val) => {
  props.stepData.username = val;
});
watch(password, (val) => {
  props.stepData.password = val;
});
watch(skipTlsVerify, (val) => {
  props.stepData.skipTlsVerify = val;
});
watch(testPassed, (val) => {
  props.stepData.testPassed = val;
});
watch(testResult, (val) => {
  props.stepData.testResult = val;
});
watch(testError, (val) => {
  props.stepData.testError = val;
});
watch(createdProvider, (val) => {
  props.stepData.createdProvider = val;
});
watch(createdSecret, (val) => {
  props.stepData.createdSecret = val;
});

const isExistingProvider = computed(() => selectedProvider.value !== CREATE_NEW);
const isFormValid = computed(() => !!providerName.value && !!url.value && !!username.value && !!password.value);

const providerOptions = computed(() => {
  const options = [
    { label: t('harvester.addons.vmMigration.configureProvider.createNew'), value: CREATE_NEW }
  ];

  allProviders.value.forEach((p) => {
    if (!p.spec?.url) {
      return;
    }

    const secretRef = p.spec?.secret;

    if (secretRef) {
      const secret = allSecrets.value.find(
        (s) => s.metadata.name === secretRef.name && s.metadata.namespace === secretRef.namespace
      );

      if (!secret?.data?.user || !secret?.data?.password) {
        return;
      }
    } else {
      return;
    }

    options.push({
      label: p.metadata.name,
      value: p.metadata.name,
    });
  });

  return options;
});

// When the provider selection changes, populate or clear the fields
watch(selectedProvider, (val) => {
  testPassed.value = false;
  testResult.value = null;
  testError.value = null;

  if (val === CREATE_NEW) {
    providerName.value = '';
    url.value = '';
    username.value = '';
    password.value = '';
    skipTlsVerify.value = false;
    createdProvider.value = null;
    createdSecret.value = null;
  } else {
    const provider = allProviders.value.find(
      (p) => p.metadata.name === val && p.metadata.namespace === FORKLIFT_NAMESPACE
    );

    if (provider) {
      providerName.value = provider.metadata.name;
      url.value = provider.spec?.url || '';

      const secretRef = provider.spec?.secret;

      if (secretRef) {
        const secret = allSecrets.value.find(
          (s) => s.metadata.name === secretRef.name && s.metadata.namespace === secretRef.namespace
        );

        if (secret?.data) {
          username.value = atob(secret.data.user || '');
          password.value = atob(secret.data.password || '');
          skipTlsVerify.value = atob(secret.data.insecureSkipVerify || '') === 'true';
        }
      }

      createdProvider.value = provider;
    }
  }
});

// Reset test state when any field changes (only for create new)
watch([providerName, url, username, password], () => {
  if (!isExistingProvider.value) {
    testPassed.value = false;
    testResult.value = null;
  }
});

// Emit ready/complete when testPassed changes
watch(testPassed, (val) => {
  emit('ready', val);
  if (val) {
    emit('complete', { providerName: providerName.value, provider: createdProvider.value });
  }
}, { immediate: true });

// Emit form-valid when form validity changes
watch(isFormValid, (val) => {
  emit('form-valid', val);
}, { immediate: true });

watch(testing, (val) => {
  emit('testing', val);
}, { immediate: true });

const testConnection = async(buttonCb) => {
  testResult.value = null;
  testError.value = null;
  testing.value = true;

  if (!providerName.value || !url.value || !username.value || !password.value) {
    testError.value = t('harvester.addons.vmMigration.configureProvider.testMissingFields');
    testing.value = false;
    buttonCb(false);

    return;
  }

  const inStore = store.getters['currentProduct'].inStore;

  // Edit mode: update existing provider URL + secret, then poll
  if (props.editMode && createdProvider.value) {
    try {
      const namespace = FORKLIFT_NAMESPACE;

      createdProvider.value.spec.url = url.value;
      await createdProvider.value.save();

      const secretRef = createdProvider.value.spec?.secret;

      if (secretRef && createdSecret.value) {
        createdSecret.value.data = {
          user:               btoa(username.value),
          password:           btoa(password.value),
          insecureSkipVerify: btoa(String(skipTlsVerify.value)),
          url:                btoa(url.value),
        };
        await createdSecret.value.save();
      }

      const maxAttempts = 15;
      let attempts = 0;
      let connected = false;
      let errorMsg = '';

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        const refreshed = await store.dispatch(`${ inStore }/find`, {
          type: HCI.FORKLIFT_PROVIDER,
          id:   `${ namespace }/${ providerName.value }`,
          opt:  { force: true }
        });

        const conditions = refreshed?.status?.conditions || [];
        const readyCondition = conditions.find((c) => c.type === 'Ready');
        const connectionCondition = conditions.find((c) => c.type === 'ConnectionTestSucceeded');

        if (connectionCondition) {
          if (connectionCondition.status === 'True') {
            connected = true;
            break;
          } else {
            errorMsg = connectionCondition.message || t('harvester.addons.vmMigration.errors.connectionFailed');
            break;
          }
        }

        if (readyCondition) {
          if (readyCondition.status === 'True') {
            connected = true;
            break;
          } else if (readyCondition.status === 'False') {
            errorMsg = readyCondition.message || t('harvester.addons.vmMigration.errors.providerNotReady');
            break;
          }
        }
      }

      if (connected) {
        testPassed.value = true;
        testResult.value = t('harvester.addons.vmMigration.configureProvider.testSuccess');
        testing.value = false;
        buttonCb(true);
      } else {
        testError.value = errorMsg || t('harvester.addons.vmMigration.configureProvider.testTimeout');
        testing.value = false;
        buttonCb(false);
      }
    } catch (err) {
      testError.value = err.message || t('harvester.addons.vmMigration.configureProvider.testFailed');
      testing.value = false;
      buttonCb(false);
    }

    return;
  }

  // For existing providers, just poll for Ready/ConnectionTestSucceeded status
  if (isExistingProvider.value) {
    try {
      const namespace = FORKLIFT_NAMESPACE;
      const maxAttempts = 15;
      let attempts = 0;
      let connected = false;
      let errorMsg = '';

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        const refreshed = await store.dispatch(`${ inStore }/find`, {
          type: HCI.FORKLIFT_PROVIDER,
          id:   `${ namespace }/${ providerName.value }`,
          opt:  { force: true }
        });

        const conditions = refreshed?.status?.conditions || [];
        const readyCondition = conditions.find((c) => c.type === 'Ready');
        const connectionCondition = conditions.find((c) => c.type === 'ConnectionTestSucceeded');

        if (connectionCondition) {
          if (connectionCondition.status === 'True') {
            connected = true;
            break;
          } else {
            errorMsg = connectionCondition.message || t('harvester.addons.vmMigration.errors.connectionFailed');
            break;
          }
        }

        if (readyCondition) {
          if (readyCondition.status === 'True') {
            connected = true;
            break;
          } else if (readyCondition.status === 'False') {
            errorMsg = readyCondition.message || t('harvester.addons.vmMigration.errors.providerNotReady');
            break;
          }
        }
      }

      if (connected) {
        testPassed.value = true;
        testResult.value = t('harvester.addons.vmMigration.configureProvider.testSuccess');
        testing.value = false;
        buttonCb(true);
      } else {
        testError.value = errorMsg || t('harvester.addons.vmMigration.configureProvider.testTimeout');
        testing.value = false;
        buttonCb(false);
      }
    } catch (err) {
      testError.value = err.message || t('harvester.addons.vmMigration.configureProvider.testFailed');
      testing.value = false;
      buttonCb(false);
    }

    return;
  }

  // For new providers, create provider + secret then poll
  try {
    // Delete previous provider (cascades to secret via ownerReferences)
    if (createdProvider.value) {
      await createdProvider.value.remove();
      createdProvider.value = null;
      createdSecret.value = null;
    } else if (createdSecret.value) {
      await createdSecret.value.remove();
      createdSecret.value = null;
    }

    const namespace = FORKLIFT_NAMESPACE;
    const secretName = `${ providerName.value }-creds-${ randomStr(4).toLowerCase() }`;

    // Create Provider first so we have its UID for the ownerReference on the Secret
    const provider = await store.dispatch(`${ inStore }/create`, {
      type:     HCI.FORKLIFT_PROVIDER,
      metadata: {
        name: providerName.value,
        namespace,
      },
      spec: {
        type:   'vsphere',
        url:    url.value,
        secret: {
          name: secretName,
          namespace,
        },
      }
    });

    await provider.save();
    createdProvider.value = provider;

    // Create Secret with ownerReference already set (avoids an extra PUT)
    const newSecret = await store.dispatch(`${ inStore }/create`, {
      type:     SECRET,
      metadata: {
        name:            secretName,
        namespace,
        labels:          { 'ui.forklift/created-for-resource-type': 'forklift.konveyor.io.provider' },
        ownerReferences: [
          {
            apiVersion:         'forklift.konveyor.io/v1beta1',
            kind:               'Provider',
            name:               provider.metadata.name,
            uid:                provider.metadata.uid,
            blockOwnerDeletion: true,
          },
        ],
      }
    });

    newSecret['_type'] = 'Opaque';
    newSecret['data'] = {
      user:               btoa(username.value),
      password:           btoa(password.value),
      insecureSkipVerify: btoa(String(skipTlsVerify.value)),
      url:                btoa(url.value),
    };

    await newSecret.save();
    createdSecret.value = newSecret;

    const maxAttempts = 15;
    let attempts = 0;
    let connected = false;
    let errorMsg = '';

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const refreshed = await store.dispatch(`${ inStore }/find`, {
        type: HCI.FORKLIFT_PROVIDER,
        id:   `${ namespace }/${ providerName.value }`,
        opt:  { force: true }
      });

      const conditions = refreshed?.status?.conditions || [];
      const readyCondition = conditions.find((c) => c.type === 'Ready');
      const connectionCondition = conditions.find((c) => c.type === 'ConnectionTestSucceeded');

      if (connectionCondition) {
        if (connectionCondition.status === 'True') {
          connected = true;
          break;
        } else {
          errorMsg = connectionCondition.message || t('harvester.addons.vmMigration.errors.connectionFailed');
          break;
        }
      }

      if (readyCondition) {
        if (readyCondition.status === 'True') {
          connected = true;
          break;
        } else if (readyCondition.status === 'False') {
          errorMsg = readyCondition.message || t('harvester.addons.vmMigration.errors.providerNotReady');
          break;
        }
      }
    }

    if (connected) {
      testPassed.value = true;
      testResult.value = t('harvester.addons.vmMigration.configureProvider.testSuccess');
      testing.value = false;
      buttonCb(true);
    } else {
      if (createdProvider.value) {
        await createdProvider.value.remove();
        createdProvider.value = null;
        createdSecret.value = null;
      } else if (createdSecret.value) {
        await createdSecret.value.remove();
        createdSecret.value = null;
      }

      testError.value = errorMsg || t('harvester.addons.vmMigration.configureProvider.testTimeout');
      testing.value = false;
      buttonCb(false);
    }
  } catch (err) {
    if (createdProvider.value) {
      try {
        await createdProvider.value.remove();
      } catch (e) {}
      createdProvider.value = null;
    }
    if (createdSecret.value) {
      try {
        await createdSecret.value.remove();
      } catch (e) {}
      createdSecret.value = null;
    }

    testError.value = err.message || t('harvester.addons.vmMigration.configureProvider.testFailed');
    testing.value = false;
    buttonCb(false);
  }
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  try {
    allProviders.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });

    allSecrets.value = await store.dispatch(`${ inStore }/findAll`, {
      type: SECRET,
      opt:  { labelSelector: `ui.forklift/created-for-resource-type=${ HCI.FORKLIFT_PROVIDER }` }
    });
  } catch (e) {
    errors.value = [e?.message || t('harvester.addons.vmMigration.errors.failedLoadProviders')];
  }

  loading.value = false;
};

init();

const clickTestButton = () => {
  testBtnRef.value?.$el?.click();
};

defineExpose({ testConnection, clickTestButton });
</script>

<template>
  <div class="configure-provider-step">
    <p class="text-deemphasized line-height-20">
      {{ t('harvester.addons.vmMigration.configureProvider.description') }}
    </p>

    <div class="configure-provider-step-content">
      <h3 class="table-title m-0">
        <b>{{ t('harvester.addons.vmMigration.configureProvider.connectionDetails') }}</b>
      </h3>

      <Banner
        class="requirements-banner m-0"
        color="info"
      >
        <div class="requirements-banner-content">
          <span class="requirements-banner-title">{{ t('harvester.addons.vmMigration.configureProvider.requirementsTitle') }}</span>
          <br>
          <span>{{ t('harvester.addons.vmMigration.configureProvider.requirementsText') }}</span>
        </div>
      </Banner>

      <div class="configure-provider-step-form">
        <div v-if="!createOnly && !editMode">
          <LabeledSelect
            v-model:value="selectedProvider"
            :label="t('harvester.addons.vmMigration.configureProvider.providerSelect')"
            :options="providerOptions"
            :reduce="(opt) => opt.value"
          />
        </div>

        <div
          v-if="!isExistingProvider || editMode"
        >
          <LabeledInput
            v-model:value="providerName"
            :label="t('harvester.addons.vmMigration.configureProvider.name')"
            :disabled="editMode"
            required
          />
        </div>

        <div>
          <LabeledInput
            v-model:value="url"
            :label="t('harvester.addons.vmMigration.configureProvider.urlLabel')"
            :placeholder="t('harvester.addons.vmMigration.configureProvider.urlPlaceholder')"
            :disabled="isExistingProvider && !editMode"
            required
          />
          <p class="text-deemphasized mt-5">
            {{ t('harvester.addons.vmMigration.configureProvider.urlHint') }}
          </p>
        </div>

        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value="username"
              :label="t('harvester.addons.vmMigration.fields.username')"
              :disabled="isExistingProvider && !editMode"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="password"
              type="password"
              :label="t('harvester.addons.vmMigration.fields.password')"
              :disabled="isExistingProvider && !editMode"
              required
            />
          </div>
        </div>

        <div>
          <Checkbox
            v-model:value="skipTlsVerify"
            :label="t('harvester.addons.vmMigration.configureProvider.skipSsl')"
            :disabled="isExistingProvider && !editMode"
          />
          <p class="text-deemphasized ml-20">
            {{ t('harvester.addons.vmMigration.configureProvider.skipSslHint') }}
          </p>
        </div>
        <div>
          <AsyncButton
            ref="testBtnRef"
            mode="test"
            :disabled="!isFormValid"
            :action-label="t('harvester.addons.vmMigration.configureProvider.testConnection.action')"
            :waiting-label="t('harvester.addons.vmMigration.configureProvider.testConnection.waiting')"
            :success-label="t('harvester.addons.vmMigration.configureProvider.testConnection.success')"
            :error-label="t('harvester.addons.vmMigration.configureProvider.testConnection.error')"
            :action-color="'role-secondary'"
            :waiting-color="'role-disabled'"
            @click="testConnection"
          />
        </div>

        <Banner
          v-if="testResult"
          color="success"
        >
          {{ testResult }}
        </Banner>
        <Banner
          v-if="testError"
          color="error"
        >
          {{ testError }}
        </Banner>
        <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
        >
          {{ err }}
        </Banner>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .requirements-banner {
    font-weight: 400;

    .requirements-banner-title {
      font-weight: 600;
    }
  }

  .configure-provider-step {
    display: flex;
    flex-direction: column;
    gap: 24px;

    .line-height-20 {
      line-height: 20px;
    }

    .configure-provider-step-content {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .configure-provider-step-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
    }

    :deep(.checkbox-label) {
      color: var(--body-text);
    }
  }
</style>
