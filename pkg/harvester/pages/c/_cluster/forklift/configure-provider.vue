<script setup>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import Masthead from '@shell/components/ResourceList/Masthead';
import AsyncButton from '@shell/components/AsyncButton';
import { SCHEMA, SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { useI18n } from '@shell/composables/useI18n';
import { HCI } from '../../../../types';
import { PRODUCT_NAME } from '../../../../config/harvester';

const schema = {
  id:         HCI.FORKLIFT_PROVIDER,
  type:       SCHEMA,
  attributes: {
    kind:       HCI.FORKLIFT_PROVIDER,
    namespaced: true
  },
  metadata: { name: HCI.FORKLIFT_PROVIDER },
};

const store = useStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n(store);

const allSecrets = ref([]);
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

const isFormValid = computed(() => !!providerName.value && !!url.value && !!username.value && !!password.value);

// Reset test state when any field changes
watch([providerName, url, username, password], () => {
  testPassed.value = false;
  testResult.value = null;
});

const cancel = async() => {
  if (createdProvider.value) {
    await createdProvider.value.remove();
    createdProvider.value = null;
  } else if (createdSecret.value) {
    await createdSecret.value.remove();
    createdSecret.value = null;
  }

  router.push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift`,
    params: {
      product: route.params.product,
      cluster: route.params.cluster,
    }
  });
};

const testConnection = async(buttonCb) => {
  testResult.value = null;
  testError.value = null;

  if (!providerName.value || !url.value || !username.value || !password.value) {
    testError.value = t('harvester.addons.forklift.configureProvider.testMissingFields');
    buttonCb(false);

    return;
  }

  const inStore = store.getters['currentProduct'].inStore;

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
        labels:          {
          createdForProviderType: 'vsphere',
          createdForResourceType: 'providers',
        },
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
    buttonCb(false);
  }
};

const saveProvider = async(buttonCb) => {
  errors.value = [];

  if (!testPassed.value) {
    // Test hasn't passed yet — run it first
    await testConnection((success) => {
      if (success) {
        router.push({
          name:   `${ PRODUCT_NAME }-c-cluster-forklift-select-vms`,
          params: {
            product: route.params.product,
            cluster: route.params.cluster,
          },
          query: { provider: providerName.value }
        });
      } else {
        buttonCb(false);
      }
    });

    return;
  }

  router.push({
    name:   `${ PRODUCT_NAME }-c-cluster-forklift-select-vms`,
    params: {
      product: route.params.product,
      cluster: route.params.cluster,
    },
    query: { provider: providerName.value }
  });
};

const init = async() => {
  const inStore = store.getters['currentProduct'].inStore;

  allSecrets.value = await store.dispatch(`${ inStore }/findAll`, { type: SECRET });
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
          required
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="password"
          type="password"
          :label="t('harvester.addons.forklift.fields.password')"
          required
        />
      </div>
    </div>

    <div class="mb-20">
      <Checkbox
        v-model:value="skipTlsVerify"
        :label="t('harvester.addons.forklift.configureProvider.skipSsl')"
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
        :disabled="!isFormValid"
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
        :disabled="!isFormValid"
        :action-label="t('harvester.addons.forklift.configureProvider.save')"
        :waiting-label="t('harvester.addons.forklift.configureProvider.save')"
        :success-label="t('harvester.addons.forklift.configureProvider.save')"
        :error-label="t('harvester.addons.forklift.configureProvider.save')"
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
