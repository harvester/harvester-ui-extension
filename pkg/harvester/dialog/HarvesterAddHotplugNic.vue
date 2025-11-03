<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { NETWORK_ATTACHMENT } from '@shell/config/types';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { NETWORK_TYPE } from '../config/types';

export default {
  name: 'AddHotplugNic',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    LabeledInput,
    LabeledSelect,
    Banner
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    try {
      this.allVMNetworks = await this.$store.dispatch('harvester/findAll', { type: NETWORK_ATTACHMENT });
    } catch (err) {
      this.errors = exceptionToErrorsArray(err);
      this.allVMNetworks = [];
    }
  },

  data() {
    return {
      interfaceName: '',
      networkName:   '',
      macAddress:    '',
      allVMNetworks: [],
      errors:        [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources?.[0];
    },

    isFormValid() {
      return this.interfaceName !== '' && this.networkName !== '';
    },

    vmNetworksOption() {
      return this.allVMNetworks
        .filter((network) => {
          const labels = network.metadata?.labels || {};
          const type = labels[HCI_ANNOTATIONS.NETWORK_TYPE];

          return [NETWORK_TYPE.L2VLAN, NETWORK_TYPE.UNTAGGED, NETWORK_TYPE.L2TRUNK_VLAN].includes(type);
        })
        .map((network) => ({
          label: network.metadata?.name || '',
          value: network.id || '',
        }));
    }
  },

  methods: {
    close() {
      this.interfaceName = '';
      this.networkName = '';
      this.macAddress = '';
      this.errors = [];
      this.$emit('close');
    },

    async save(buttonCb) {
      if (!this.actionResource) {
        buttonCb(false);

        return;
      }

      const payload = {
        interfaceName: this.interfaceName,
        networkName:   this.networkName
      };

      if (this.macAddress) {
        payload.macAddress = this.macAddress;
      }

      try {
        const res = await this.actionResource.doAction('addNic', payload);

        if ([200, 204].includes(res?._status)) {
          this.$store.dispatch('growl/success', {
            title:   this.t('generic.notification.title.succeed'),
            message: this.t('harvester.modal.hotplugNic.success', {
              interfaceName: this.interfaceName,
              vm:            this.actionResource.nameDisplay
            })
          }, { root: true });

          this.close();
          buttonCb(true);
        } else {
          this.errors = exceptionToErrorsArray(res);
          buttonCb(false);
        }
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        buttonCb(false);
      }
    }
  }
};
</script>

<template>
  <Card
    ref="modal"
    name="modal"
    :show-highlight-border="false"
  >
    <template #title>
      <h4
        v-clean-html="t('harvester.modal.hotplugNic.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <LabeledInput
        v-model:value="interfaceName"
        :label="t('generic.name')"
        required
      />
      <LabeledSelect
        v-model:value="networkName"
        class="mt-20"
        :label="t('harvester.modal.hotplugNic.vmNetwork')"
        :options="vmNetworksOption"
        required
      />
      <LabeledInput
        v-model:value="macAddress"
        class="mt-20"
        label-key="harvester.modal.hotplugNic.macAddress"
        :tooltip="t('harvester.modal.hotplugNic.macAddressTooltip', _, true)"
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        :label="err"
        color="error"
      />
    </template>

    <template #actions>
      <div class="actions">
        <div class="buttons">
          <button
            type="button"
            class="btn role-secondary mr-10"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </button>

          <AsyncButton
            mode="apply"
            :disabled="!isFormValid"
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
