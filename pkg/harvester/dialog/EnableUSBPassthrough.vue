<script>
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import AsyncButton from '@shell/components/AsyncButton';
import { escapeHtml } from '@shell/utils/string';
import { HCI } from '../types';
import { getHarvesterUserName } from '../utils/auth';

export default {
  name: 'HarvesterEnableUSBPassthrough',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {};
  },

  computed: { ...mapGetters({ t: 'i18n/t' }) },

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
          type:     HCI.USB_CLAIM,
          metadata: {
            name:            actionResource.metadata.name,
            ownerReferences: [{
              apiVersion: 'devices.harvesterhci.io/v1beta1',
              kind:       'USBDevice',
              name:       actionResource.metadata.name,
              uid:        actionResource.metadata.uid,
            }]
          },
          spec: {
            pciAddress: actionResource.status.pciAddress,
            nodeName:   actionResource.status.nodeName,
            userName
          }
        } );

        try {
          await pt.save();
          buttonCb(true);
          this.close();
        } catch (err) {
          this.$store.dispatch('growl/fromError', {
            title: this.t('harvester.usb.claimError', { name: escapeHtml(actionResource.metadata.name) }),
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
      <t
        k="harvester.usb.enablePassthroughWarning"
        :raw="true"
      />
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
