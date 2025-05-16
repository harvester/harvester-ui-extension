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
import { HCI } from '../types';
import { HCI_SETTING } from '../config/settings';

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
    LabeledSelect
  },

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: NAMESPACE });
  },

  data() {
    const versionSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SERVER_VERSION);
    const bundleNsSetting = this.$store.getters['harvester/byId'](HCI.SETTING, HCI_SETTING.SUPPORT_BUNDLE_NAMESPACES);
    const cluster = this.$store.getters['currentCluster'];

    return {
      isOpen:      false,
      errors:      [],
      namespaces:  (bundleNsSetting?.value || '').split(',').map((ns) => ns.trim()),
      url:         '',
      description: '',
      version:     versionSetting?.currentVersion || '',
      clusterName: cluster?.id || '',
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

    allNamespaces() {
      return this.$store.getters['harvester/all'](NAMESPACE)
        .map((ns) => ({ label: ns.id, value: ns.id }));
    },

    allNamespaceValues() {
      return this.allNamespaces.map((ns) => ns.value);
    },

    namespaceOptions() {
      const allSelected = this.namespaces.length === this.allNamespaceValues.length &&
                          this.allNamespaceValues.every((val) => this.namespaces.includes(val));

      const controlOption = allSelected ? { label: this.t('harvester.modal.bundle.namespace.unselectAll'), value: UNSELECT_ALL } : { label: this.t('harvester.modal.bundle.namespace.selectAll'), value: SELECT_ALL };

      return [controlOption, ...this.allNamespaces];
    }
  },

  watch: {
    isShowBundleModal: {
      immediate: true,
      handler(show) {
        this.isOpen = show;

        if (!show) {
          this.resetForm();
        }
      }
    },
  },

  methods: {
    stringify,

    close() {
      this.isOpen = false;
      this.$store.commit('harvester-common/toggleBundleModal', false);
      this.resetForm();
    },

    resetForm() {
      this.url = '';
      this.description = '';
      this.namespaces = [];
    },

    updateNamespaces(selected) {
      if (selected.includes(SELECT_ALL)) {
        this.namespaces = [...this.allNamespaceValues];
      } else if (selected.includes(UNSELECT_ALL)) {
        this.namespaces = [];
      } else {
        this.namespaces = selected.filter((val) => val !== SELECT_ALL && val !== UNSELECT_ALL);
      }
    },

    async save(buttonCb) {
      this.errors = [];
      const name = `bundle-${ this.clusterName }-${ this.version }-${ randomStr(5).toLowerCase() }`;
      const namespace = this.namespaces.join(',');

      const bundleCrd = {
        apiVersion: 'harvesterhci.io/v1beta1',
        type:       HCI.SUPPORT_BUNDLE,
        kind:       'SupportBundle',
        metadata:   {
          name,
          namespace
        },
        spec: {
          issueURL:    this.url,
          description: this.description
        }
      };

      const inStore = this.$store.getters['currentProduct'].inStore;
      const bundleValue = await this.$store.dispatch(`${ inStore }/create`, bundleCrd);

      try {
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
        <h2>
          {{ t('harvester.modal.bundle.title') }}
        </h2>

        <div
          v-if="!bundlePending"
          class="content"
        >
          <LabeledSelect
            v-model:value="namespaces"
            :clearable="true"
            :multiple="true"
            :options="namespaceOptions"
            label-key="nameNsDescription.namespace.label"
            class="mb-20 label-select"
            @update:value="updateNamespaces"
          />
          <LabeledInput
            v-model:value="url"
            :label="t('harvester.modal.bundle.url')"
            class="mb-20"
          />
          <LabeledInput
            v-model:value="description"
            :label="t('harvester.modal.bundle.description')"
            type="multiline"
            :min-height="120"
            required
          />
        </div>

        <div
          v-else
          class="content"
        >
          <div class="circle">
            <GraphCircle
              primary-stroke-color="green"
              secondary-stroke-color="white"
              :stroke-width="6"
              :percentage="percentage"
              :show-text="true"
            />
          </div>
        </div>

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
      padding-top: 20px;
      height: 160px;
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
