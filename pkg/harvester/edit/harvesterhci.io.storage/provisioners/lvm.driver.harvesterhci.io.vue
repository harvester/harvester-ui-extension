<script>

import KeyValue from '@shell/components/form/KeyValue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import RadioGroup from '@components/Form/Radio/RadioGroup';

import { allHash } from '@shell/utils/promise';
import { clone } from '@shell/utils/object';
import { HCI } from '../../../types';
import { NODE, SECRET } from '@shell/config/types';
import { CSI_SECRETS } from '@pkg/harvester/config/harvester-map';
import { LVM_TOPOLOGY_LABEL } from '../index.vue';

const {
  CSI_PROVISIONER_SECRET_NAME,
  CSI_PROVISIONER_SECRET_NAMESPACE,
  CSI_NODE_PUBLISH_SECRET_NAME,
  CSI_NODE_PUBLISH_SECRET_NAMESPACE,
  CSI_NODE_STAGE_SECRET_NAME,
  CSI_NODE_STAGE_SECRET_NAMESPACE,
  CSI_NODE_EXPAND_SECRET_NAME,
  CSI_NODE_EXPAND_SECRET_NAMESPACE
} = CSI_SECRETS;

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
    RadioGroup,
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

    const hash = {
      nodes:           this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      lvmVolumeGroups: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.LVM_VOLUME_GROUP }),
    };

    if (this.value.lvmVolumeEncryptionFeatureEnabled) {
      hash.secrets = this.$store.dispatch(`${ inStore }/findAll`, { type: SECRET });
    }

    await allHash(hash);
  },

  data() {
    const node = (this.value.allowedTopologies?.[0]?.matchLabelExpressions || []).find((t) => t.key === LVM_TOPOLOGY_LABEL)?.values[0];

    return {
      volumeGroupTypes: ['striped', 'dm-thin'],
      node,
    };
  },

  watch: {
    node(value) {
      delete (this.value.parameters.vgName);

      const allowedTopologies = [...DEFAULT_TOPOLOGIES];

      allowedTopologies[0].matchLabelExpressions[0].values = [value];

      this.value.allowedTopologies = allowedTopologies;
    },
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

    secrets() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const allSecrets = this.$store.getters[`${ inStore }/all`](SECRET) || [];

      // only show non-system secret to user to select
      return allSecrets.filter((secret) => secret.isSystem === false);
    },

    secretOptions() {
      return this.secrets.map((secret) => secret.id);
    },

    volumeEncryptionOptions() {
      return [{
        label: this.t('generic.yes'),
        value: 'true'
      }, {
        label: this.t('generic.no'),
        value: 'false'
      }];
    },

    volumeEncryption: {
      set(neu) {
        this.value['parameters'] = {
          ...this.value.parameters,
          encrypted: neu
        };
      },

      get() {
        return this.value?.parameters?.encrypted || 'false';
      }
    },

    secret: {
      get() {
        const selectedNs = this.value.parameters[CSI_PROVISIONER_SECRET_NAMESPACE];
        const selectedName = this.value.parameters[CSI_PROVISIONER_SECRET_NAME];

        if (selectedNs && selectedName) {
          return `${ selectedNs }/${ selectedName }`;
        }

        return '';
      },

      // All four references point at the same secret. The LVM driver needs the
      // passphrase when it provisions the volume, when it opens the dm-crypt
      // device at publish, and when it resizes that device at expand - the
      // node-expand reference is what makes external-resizer send the
      // credential, so without it an encrypted volume can never grow, online or
      // offline. The node-stage reference is not read by the driver, but the
      // Harvester StorageClass webhook requires it on an encrypted class.
      set(selectedSecret) {
        const [namespace, name] = selectedSecret.split('/');

        this.value['parameters'] = {
          ...this.value.parameters,
          [CSI_PROVISIONER_SECRET_NAME]:       name,
          [CSI_NODE_PUBLISH_SECRET_NAME]:      name,
          [CSI_NODE_STAGE_SECRET_NAME]:        name,
          [CSI_NODE_EXPAND_SECRET_NAME]:       name,
          [CSI_PROVISIONER_SECRET_NAMESPACE]:  namespace,
          [CSI_NODE_PUBLISH_SECRET_NAMESPACE]: namespace,
          [CSI_NODE_STAGE_SECRET_NAMESPACE]:   namespace,
          [CSI_NODE_EXPAND_SECRET_NAMESPACE]:  namespace,
        };
      }
    },

    parameters: {
      get() {
        const parameters = clone(this.value?.parameters) || {};

        const managedKeys = [
          ...DEFAULT_PARAMETERS,
          ...(this.value.lvmVolumeEncryptionFeatureEnabled ? ['encrypted', ...Object.values(CSI_SECRETS)] : []),
        ];

        managedKeys.forEach((key) => {
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
    <template v-if="value.lvmVolumeEncryptionFeatureEnabled">
      <div class="row mt-20">
        <RadioGroup
          v-model:value="volumeEncryption"
          name="volumeEncryption"
          :label="t('harvester.storage.volumeEncryption')"
          :mode="mode"
          :options="volumeEncryptionOptions"
        />
      </div>
      <div
        v-if="value.parameters.encrypted === 'true'"
        class="row mt-20"
      >
        <div class="col span-6">
          <LabeledSelect
            v-model:value="secret"
            :label="t('harvester.storage.secret')"
            :options="secretOptions"
            :mode="mode"
            :required="true"
          />
        </div>
      </div>
    </template>
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
