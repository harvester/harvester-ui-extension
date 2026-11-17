<script>
import KeyValue from '@shell/components/form/KeyValue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import RadioGroup from '@components/Form/Radio/RadioGroup';
import { Banner } from '@components/Banner';
import { SECRET, LONGHORN } from '@shell/config/types';
import { _CREATE, _VIEW } from '@shell/config/query-params';
import { CSI_SECRETS } from '@pkg/harvester/config/harvester-map';
import { clone } from '@shell/utils/object';
import { uniq } from '@shell/utils/array';
import { DATA_ENGINE_V2 } from '../../../models/harvester/persistentvolumeclaim';

// UI components for Longhorn storage class parameters
const DEFAULT_PARAMETERS = [
  'numberOfReplicas',
  'staleReplicaTimeout',
  'diskSelector',
  'nodeSelector',
  'migratable',
  'encrypted',
  'dataEngine',
  'dataEngineTransport',
];

const DATA_ENGINE_TRANSPORT_TCP = 'tcp';
const DATA_ENGINE_TRANSPORT_RDMA = 'rdma';

const {
  CSI_PROVISIONER_SECRET_NAME,
  CSI_PROVISIONER_SECRET_NAMESPACE,
  CSI_NODE_PUBLISH_SECRET_NAME,
  CSI_NODE_PUBLISH_SECRET_NAMESPACE,
  CSI_NODE_STAGE_SECRET_NAME,
  CSI_NODE_STAGE_SECRET_NAMESPACE
} = CSI_SECRETS;

