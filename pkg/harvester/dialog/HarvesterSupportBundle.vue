<script>
import { NAMESPACE } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { exceptionToErrorsArray, stringify } from '@shell/utils/error';
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton';
import GraphCircle from '@shell/components/graph/Circle';
import { Banner } from '@components/Banner';
import AppModal from '@shell/components/AppModal';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import UnitInput from '@shell/components/form/UnitInput';
import { HCI } from '../types';
import { HCI_SETTING } from '../config/settings';
import { DOC } from '../config/doc-links';
import { docLink } from '../utils/feature-flags';

const SELECT_ALL = 'select_all';
const UNSELECT_ALL = 'unselect_all';

export default {
  name: 'SupportBundle',

  components: {
    LabeledInput,
    GraphCircle,
    AsyncButton,
    Banner,
    AppModal,
    LabeledSelect,
    UnitInput
  },

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: NAMESPACE });

    try {
      const url = this.$store.getters['harvester-common/getHarvesterClusterUrl']('v1/harvester/namespaces?link=supportbundle');
      const response = await this.$store.dispatch('harvester/request', { url });

      this.defaultNamespaces = response.data || [];
    } catch (error) {
      this.defaultNamespaces = [];
    }
  },

  data() {
    return {
      isOpen:            false,
      errors:            [],
      version:           '',
      clusterName:       '',
      url:               '',
      description:       '',
      namespaces:        [],
      defaultNamespaces: [],
      timeout:           '',
      expiration:        '',
      nodeTimeout:       '',
    };
  },

  computed: {
    bundlePending() {
      return this.$store.getters['harvester-common/isBundlePending'];
    },

    isShowBundleModal() {
      return this.$store.getters['harvester-common/isShowBundleModal'];
    },

    percentage() {
      return this.$store.getters['harvester-common/getBundlePercentage'];
    },

    availableNamespaces() {
      const allNamespaces = this.$store.getters['harvester/all'](NAMESPACE).map((ns) => ns.id);
      const defaultNamespacesIds = this.defaultNamespaces.map((ns) => ns.id);

      return allNamespaces.filter((ns) => !defaultNamespacesIds.includes(ns) || this.namespaces.includes(ns));
    },

    namespaceOptions() {
      if (this.availableNamespaces.length === 0) return [];

      const allSelected = this.namespaces.length === this.availableNamespaces.length &&
      this.availableNamespaces.every((ns) => this.namespaces.includes(ns));

      const controlOption = allSelected ? { label: this.t('harvester.modal.bundle.namespaces.unselectAll'), value: UNSELECT_ALL } : { label: this.t('harvester.modal.bundle.namespaces.selectAll'), value: SELECT_ALL };

      return [controlOption, ...this.availableNamespaces];
    },

    docLink() {
      const version = this.$store.getters['harvester-common/getServerVersion']();

      return docLink(DOC.SUPPORT_BUNDLE_NAMESPACES, version);
    },

    customSupportBundleFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('customSupportBundle');
    },
  },

  watch: {
    isShowBundleModal: {
      immediate: true,
      handler(show) {
        this.isOpen = show;
      }
    },

    isOpen(newVal) {
      if (newVal) {
        this.loadDefaultSettings();
      } else {
        this.resetForm();
      }
    },
  },

  methods: {
    stringify,

    close() {
      this.isOpen = false;
      this.$store.commit('harvester-common/toggleBundleModal', false);
    },

    loadDefaultSettings() {
      const cluster = this.$store.getters['currentCluster'];
      const versionSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SERVER_VERSION);
      const namespacesSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SUPPORT_BUNDLE_NAMESPACES);
      const timeoutSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SUPPORT_BUNDLE_TIMEOUT);
      const expirationSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SUPPORT_BUNDLE_EXPIRATION);
      const nodeTimeoutSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SUPPORT_BUNDLE_NODE_COLLECTION_TIMEOUT);

      this.version = versionSetting?.currentVersion || '';
      this.clusterName = cluster?.id || '';
      this.namespaces = (namespacesSetting?.value ?? namespacesSetting?.default ?? '').split(',').map((ns) => ns.trim()).filter((ns) => ns);
      this.timeout = timeoutSetting?.value ?? timeoutSetting?.default ?? '';
      this.expiration = expirationSetting?.value ?? expirationSetting?.default ?? '';
      this.nodeTimeout = nodeTimeoutSetting?.value ?? nodeTimeoutSetting?.default ?? '';
      this.url = '';
      this.description = '';
      this.errors = [];
    },

    resetForm() {
      this.url = '';
      this.description = '';
      this.namespaces = [];
      this.timeout = '';
      this.expiration = '';
      this.nodeTimeout = '';
      this.errors = [];
    },

    updateNamespaces(selected) {
      if (selected.includes(SELECT_ALL)) {
        this.namespaces = [...this.availableNamespaces];
      } else if (selected.includes(UNSELECT_ALL)) {
        this.namespaces = [];
      } else {
        this.namespaces = selected.filter((val) => val !== SELECT_ALL && val !== UNSELECT_ALL);
      }
    },

    updateNumberValue(field, value) {
      if (value === '' || value === null || isNaN(value)) {
        this[field] = '';

        return;
      }

      const num = Number(value);
      const isValid = Number.isInteger(num) && num >= 0;

      this[field] = isValid ? String(num) : '';
    },

    onKeyDown(e) {
      if (['e', 'E', '+', '-', '.'].includes(e.key)) {
        e.preventDefault();
      }
    },

    async save(buttonCb) {
      this.errors = [];

      const name = `bundle-${ this.clusterName }-${ this.version }-${ randomStr(5).toLowerCase() }`;
      const namespace = 'harvester-system';

      const spec = {
        description: this.description.trim(),
        ...(this.url.trim() && { issueURL: this.url.trim() }),
        ...(this.namespaces.length > 0 && { extraCollectionNamespaces: this.namespaces }),
        ...(this.timeout !== '' && { timeout: Number(this.timeout) }),
        ...(this.expiration !== '' && { expiration: Number(this.expiration) }),
        ...(this.nodeTimeout !== '' && { nodeTimeout: Number(this.nodeTimeout) }),
      };

      const bundleCrd = {
        apiVersion: 'harvesterhci.io/v1beta1',
        type:       HCI.SUPPORT_BUNDLE,
        kind:       'SupportBundle',
        metadata:   { name, namespace },
        spec,
      };

      try {
        const inStore = this.$store.getters['currentProduct'].inStore;
        const bundleValue = await this.$store.dispatch(`${ inStore }/create`, bundleCrd);

        await bundleValue.save();

        this.$store.commit('harvester-common/setLatestBundleId', `${ namespace }/${ name }`, { root: true });
        this.$store.dispatch('harvester-common/bundleProgress', { root: true });
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        buttonCb(false);
      }
    },
  }
};
</script>

