<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { RadioGroup } from '@components/Form/Radio';
import ArrayList from '@shell/components/form/ArrayList';
import { isValidCIDR } from '@shell/utils/validators/cidr';
import { _EDIT } from '@shell/config/query-params';
import { Banner } from '@components/Banner';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../../types';
import { NETWORK_TYPE } from '../../config/types';

const { L2VLAN, UNTAGGED } = NETWORK_TYPE;
const SHARE_STORAGE_NETWORK = 'share-storage-network';

const DEFAULT_DEDICATED_NETWORK = {
  vlan:           '',
  clusterNetwork: '',
  range:          '',
  exclude:        [],
};

export default {
  name: 'RwxNetworkSetting',

  components: {
    RadioGroup,
    Banner,
    ArrayList,
    LabeledInput,
    LabeledSelect,
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
    });
  },

  data() {
    let enabled = false; // enabled / disabled options
    let shareStorageNetwork = false; // shareStorageNetwork / dedicatedRwxNetwork options
    let dedicatedNetwork = { ...DEFAULT_DEDICATED_NETWORK };
    let networkType = L2VLAN;
    let exclude = [];

    try {
      const parsedValue = JSON.parse(this.value.value || this.value.default || '{}');

      if (parsedValue && typeof parsedValue === 'object') {
        shareStorageNetwork = !!parsedValue[SHARE_STORAGE_NETWORK];
        networkType = 'vlan' in parsedValue ? L2VLAN : UNTAGGED;
        dedicatedNetwork = {
          vlan:           parsedValue.vlan || '',
          clusterNetwork: parsedValue.clusterNetwork || '',
          range:          parsedValue.range || '',
        };
        exclude = parsedValue?.exclude?.toString().split(',') || [];
        enabled = shareStorageNetwork || !!(parsedValue.vlan || parsedValue.clusterNetwork || parsedValue.range);
      }
    } catch (error) {
      enabled = false;
      shareStorageNetwork = false;
      dedicatedNetwork = { ...DEFAULT_DEDICATED_NETWORK };
    }

    return {
      enabled,
      shareStorageNetwork,
      dedicatedNetwork,
      networkType,
      exclude,
      defaultAddValue: '',
    };
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.willSave, 'willSave');
    }
  },

  computed: {
    showDedicatedNetworkConfig() {
      return this.enabled && !this.shareStorageNetwork;
    },

    showVlan() {
      return this.networkType === L2VLAN;
    },

    networkTypes() {
      return [L2VLAN, UNTAGGED];
    },

    clusterNetworkOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const clusterNetworks = this.$store.getters[`${ inStore }/all`](HCI.CLUSTER_NETWORK) || [];
      const clusterNetworksOptions = this.networkType === UNTAGGED ? clusterNetworks.filter((network) => network.id !== 'mgmt') : clusterNetworks;

      return clusterNetworksOptions.map((network) => {
        const disabled = !network.isReadyForStorageNetwork;

        return {
          label: disabled ? `${ network.id } (${ this.t('generic.notReady') })` : network.id,
          value: network.id,
          disabled,
        };
      });
    },
  },

  methods: {
    onUpdateEnabled() {
      if (!this.enabled) {
        this.shareStorageNetwork = false;
        this.dedicatedNetwork = { ...DEFAULT_DEDICATED_NETWORK };
      }

      this.update();
    },

    onUpdateNetworkType() {
      if (this.shareStorageNetwork) {
        this.dedicatedNetwork = { ...DEFAULT_DEDICATED_NETWORK };
      }

      this.update();
    },

    onUpdateDedicatedType(neu) {
      this.dedicatedNetwork.clusterNetwork = '';

      if (neu === L2VLAN) {
        this.dedicatedNetwork.vlan = '';
      } else {
        delete this.dedicatedNetwork.vlan;
      }

      this.update();
    },

    inputVlan(neu) {
      if (neu === '') {
        this.dedicatedNetwork.vlan = '';
        this.update();

        return;
      }

      const newValue = Number(neu);

      if (newValue > 4094) {
        this.dedicatedNetwork.vlan = 4094;
      } else if (newValue < 1) {
        this.dedicatedNetwork.vlan = 1;
      } else {
        this.dedicatedNetwork.vlan = newValue;
      }

      this.update();
    },

    useDefault() {
      this.enabled = false;
      this.shareStorageNetwork = false;
      this.dedicatedNetwork = { ...DEFAULT_DEDICATED_NETWORK };
      this.update();
    },

    update() {
      const value = { [SHARE_STORAGE_NETWORK]: false };

      if (this.enabled && this.shareStorageNetwork) {
        value[SHARE_STORAGE_NETWORK] = true;
      }

      if (this.showDedicatedNetworkConfig) {
        if (this.showVlan) {
          value.vlan = this.dedicatedNetwork.vlan;
        }

        value.clusterNetwork = this.dedicatedNetwork.clusterNetwork;
        value.range = this.dedicatedNetwork.range;

        const excludeList = this.exclude.filter((ip) => ip);

        if (Array.isArray(excludeList) && excludeList.length > 0) {
          value.exclude = excludeList;
        }
      }

      this.value.value = JSON.stringify(value);
    },

    willSave() {
      this.update();

      if (!this.showDedicatedNetworkConfig) {
        return Promise.resolve();
      }

      const errors = [];

      if (this.showVlan && !this.dedicatedNetwork.vlan) {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.storageNetwork.vlan') }, true));
      }

      if (!this.dedicatedNetwork.clusterNetwork) {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.storageNetwork.clusterNetwork') }, true));
      }

      if (!this.dedicatedNetwork.range) {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.storageNetwork.range.label') }, true));
      } else if (!isValidCIDR(this.dedicatedNetwork.range)) {
        errors.push(this.t('harvester.setting.storageNetwork.range.invalid', null, true));
      }

      if (this.exclude) {
        const hasInvalidCIDR = this.exclude.find((cidr) => {
          return cidr && !isValidCIDR(cidr);
        });

        if (hasInvalidCIDR) {
          errors.push(this.t('harvester.setting.storageNetwork.exclude.invalid', null, true));
        }
      }

      if (errors.length > 0) {
        return Promise.reject(errors);
      }

      return Promise.resolve();
    },
  },
};
</script>

