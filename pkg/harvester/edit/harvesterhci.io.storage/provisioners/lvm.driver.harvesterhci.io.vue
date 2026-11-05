<script>

import KeyValue from '@shell/components/form/KeyValue';
import LabeledSelect from '@shell/components/form/LabeledSelect';

import { allHash } from '@shell/utils/promise';
import { clone } from '@shell/utils/object';
import { HCI } from '../../../types';
import { NODE } from '@shell/config/types';
import { _CREATE, _CLONE } from '@shell/config/query-params';
import { LVM_TOPOLOGY_LABEL } from '../index.vue';

const STRIPED_TYPE = 'striped';
const DM_THIN_TYPE = 'dm-thin';

const DEFAULT_PARAMETERS = [
  'type',
  'vgName'
];

const DEFAULT_TOPOLOGIES = [{
  matchLabelExpressions: [{
    key:    LVM_TOPOLOGY_LABEL,
    values: []
  }]
}];

export default {
  components: {
    KeyValue,
    LabeledSelect,
  },

  props: {
    value: {
      type:     Object,
      required: true
    },
    mode: {
      type:     String,
      required: true
    },
    realMode: {
      type:     String,
      required: true
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      nodes:           this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      lvmVolumeGroups: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.LVM_VOLUME_GROUP }),
    });
  },

  data() {
    const node = (this.value.allowedTopologies?.[0]?.matchLabelExpressions || []).find((t) => t.key === LVM_TOPOLOGY_LABEL)?.values[0];

    // striped is dropped once the LVM add-on reaches GA (v1.9.1); dm-thin is the only supported type.
    const dmThinOnly = this.$store.getters['harvester-common/getFeatureEnabled']('lvmDmThinOnly');
    const volumeGroupTypes = dmThinOnly ? [DM_THIN_TYPE] : [STRIPED_TYPE, DM_THIN_TYPE];

    // Default new storage classes to dm-thin, and reset a cloned striped type that is no longer selectable.
    if (dmThinOnly && [_CREATE, _CLONE].includes(this.realMode) && !volumeGroupTypes.includes(this.value.parameters.type)) {
      this.value.parameters.type = DM_THIN_TYPE;
    }

    return {
      volumeGroupTypes,
      node,
    };
  },

  watch: {
    node(value) {
      delete (this.value.parameters.vgName);

      const allowedTopologies = [...DEFAULT_TOPOLOGIES];

      allowedTopologies[0].matchLabelExpressions[0].values = [value];

      this.value.allowedTopologies = allowedTopologies;
    }
  },

  computed: {
    nodes() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE) || [];

      return nodes.filter((n) => n.labels[LVM_TOPOLOGY_LABEL] === n.name).map((n) => n.name);
    },

    volumeGroups() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const lvmVolumeGroups = this.$store.getters[`${ inStore }/all`](HCI.LVM_VOLUME_GROUP) || [];

      return lvmVolumeGroups
        .filter((group) => group.spec.nodeName === this.node)
        .map((g) => g.spec.vgName);
    },

    parameters: {
      get() {
        const parameters = clone(this.value?.parameters) || {};

        DEFAULT_PARAMETERS.map((key) => {
          delete parameters[key];
        });

        return parameters;
      },

      set(value) {
        Object.assign(this.value.parameters, value);
      }
    },
  },
};
</script>
<template>
  <div>
    <div class="row mt-10">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="node"
          :label="t('harvester.storage.parameters.node.label')"
          :options="nodes"
          :mode="mode"
          :required="true"
        >
          <template #no-options="{ searching }">
            <span
              v-if="!searching"
              class="text-muted"
            >
              {{ t('harvester.storage.parameters.diskSelector.no-options', null, true) }}
            </span>
          </template>
        </LabeledSelect>
      </div>
    </div>
    <div class="row mt-10">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.parameters.vgName"
          :label="t('harvester.storage.parameters.lvmVolumeGroup.label')"
          :options="volumeGroups"
          :mode="mode"
          :required="true"
        >
          <template #no-options="{ searching }">
            <span
              v-if="!searching"
              class="text-muted"
            >
              {{ t('harvester.storage.parameters.lvmVolumeGroup.no-options', null, true) }}
            </span>
          </template>
        </LabeledSelect>
      </div>
      <div class="col span-6">
        <LabeledSelect
          v-model:value="value.parameters.type"
          :label="t('harvester.storage.parameters.lvmVolumeGroupType.label')"
          :options="volumeGroupTypes"
          :mode="mode"
          :required="true"
        />
      </div>
    </div>
    <KeyValue
      v-model:value="parameters"
      :add-label="t('storageClass.longhorn.addLabel')"
      :read-allowed="false"
      :mode="mode"
      class="mt-10"
    />
  </div>
</template>

<style lang="scss" scoped>
.labeled-input.compact-input {
  padding: 7px 10px;
}
</style>
