<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import Masthead from '@shell/components/ResourceList/Masthead';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { SCHEMA, SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { currentRouter } from '../../../../utils/router';

const schema = {
  id:         HCI.FORKLIFT_PROVIDER,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_PROVIDER,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_PROVIDER },
};

const CREATE_NEW = '__create_new__';

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
const createdProvider = ref(null);
const createdSecret = ref(null);
const loading = ref(true);
const testPassed = ref(false);
const testing = ref(false);
const saving = ref(false);

const isExistingProvider = computed(() => selectedProvider.value !== CREATE_NEW);
const isFormValid = computed(() => !!providerName.value && !!url.value && !!username.value && !!password.value);

const providerOptions = computed(() => {
  const options = [
    { label: t('harvester.addons.forklift.configureProvider.createNew'), value: CREATE_NEW }
  ];

  allProviders.value.forEach((p) => {
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
      (p) => p.metadata.name === val && p.metadata.namespace === 'forklift'
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

const cancel = () => {
  currentRouter().push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
    params: {
      product: store.getters['productId'],
      cluster: store.getters['clusterId'],
    }
  });
};

const testConnection = async(buttonCb) => {
  testResult.value = null;
  testError.value = null;
  testing.value = true;

  if (!providerName.value || !url.value || !username.value || !password.value) {
    testError.value = t('harvester.addons.forklift.configureProvider.testMissingFields');
    testing.value = false;
    buttonCb(false);

    return;
  }

  const inStore = store.getters['currentProduct'].inStore;

  // For existing providers, just poll for Ready/ConnectionTestSucceeded status
  if (isExistingProvider.value) {
    try {
      const namespace = 'forklift';
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
            errorMsg = connectionCondition.message || 'Connection failed';
            break;
          }
        }

        if (readyCondition) {
          if (readyCondition.status === 'True') {
            connected = true;
            break;
          } else if (readyCondition.status === 'False') {
            errorMsg = readyCondition.message || 'Provider not ready';
            break;
          }
        }
      }

      if (connected) {
        testPassed.value = true;
        testResult.value = t('harvester.addons.forklift.configureProvider.testSuccess');
        testing.value = false;
        buttonCb(true);
      } else {
        testError.value = errorMsg || t('harvester.addons.forklift.configureProvider.testTimeout');
        testing.value = false;
        buttonCb(false);
      }
    } catch (err) {
      testError.value = err.message || t('harvester.addons.forklift.configureProvider.testFailed');
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

    const namespace = 'forklift';
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
          errorMsg = connectionCondition.message || 'Connection failed';
          break;
        }
      }

      if (readyCondition) {
        if (readyCondition.status === 'True') {
          connected = true;
          break;
        } else if (readyCondition.status === 'False') {
          errorMsg = readyCondition.message || 'Provider not ready';
          break;
        }
      }
    }

    if (connected) {
      testPassed.value = true;
      testResult.value = t('harvester.addons.forklift.configureProvider.testSuccess');
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

      testError.value = errorMsg || t('harvester.addons.forklift.configureProvider.testTimeout');
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

    testError.value = err.message || t('harvester.addons.forklift.configureProvider.testFailed');
    testing.value = false;
    buttonCb(false);
  }
};

