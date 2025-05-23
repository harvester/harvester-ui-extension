<script>
import { randomStr } from '@shell/utils/string';
import { exceptionToErrorsArray, stringify } from '@shell/utils/error';
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton';
import GraphCircle from '@shell/components/graph/Circle';
import { Banner } from '@components/Banner';
import AppModal from '@shell/components/AppModal';
import { HCI } from '../types';

export default {
  name: 'SupportBundle',

  components: {
    LabeledInput,
    GraphCircle,
    AsyncButton,
    Banner,
    AppModal,
  },

  data() {
    return {
      url:         '',
      description: '',
      errors:      [],
      isOpen:      false,
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
    }
  },

  watch: {
    isShowBundleModal: {
      handler(show) {
        if (show) {
          this.$nextTick(() => {
            this.isOpen = true;
          });
        } else {
          this.isOpen = false;
          this.url = '';
          this.description = '';
        }
      },
      immediate: true
    },
  },

  methods: {
    stringify,

    close() {
      this.isOpen = false;
      this.$store.commit('harvester-common/toggleBundleModal', false);
      this.backUpName = '';
    },

    async save(buttonCb) {
      this.errors = [];

      const name = `bundle-${ randomStr(5).toLowerCase() }`;
      const namespace = 'harvester-system';

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

  .bundle {
    cursor: pointer;
    color: var(--primary);
  }

  .icon-spinner {
    font-size: 100px;
  }

  .content {
    height: 218px;

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