<template>
  <div :class="mode">
    <Banner color="warning">
      <t
        k="harvester.setting.rwxNetwork.warning"
        :raw="true"
      />
    </Banner>
    <RadioGroup
      v-model:value="enabled"
      class="mb-20"
      name="rwx-network-enable"
      :options="[true,false]"
      :labels="[t('generic.enabled'), t('generic.disabled')]"
      @update:value="onUpdateEnabled"
    />

    <RadioGroup
      v-if="enabled"
      v-model:value="shareStorageNetwork"
      class="mb-20"
      name="rwx-network-type"
      :options="[true,false]"
      :labels="[t('harvester.setting.rwxNetwork.shareStorageNetwork'), t('harvester.setting.rwxNetwork.dedicatedRwxNetwork')]"
      @update:value="onUpdateNetworkType"
    />
    <Banner
      v-if="shareStorageNetwork"
      class="mb-20"
      color="warning"
    >
      <t
        k="harvester.setting.rwxNetwork.shareStorageNetworkWarning"
        :raw="true"
      />
    </Banner>
    <template v-if="showDedicatedNetworkConfig">
      <LabeledSelect
        v-model:value="networkType"
        class="mb-20"
        :options="networkTypes"
        :mode="mode"
        :label="t('harvester.fields.type')"
        required
        @update:value="onUpdateDedicatedType"
      />

      <LabeledInput
        v-if="showVlan"
        v-model:value.number="dedicatedNetwork.vlan"
        type="number"
        class="mb-20"
        :mode="mode"
        required
        placeholder="e.g. 1 - 4094"
        label-key="harvester.setting.storageNetwork.vlan"
        @update:value="inputVlan"
      />

      <LabeledSelect
        v-model:value="dedicatedNetwork.clusterNetwork"
        label-key="harvester.setting.storageNetwork.clusterNetwork"
        class="mb-20"
        required
        :options="clusterNetworkOptions"
        @update:value="update"
      />

      <LabeledInput
        v-model:value="dedicatedNetwork.range"
        class="mb-5"
        :mode="mode"
        required
        :placeholder="t('harvester.setting.storageNetwork.range.placeholder')"
        label-key="harvester.setting.storageNetwork.range.label"
        @update:value="update"
      />

      <ArrayList
        v-model:value="exclude"
        :show-header="true"
        :default-add-value="defaultAddValue"
        :mode="mode"
        :add-label="t('harvester.setting.storageNetwork.exclude.addIp')"
        class="mt-20"
        @update:value="update"
      >
        <template #column-headers>
          <div class="box mb-10">
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
    </template>
  </div>
</template>