const saveProvider = async(buttonCb) => {
  errors.value = [];
  saving.value = true;

  if (!testPassed.value) {
    // Test hasn't passed yet — run it first
    await testConnection((success) => {
      if (success) {
        currentRouter().push({
          name:   `${ PRODUCT_NAME }-c-cluster-forklift-select-vms`,
          params: {
            product: store.getters['productId'],
            cluster: store.getters['clusterId'],
          },
          query: { provider: providerName.value }
        });
      } else {
        saving.value = false;
        buttonCb(false);
      }
    });

    return;
  }

  currentRouter().push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift-select-vms`,
    params: {
      product: store.getters['productId'],
      cluster: store.getters['clusterId'],
    },
    query: { provider: providerName.value }
  });
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  allProviders.value = await store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_PROVIDER });

  allSecrets.value = await store.dispatch(`${ inStore }/findAll`, {
    type: SECRET,
    opt:  { labelSelector: `ui.forklift/created-for-resource-type=${ HCI.FORKLIFT_PROVIDER }` }
  });
  loading.value = false;
};

init();
</script>

<template>
  <div class="configure-provider">
    <Masthead
      :schema="schema"
      :resource="schema.id"
      :type-display="t('harvester.addons.forklift.configureProvider.title')"
      :is-creatable="false"
    >
      <template #subHeader>
        <div class="mmt-5">
          <p class="text-muted">
            {{ t('harvester.addons.forklift.configureProvider.description') }}
          </p>
        </div>
      </template>
    </Masthead>

    <h3 class="mmt-3 mmb-3 table-title">
      <b>{{ t('harvester.addons.forklift.configureProvider.connectionDetails') }}</b>
    </h3>

    <Banner
      class="requirements-banner mt-0 mmb-3"
      color="info"
    >
      <div class="requirements-banner-content">
        <span class="requirements-banner-title">{{ t('harvester.addons.forklift.configureProvider.requirementsTitle') }}</span>
        <br>
        <span>{{ t('harvester.addons.forklift.configureProvider.requirementsText') }}</span>
      </div>
    </Banner>

    <div class="mb-20">
      <LabeledSelect
        v-model:value="selectedProvider"
        :label="t('harvester.addons.forklift.configureProvider.providerSelect')"
        :options="providerOptions"
        :reduce="(opt) => opt.value"
      />
    </div>

    <div
      v-if="!isExistingProvider"
      class="mb-20"
    >
      <LabeledInput
        v-model:value="providerName"
        :label="t('harvester.addons.forklift.configureProvider.name')"
        required
      />
    </div>

    <div class="mb-20">
      <LabeledInput
        v-model:value="url"
        :label="t('harvester.addons.forklift.configureProvider.urlLabel')"
        :placeholder="t('harvester.addons.forklift.configureProvider.urlPlaceholder')"
        :disabled="isExistingProvider"
        required
      />
      <p class="text-muted mt-5">
        {{ t('harvester.addons.forklift.configureProvider.urlHint') }}
      </p>
    </div>

    <div class="row mb-20">
      <div class="col span-6">
        <LabeledInput
          v-model:value="username"
          :label="t('harvester.addons.forklift.fields.username')"
          :disabled="isExistingProvider"
          required
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="password"
          type="password"
          :label="t('harvester.addons.forklift.fields.password')"
          :disabled="isExistingProvider"
          required
        />
      </div>
    </div>

    <div class="mb-20">
      <Checkbox
        v-model:value="skipTlsVerify"
        :label="t('harvester.addons.forklift.configureProvider.skipSsl')"
        :disabled="isExistingProvider"
      />
      <p class="text-muted ml-20">
        {{ t('harvester.addons.forklift.configureProvider.skipSslHint') }}
      </p>
    </div>
    <div class="mb-20">
      <button
        v-if="testPassed"
        class="btn role-secondary test-passed-btn"
        disabled
      >
        <i class="icon icon-checkmark mr-10" /> {{ t('harvester.addons.forklift.configureProvider.testConnection') }}
      </button>
      <AsyncButton
        v-else
        mode="test"
        :disabled="!isFormValid || testing || saving"
        :action-label="t('harvester.addons.forklift.configureProvider.testConnection')"
        :waiting-label="t('harvester.addons.forklift.configureProvider.testConnection')"
        :success-label="t('harvester.addons.forklift.configureProvider.testConnection')"
        :error-label="t('harvester.addons.forklift.configureProvider.testConnection')"
        class="btn role-secondary"
        @click="testConnection"
      />
    </div>

    <Banner
      v-if="testResult"
      color="success"
      class="mb-10"
    >
      {{ testResult }}
    </Banner>
    <Banner
      v-if="testError"
      color="error"
      class="mb-10"
    >
      {{ testError }}
    </Banner>
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      class="mb-10"
    >
      {{ err }}
    </Banner>

    <div class="provider-actions">
      <button
        class="btn role-secondary"
        @click="cancel"
      >
        {{ t('generic.cancel') }}
      </button>
      <AsyncButton
        :disabled="!isFormValid || testing || saving"
        :action-label="isExistingProvider ? t('harvester.addons.forklift.configureProvider.saveExisting') : t('harvester.addons.forklift.configureProvider.save')"
        :waiting-label="isExistingProvider ? t('harvester.addons.forklift.configureProvider.saveExisting') : t('harvester.addons.forklift.configureProvider.save')"
        :success-label="isExistingProvider ? t('harvester.addons.forklift.configureProvider.saveExisting') : t('harvester.addons.forklift.configureProvider.save')"
        :error-label="isExistingProvider ? t('harvester.addons.forklift.configureProvider.saveExisting') : t('harvester.addons.forklift.configureProvider.save')"
        @click="saveProvider"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .configure-provider {
    padding: 20px;
  }

  .requirements-banner {
    font-weight: 400;

    .requirements-banner-title {
      font-weight: 600;
    }
  }

  .provider-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 30px;
  }

  .test-passed-btn {
    color: var(--success) !important;
    border-color: var(--success) !important;
  }
</style>