<template>
  <div class="bundleModal">
    <app-modal
      v-if="isOpen"
      name="bundle-modal"
      custom-class="bundleModal"
      :click-to-close="false"
      :width="550"
      :height="390"
      class="remove-modal support-modal"
      @close="close"
    >
      <div class="p-20">
        <h2>{{ t('harvester.modal.bundle.title') }}</h2>
        <div class="content">
          <div
            v-if="bundlePending"
            class="circle mb-20"
          >
            <GraphCircle
              primary-stroke-color="green"
              secondary-stroke-color="lightgrey"
              :stroke-width="6"
              :percentage="percentage"
              :show-text="true"
            />
          </div>
          <template v-else>
            <p
              v-if="customSupportBundleFeatureEnabled"
              v-clean-html="t('harvester.modal.bundle.tip', { doc: docLink }, true)"
              class="mb-20"
            />
            <LabeledInput
              v-model:value="url"
              :label="t('harvester.modal.bundle.url')"
              class="mb-10"
            />
            <LabeledInput
              v-model:value="description"
              required
              :label="t('harvester.modal.bundle.description')"
              type="multiline"
              :min-height="80"
              class="mb-10"
            />

            <template v-if="customSupportBundleFeatureEnabled">
              <LabeledSelect
                v-model:value="namespaces"
                :label="t('harvester.modal.bundle.namespaces.label')"
                :clearable="true"
                :multiple="true"
                :append-to-body="false"
                :options="namespaceOptions"
                class="mb-10 namespace-select"
                :tooltip="t('harvester.modal.bundle.namespaces.tooltip', _, true)"
                @update:value="updateNamespaces"
              />
              <UnitInput
                v-model:value="timeout"
                :label="t('harvester.modal.bundle.timeout.label')"
                class="mb-10"
                type="number"
                :min="0"
                :tooltip="t('harvester.modal.bundle.timeout.tooltip', _, true)"
                :suffix="timeout > 1 ? 'Minutes' : 'Minute'"
                @keydown="onKeyDown"
                @update:value="val => updateNumberValue('timeout', val)"
              />
              <UnitInput
                v-model:value="expiration"
                :label="t('harvester.modal.bundle.expiration.label')"
                class="mb-10"
                type="number"
                :min="0"
                :tooltip="t('harvester.modal.bundle.expiration.tooltip', _, true)"
                :suffix="expiration > 1 ? 'Minutes' : 'Minute'"
                @keydown="onKeyDown"
                @update:value="val => updateNumberValue('expiration', val)"
              />
              <UnitInput
                v-model:value="nodeTimeout"
                :label="t('harvester.modal.bundle.nodeTimeout.label')"
                class="mb-10"
                type="number"
                :min="0"
                :tooltip="t('harvester.modal.bundle.nodeTimeout.tooltip', _, true)"
                :suffix="nodeTimeout > 1 ? 'Minutes' : 'Minute'"
                @keydown="onKeyDown"
                @update:value="val => updateNumberValue('nodeTimeout', val)"
              />
            </template>
          </template>
          <div
            v-for="(err, idx) in errors"
            :key="idx"
          >
            <Banner
              color="error"
              :label="stringify(err)"
            />
          </div>
          <div class="footer mt-20">
            <button
              class="btn btn-sm role-secondary mr-10"
              @click="close"
            >
              {{ t('generic.close') }}
            </button>
            <AsyncButton
              type="submit"
              mode="generate"
              class="btn btn-sm bg-primary"
              :disabled="bundlePending"
              @click="save"
            />
          </div>
        </div>
      </div>
    </app-modal>
  </div>
</template>

<style lang="scss" scoped>
.bundleModal {
  .support-modal {
    border-radius: var(--border-radius);
    max-height: 100vh;
  }

  .labeled-select.taggable ::v-deep(.vs__selected-options .vs__selected.vs__selected > button) {
    margin: 0 7px;
  }

  .bundle {
    cursor: pointer;
    color: var(--primary);
  }

  .icon-spinner {
    font-size: 100px;
  }

  .content {
    .circle {
      padding: 10px 0;
      height: 160px;
    }
    .namespace-select {
      :deep(.vs__dropdown-menu) {
        max-height: 210px;
      }
    }
  }

  div {
    line-height: normal;
  }

  .footer {
    display: flex;
    justify-content: center;
  }
}
</style>
