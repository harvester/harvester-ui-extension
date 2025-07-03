<script>
import { mapGetters } from 'vuex';

import { HCI } from '@pkg/harvester/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { clone } from '@shell/utils/object';

import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  emits: ['close'],

  components: {
    AsyncButton,
    Banner,
    Card,
    LabeledSelect,
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {
      clusterNetwork: '',
      errors:         [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },

    clusterNetworks() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      const clusterNetworks = this.$store.getters[`${ inStore }/all`](HCI.CLUSTER_NETWORK);

      return clusterNetworks.filter((c) => {
        return c.id !== this.actionResource.spec?.clusterNetwork && c.id !== 'mgmt';
      }).map((c) => {
        const label = c.id;
        const value = c.id;

        return {
          label,
          value,
        };
      });
    },
  },

  methods: {
    close() {
      this.nodeName = '';
      this.errors = [];
      this.$emit('close');
    },

    async apply(buttonDone) {
      try {
        const data = clone(this.actionResource);

        data.spec.clusterNetwork = this.clusterNetwork;

        const url = this.$store.getters['harvester-common/getHarvesterClusterUrl'](`v1/harvester/${ HCI.VLAN_CONFIG }s/${ data.id }`);

        await this.$store.dispatch('harvester/request', {
          url,
          method: 'PUT',
          data,
        });

        buttonDone(true);
        this.close();
      } catch (err) {
        const error = err?.data || err;
        const message = exceptionToErrorsArray(error);

        this['errors'] = message;
        buttonDone(false);
      }
    },

  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      {{ t('harvester.modal.migration.title') }}
    </template>

    <template #body>
      <LabeledSelect
        v-model:value="clusterNetwork"
        :label="t('harvester.harvesterVlanConfigMigrateDialog.targetClusterNetwork.label')"
        :placeholder="t('harvester.harvesterVlanConfigMigrateDialog.targetClusterNetwork.placeholder')"
        :options="clusterNetworks"
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
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
            mode="apply"
            :disabled="!clusterNetwork"
            @click="apply"
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
