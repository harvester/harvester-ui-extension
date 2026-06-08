<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { RadioGroup } from '@components/Form/Radio';
import ArrayList from '@shell/components/form/ArrayList';
import { isValidCIDR } from '@shell/utils/validators/cidr';
import { _EDIT } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import Tip from '@shell/components/Tip';
import { allHash } from '@shell/utils/promise';
import { NODE } from '@shell/config/types';
import { HCI } from '../../types';
import { DOC } from '../../config/doc-links';
import { docLink } from '../../utils/feature-flags';
import { NETWORK_TYPE } from '../../config/types';

const { L2VLAN, UNTAGGED } = NETWORK_TYPE;

export default {
  name: 'HarvesterEditStorageNetwork',

  components: {
    ArrayList,
    Tip,
    Banner,
    LabeledInput,
    LabeledSelect,
    RadioGroup
  },

  props: {
    registerBeforeHook: {
      type:     Function,
      required: true,
    },

    mode: {
      type:    String,
      default: _EDIT,
    },

    value: {
      type:    Object,
      default: () => {
        return {};
      },
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      clusterNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.CLUSTER_NETWORK }),
      vlanStatus:      this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VLAN_STATUS }),
      nodes:           this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
    });
  },

  data() {
    let parsedDefaultValue = {};
    let openVlan = false;
    let networkType = L2VLAN;

    try {
      parsedDefaultValue = JSON.parse(this.value.value);
      if (typeof parsedDefaultValue.exclusiveVlan !== 'boolean') {
        parsedDefaultValue.exclusiveVlan = false;
      }
      networkType = 'vlan' in parsedDefaultValue ? L2VLAN : UNTAGGED; // backend doesn't provide networkType, so we check if vlan is provided instead
      openVlan = true;
    } catch (error) {
      networkType = L2VLAN;
      parsedDefaultValue = {
        vlan:           '',
        clusterNetwork: '',
        range:          '',
        exclude:        [],
        exclusiveVlan:  false
      };
    }
    const exclude = parsedDefaultValue?.exclude?.toString().split(',') || [];

    return {
      openVlan,
      networkType,
      errors:          [],
      exclude,
      parsedDefaultValue,
      defaultAddValue: ''
    };
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  computed: {
    showExclusiveVlan() {
      return this.networkType === L2VLAN &&
        Number(this.parsedDefaultValue.vlan) !== 1;
    },
    showVlan() {
      return this.networkType === L2VLAN;
    },
    networkTypes() {
      const types = [L2VLAN];

      if (this.untaggedNetworkSettingEnabled) {
        types.push(UNTAGGED);
      }

      return types;
    },
    storageNetworkExampleLink() {
      const version = this.$store.getters['harvester-common/getServerVersion']();

      return docLink(DOC.STORAGE_NETWORK_EXAMPLE, version);
    },

    untaggedNetworkSettingEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('untaggedNetworkSetting');
    },

    clusterNetworkOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const clusterNetworks = this.$store.getters[`${ inStore }/all`](HCI.CLUSTER_NETWORK) || [];
      // untaggedNetwork filter out mgmt cluster network
      const clusterNetworksOptions = this.networkType === UNTAGGED ? clusterNetworks.filter((net) => net.id !== 'mgmt') : clusterNetworks;

      return clusterNetworksOptions.map((n) => {
        const disabled = !n.isReadyForStorageNetwork;

        return {
          label: disabled ? `${ n.id } (${ this.t('generic.notReady') })` : n.id,
          value: n.id,
          disabled,
        };
      });
    },
    exclusiveVlanOptions() {
      return [
        {
          label: this.t('generic.enabled'),
          value: true
        },
        {
          label: this.t('generic.disabled'),
          value: false
        }
      ];
    },
  },

  watch: {
    networkType: {
      handler(neu) {
        this.parsedDefaultValue.clusterNetwork = '';

        if (neu === L2VLAN) {
          this.parsedDefaultValue.vlan = '';
        } else {
          delete this.parsedDefaultValue.vlan;
        }
      },
      deep: true
    }
  },

  methods: {
    inputVlan(neu) {
      if (neu === '') {
        this.parsedDefaultValue.vlan = '';

        return;
      }
      const newValue = Number(neu);

      if (newValue > 4094) {
        this.parsedDefaultValue.vlan = 4094;
      } else if (newValue < 1) {
        this.parsedDefaultValue.vlan = 1;
      } else {
        this.parsedDefaultValue.vlan = newValue;
      }
    },

    useDefault() {
      this.openVlan = false;
      this.networkType = L2VLAN;
      this.parsedDefaultValue = {
        vlan:           '',
        clusterNetwork: '',
        range:          '',
        exclude:        [],
        exclusiveVlan:  false
      };
    },

    update() {
      const exclude = this.exclude.filter((ip) => ip);

      if (Array.isArray(exclude) && exclude.length > 0) {
        this.parsedDefaultValue.exclude = exclude;
      } else {
        delete this.parsedDefaultValue.exclude;
      }

      const valueString = JSON.stringify(this.parsedDefaultValue);

      if (this.openVlan) {
        this.value['value'] = valueString;
      } else {
        this.value['value'] = '';
      }
    },

    willSave() {
      this.update();
      const errors = [];

      if (this.openVlan) {
        const valid = !!/^(?:(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}(?:[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\/([1-9]|[1-2]\d|3[0-2])$/.test(this.parsedDefaultValue.range);

        if (!valid) {
          errors.push(this.t('harvester.setting.storageNetwork.range.invalid', null, true));
        }

        if (this.networkType === L2VLAN && !this.parsedDefaultValue.vlan) {
          errors.push(this.t('validation.required', { key: this.t('harvester.setting.storageNetwork.vlan') }, true));
        }

        if (!this.parsedDefaultValue.clusterNetwork) {
          errors.push(this.t('validation.required', { key: this.t('harvester.setting.storageNetwork.clusterNetwork') }, true));
        }

        if (this.exclude) {
          const hasInvalidCIDR = this.exclude.find((cidr) => {
            return !isValidCIDR(cidr);
          });

          if (hasInvalidCIDR) {
            errors.push(this.t('harvester.setting.storageNetwork.exclude.invalid', null, true));
          }
        }
      } else {
        return Promise.resolve();
      }

      if (errors.length > 0) {
        return Promise.reject(errors);
      } else {
        return Promise.resolve();
      }
    },
  },
};
</script>

<template>
  <div
    :class="mode"
    @update:value="update"
  >
    <Banner color="warning">
      <t
        k="harvester.setting.storageNetwork.warning"
        :raw="true"
      />
    </Banner>

    <RadioGroup
      v-model:value="openVlan"
      class="mb-20"
      name="model"
      :options="[true,false]"
      :labels="[t('generic.enabled'), t('generic.disabled')]"
      @update:value="update"
    />

    <div v-if="openVlan">
      <LabeledSelect
        v-model:value="networkType"
        class="mb-20"
        :options="networkTypes"
        :mode="mode"
        :label="t('harvester.fields.type')"
        required
      />

      <LabeledInput
        v-if="showVlan"
        v-model:value.number="parsedDefaultValue.vlan"
        type="number"
        class="mb-20"
        :mode="mode"
        required
        placeholder="e.g. 1 - 4094"
        label-key="harvester.setting.storageNetwork.vlan"
        @update:value="inputVlan"
      />
      <LabeledSelect
        v-if="showExclusiveVlan"
        v-model:value="parsedDefaultValue.exclusiveVlan"
        class="mb-20"
        :options="exclusiveVlanOptions"
        :mode="mode"
        label-key="harvester.setting.storageNetwork.exclusiveVlan"
        @update:value="update"
      />
      <LabeledSelect
        v-model:value="parsedDefaultValue.clusterNetwork"
        label-key="harvester.setting.storageNetwork.clusterNetwork"
        class="mb-20"
        required
        :options="clusterNetworkOptions"
        @update:value="update"
      />

      <LabeledInput
        v-model:value="parsedDefaultValue.range"
        class="mb-5"
        :mode="mode"
        required
        :placeholder="t('harvester.setting.storageNetwork.range.placeholder')"
        label-key="harvester.setting.storageNetwork.range.label"
      />
      <Tip
        class="mb-20"
        icon="icon icon-info"
      >
        <t
          k="harvester.setting.storageNetwork.tip"
          :raw="true"
          :url="storageNetworkExampleLink"
        />
      </Tip>

      <ArrayList
        v-model:value="exclude"
        :show-header="true"
        :default-add-value="defaultAddValue"
        :mode="mode"
        :add-label="t('harvester.setting.storageNetwork.exclude.addIp')"
        @update:value="update"
      >
        <template #column-headers>
          <div class="box">
            <div class="key">
              {{ t('harvester.setting.storageNetwork.exclude.label') }}
            </div>
          </div>
        </template>
        <template #columns="scope">
          <div class="key">
            <input
              v-model="scope.row.value"
              :placeholder="t('harvester.setting.storageNetwork.exclude.placeholder')"
              @update:value="update"
            />
          </div>
        </template>
      </ArrayList>
    </div>
  </div>
</template>
