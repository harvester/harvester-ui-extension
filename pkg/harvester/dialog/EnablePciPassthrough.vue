<script>
import { mapGetters } from 'vuex';
import { Banner } from '@components/Banner';
import { Card } from '@components/Card';
import { Checkbox } from '@components/Form/Checkbox';
import AsyncButton from '@shell/components/AsyncButton';
import { escapeHtml } from '@shell/utils/string';
import { HCI } from '../types';
import { getHarvesterUserName } from '../utils/auth';

export default {
  name: 'HarvesterEnablePciPassthrough',

  emits: ['close'],

  components: {
    AsyncButton,
    Banner,
    Card,
    Checkbox,
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return { disableResourcePooling: false };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    disableResourcePoolingEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('disableResourcePooling');
    },
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async save(buttonCb) {
      const userName = getHarvesterUserName(this.$store.getters);

      for (let i = 0; i < this.resources.length; i++) {
        const actionResource = this.resources[i];
        const inStore = this.$store.getters['currentProduct'].inStore;
        const pt = await this.$store.dispatch(`${ inStore }/create`, {
          type:     HCI.PCI_CLAIM,
          metadata: {
            name:            actionResource.metadata.name,
            ownerReferences: [{
              apiVersion: 'devices.harvesterhci.io/v1beta1',
              kind:       'PCIDevice',
              name:       actionResource.metadata.name,
              uid:        actionResource.metadata.uid,
            }]
          },
          spec: {
            address:                actionResource.status.address,
            nodeName:               actionResource.status.nodeName,
            userName,
            disableResourcePooling: this.disableResourcePooling,
          }
        } );

        try {
          await pt.save();
          buttonCb(true);
          this.close();
        } catch (err) {
          this.$store.dispatch('growl/fromError', {
            title: this.t('harvester.pci.claimError', { name: escapeHtml(actionResource.metadata.name) }),
            err,
          }, { root: true });
          buttonCb(false);
        }
      }
    }
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      <h4
        v-clean-html="t('promptRemove.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <p class="mb-20">
        {{ t('harvester.pci.enablePassthroughWarning') }}
      </p>
      <template v-if="disableResourcePoolingEnabled">
        <Checkbox
          v-model:value="disableResourcePooling"
          label-key="harvester.pci.disableResourcePooling"
        />
        <Banner
          color="info"
          :label="t('harvester.pci.disableResourcePoolingDescription')"
        />
      </template>
    </template>

    <template #actions>
      <div class="actions">
        <div class="buttons">
          <button
            class="btn role-secondary mr-10"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </button>

          <AsyncButton
            mode="enable"
            @click="save"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style lang="scss" scoped>
.actions {
  width: 100%;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
