<script>
import { NORMAN } from '@shell/config/types';
import { HCI } from '../types';
import { getHarvesterUser } from '../utils/auth';

export default {
  props: {
    value: {
      type:    String,
      default: ''
    }
  },

  async fetch() {
    const harvesterSettings = await this.$store.dispatch('harvester/findAll', { type: HCI.SETTING });

    this.harvesterSettings = harvesterSettings;

    const clusterRoleTemplateBindingSchema = this.$store.getters['rancher/schemaFor'](NORMAN.CLUSTER_ROLE_TEMPLATE_BINDING);

    if (clusterRoleTemplateBindingSchema) {
      const normanBindings = await this.$store.dispatch('rancher/findAll', { type: NORMAN.CLUSTER_ROLE_TEMPLATE_BINDING }, { root: true });

      this.clusterRoleTemplateBinding = normanBindings;
    }
  },

  data() {
    const user = getHarvesterUser(this.$store.getters);

    return {
      harvesterSettings:          [],
      clusterRoleTemplateBinding: [],
      user,
    };
  },

  computed: {
    isMatch() {
      const harvesterSettings = this.$store.getters['harvester/all'](HCI.SETTING) || [];
      const resource = harvesterSettings.find( (V) => V.id === 'backup-target');

      let isMatch = false;

      try {
        isMatch = this.value === resource?.parseValue?.endpoint;
      } catch (e) {}

      return isMatch;
    },

    isClusterOwner() {
      const template = this.clusterRoleTemplateBinding.find((template) => {
        return template.userId === this.user?.id;
      });

      return template?.roleTemplateId === 'cluster-owner';
    },

    shouldShowError() {
      return this.isClusterOwner && !this.isMatch && this.value;
    }
  }
};
</script>

<template>
  <div>
    {{ value }}
    <p
      v-if="shouldShowError"
      class="text-error"
    >
      {{ t('harvester.backup.matchTarget') }}
    </p>
  </div>
</template>