export default {
  name: 'DriverLonghornIOV2',

  components: {
    Banner,
    KeyValue,
    LabeledSelect,
    LabeledInput,
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

  data() {
    if (this.realMode === _CREATE) {
      this.value['parameters'] = {
        numberOfReplicas:    '3',
        staleReplicaTimeout: '30',
        diskSelector:        null,
        nodeSelector:        null,
        encrypted:           'false',
        migratable:          this.value.thirdPartyStorageFeatureEnabled ? 'true' : 'false',
        dataEngine:          DATA_ENGINE_V2
      };
    }

    return { };
  },

  computed: {
    secrets() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      const allSecrets = this.$store.getters[`${ inStore }/all`](SECRET);

      // only show non-system secret to user to select
      return allSecrets.filter((secret) => secret.isSystem === false);
    },

    longhornNodes() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](LONGHORN.NODES);
    },

    nodeTags() {
      return (this.longhornNodes || []).reduce((sum, node) => {
        const tags = node.spec?.tags || [];

        return uniq([...sum, ...tags]);
      }, []);
    },

    diskTags() {
      return (this.longhornNodes || []).reduce((sum, node) => {
        const disks = node.spec?.disks;

        const tagsOfNode = Object.keys(disks).reduce((sum, key) => {
          const tags = disks[key]?.tags || [];

          return uniq([...sum, ...tags]);
        }, []);

        return uniq([...sum, ...tagsOfNode]);
      }, []);
    },

    isView() {
      return this.mode === _VIEW;
    },

    migratableOptions() {
      return [{
        label: this.t('generic.yes'),
        value: 'true'
      }, {
        label: this.t('generic.no'),
        value: 'false'
      }];
    },

    secretOptions() {
      return this.secrets.map((secret) => secret.id);
    },

    dataEngineTransportOptions() {
      return [{
        label: this.t('harvester.storage.parameters.dataEngineTransport.tcp'),
        value: DATA_ENGINE_TRANSPORT_TCP
      }, {
        label: this.t('harvester.storage.parameters.dataEngineTransport.rdma'),
        value: DATA_ENGINE_TRANSPORT_RDMA
      }];
    },

    // Longhorn sets the RDMACapable node condition when the node has an RDMA device
    rdmaCapableNodes() {
      return (this.longhornNodes || []).filter((node) => (node.status?.conditions || []).some((c) => c.type === 'RDMACapable' && c.status === 'True'));
    },

    dataEngineTransport: {
      get() {
        return this.value?.parameters?.dataEngineTransport || DATA_ENGINE_TRANSPORT_TCP;
      },

      set(neu) {
        const parameters = { ...this.value.parameters };

        // TCP is Longhorn's default, so leave the parameter out instead of writing it
        if (neu === DATA_ENGINE_TRANSPORT_RDMA) {
          parameters.dataEngineTransport = DATA_ENGINE_TRANSPORT_RDMA;
        } else {
          delete parameters.dataEngineTransport;
        }
        this.value['parameters'] = parameters;
      }
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

    parameters: {
      get() {
        const parameters = clone(this.value?.parameters) || {};

        DEFAULT_PARAMETERS.forEach((key) => {
          // keep dataEngineTransport visible in the free-form list when the managed
          // control is hidden, so existing values aren't hidden from the form
          if (key === 'dataEngineTransport' && !this.value.longhornV2RdmaTransportFeatureEnabled) {
            return;
          }

          delete parameters[key];
        });

        Object.values(CSI_SECRETS).forEach((key) => {
          delete parameters[key];
        });

        return parameters;
      },

      set(value) {
        Object.assign(this.value.parameters, value);
      }
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

      set(selectedSecret) {
        const [namespace, name] = selectedSecret.split('/');

        this.value['parameters'] = {
          ...this.value.parameters,
          [CSI_PROVISIONER_SECRET_NAME]:       name,
          [CSI_NODE_PUBLISH_SECRET_NAME]:      name,
          [CSI_NODE_STAGE_SECRET_NAME]:        name,
          [CSI_PROVISIONER_SECRET_NAMESPACE]:  namespace,
          [CSI_NODE_PUBLISH_SECRET_NAMESPACE]: namespace,
          [CSI_NODE_STAGE_SECRET_NAMESPACE]:   namespace
        };
      }
    },

    nodeSelector: {
      get() {
        const nodeSelector = this.value?.parameters?.nodeSelector;

        if ((nodeSelector || '').includes(',')) {
          return nodeSelector.split(',');
        } else if (nodeSelector) {
          return [nodeSelector];
        } else {
          return [];
        }
      },

      set(value) {
        this.value.parameters.nodeSelector = (value || []).join(',');
      }
    },

    diskSelector: {
      get() {
        const diskSelector = this.value?.parameters?.diskSelector;

        if ((diskSelector || '').includes(',')) {
          return diskSelector.split(',');
        } else if (diskSelector) {
          return [diskSelector];
        } else {
          return [];
        }
      },

      set(value) {
        this.value.parameters.diskSelector = (value || []).join(',');
      }
    },

    numberOfReplicas: {
      get() {
        return this.value?.parameters?.numberOfReplicas;
      },

      set(value) {
        if (value >= 1 && value <= 3) {
          this.value.parameters.numberOfReplicas = String(value);
        }
      }
    },
  },
};
</script>
<template>
  <div>
    <div class="row">
      <div class="col span-6">
        <LabeledInput
          v-model:value="numberOfReplicas"
          :label="t('harvester.storage.parameters.numberOfReplicas.label')"
          :required="true"
          :mode="mode"
          min="1"
          max="3"
          type="number"
        />
      </div>
      <div class="col span-6">
        <LabeledInput
          v-model:value="value.parameters.staleReplicaTimeout"
          :label="t('harvester.storage.parameters.staleReplicaTimeout.label')"
          :required="true"
          :mode="mode"
          type="number"
        />
      </div>
    </div>
    <div class="row mt-10">
      <div class="col span-6">
        <LabeledSelect
          v-model:value="nodeSelector"
          :label="t('harvester.storage.parameters.nodeSelector.label')"
          :options="nodeTags"
          :taggable="true"
          :multiple="true"
          :mode="mode"
        >
          <template #no-options="{ searching }">
            <span
              v-if="!searching"
              class="text-muted"
            >
              {{ t('harvester.storage.parameters.nodeSelector.no-options', null, true) }}
            </span>
          </template>
        </LabeledSelect>
      </div>
      <div class="col span-6">
        <LabeledSelect
          v-model:value="diskSelector"
          :label="t('harvester.storage.parameters.diskSelector.label')"
          :options="diskTags"
          :taggable="true"
          :multiple="true"
          :mode="mode"
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
    <div class="row mt-20">
      <RadioGroup
        v-model:value="value.parameters.migratable"
        name="layer3NetworkMode"
        :label="t('harvester.storage.parameters.migratable.label')"
        :mode="mode"
        :options="migratableOptions"
        :disabled="!value.thirdPartyStorageFeatureEnabled"
      />
    </div>
    <div
      v-if="value.longhornV2RdmaTransportFeatureEnabled"
      class="row mt-20"
    >
      <div class="col span-12">
        <RadioGroup
          v-model:value="dataEngineTransport"
          name="dataEngineTransport"
          :label="t('harvester.storage.parameters.dataEngineTransport.label')"
          :tooltip="t('harvester.storage.parameters.dataEngineTransport.tooltip')"
          :mode="mode"
          :options="dataEngineTransportOptions"
          :disabled="!rdmaCapableNodes.length && dataEngineTransport !== 'rdma'"
        />
        <Banner
          v-if="!isView && !rdmaCapableNodes.length"
          color="info"
          :label="t('harvester.storage.parameters.dataEngineTransport.noRdmaNodes')"
        />
      </div>
    </div>
    <div class="row mt-20">
      <RadioGroup
        v-model:value="volumeEncryption"
        name="volumeEncryption"
        :label="t('harvester.storage.volumeEncryption')"
        :mode="mode"
        :options="volumeEncryptionOptions"
        :disabled="true"
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
