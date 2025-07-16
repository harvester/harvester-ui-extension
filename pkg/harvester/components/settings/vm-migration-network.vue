<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import { RadioGroup } from '@components/Form/Radio';
import { Banner } from '@components/Banner';
import ArrayList from '@shell/components/form/ArrayList';
import { allHash } from '@shell/utils/promise';
import { isValidCIDR } from '@shell/utils/validators/cidr';
import { NODE } from '@shell/config/types';
import { _EDIT } from '@shell/config/query-params';
import { HCI } from '../../types';

const DEFAULT_NETWORK = {
  clusterNetwork: '',
  vlan:           '',
  range:          '',
  exclude:        [],
};

export default {
  name: 'VMMigrationNetwork',

  components: {
    LabeledInput,
    LabeledSelect,
    RadioGroup,
    Banner,
    ArrayList,
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
      default: () => ({ value: '' }),
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    try {
      await allHash({
        clusterNetworks: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.CLUSTER_NETWORK }),
        vlanStatus:      this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VLAN_STATUS }),
        nodes:           this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      });

      this.fetchError = null;
    } catch (e) {
      console.error('Failed to fetch network data:', e); // eslint-disable-line no-console
      this.fetchError = this.t('harvester.setting.vmMigrationNetwork.fetchError', { error: e.message || e }, true);
    }
  },

  data() {
    const { parsed, enabled, parseError } = this.parseInitialValue();

    return {
      enabled,
      network:    { ...DEFAULT_NETWORK, ...parsed },
      fetchError: null,
      parseError,
    };
  },

  created() {
    this.registerBeforeHook?.(this.willSave, 'willSave');
  },

  computed: {
    allErrors() {
      return [this.fetchError, this.parseError].filter(Boolean);
    },

    clusterNetworkOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const networks = this.$store.getters[`${ inStore }/all`](HCI.CLUSTER_NETWORK) || [];

      return networks.map((net) => ({
        label:    net.isReadyForStorageNetwork ? net.id : `${ net.id } (${ this.t('generic.notReady') })`,
        value:    net.id,
        disabled: !net.isReadyForStorageNetwork,
      }));
    },

    disableEdit() {
      return !!(this.fetchError || this.parseError);
    },
  },

  methods: {
    parseInitialValue() {
      let parsed = {};
      let enabled = false;
      let parseError = null;

      try {
        if (typeof this.value.value === 'string' && this.value.value.trim()) {
          parsed = JSON.parse(this.value.value);
          enabled = true;
        }
      } catch (e) {
        console.error('[VMMigrationNetwork] Failed to parse value:', e); // eslint-disable-line no-console
        parseError = this.t('harvester.setting.vmMigrationNetwork.parseError', { error: e.message }, true);
      }

      if (!Array.isArray(parsed.exclude)) {
        parsed.exclude = [];
      }

      return {
        parsed, enabled, parseError
      };
    },

    clearErrors() {
      this.fetchError = null;
      this.parseError = null;
    },

    inputVlan(val) {
      this.network.vlan = val ? Math.min(4094, Math.max(1, Number(val))) : '';
      this.update();
    },

    useDefault() {
      this.network = { ...DEFAULT_NETWORK };
      this.value.value = '';
      this.enabled = false;
      this.clearErrors();
    },

    update() {
      try {
        this.value.value = this.enabled ? JSON.stringify({
          ...this.network,
          exclude: (this.network.exclude || []).filter((e) => !!e?.trim()),
        }) : '';
      } catch (e) {
        console.error('Failed to stringify network config:', e); // eslint-disable-line no-console
        this.value.value = '';
      }
    },

    validateInputs() {
      const errors = [];

      if (!this.network.clusterNetwork) {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.vmMigrationNetwork.clusterNetwork') }, true));
      }

      if (!this.network.range) {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.vmMigrationNetwork.range.label') }, true));
      } else if (!isValidCIDR(this.network.range)) {
        errors.push(this.t('harvester.setting.vmMigrationNetwork.range.invalid', null, true));
      }

      if (this.network.vlan === '') {
        errors.push(this.t('validation.required', { key: this.t('harvester.setting.vmMigrationNetwork.vlan') }, true));
      } else {
        const vlan = Number(this.network.vlan);

        if (isNaN(vlan) || vlan < 1 || vlan > 4094) {
          errors.push(this.t('validation.between', {
            key: this.t('harvester.setting.vmMigrationNetwork.vlan'),
            min: 1,
            max: 4094,
          }, true));
        }
      }

      for (const cidr of this.network.exclude || []) {
        if (cidr && !isValidCIDR(cidr)) {
          errors.push(this.t('harvester.setting.storageNetwork.exclude.invalid', { value: cidr }, true));
        }
      }

      return errors;
    },

    async willSave() {
      if (!this.enabled) {
        this.useDefault();

        return Promise.resolve();
      }

      this.update();

      const errors = this.validateInputs();

      return errors.length ? Promise.reject(errors) : Promise.resolve();
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-for="(errorMsg, index) in allErrors"
      :key="index"
      color="error"
    >
      {{ errorMsg }}
    </Banner>
    <RadioGroup
      v-model:value="enabled"
      class="mb-20"
      name="enableMigrationNetwork"
      :options="[true, false]"
      :labels="[t('generic.enabled'), t('generic.disabled')]"
      @update:value="update"
    />
    <template v-if="enabled">
      <LabeledSelect
        v-model:value="network.clusterNetwork"
        required
        label-key="harvester.setting.vmMigrationNetwork.clusterNetwork"
        class="mb-20"
        :mode="mode"
        :options="clusterNetworkOptions"
        :disabled="disableEdit"
        @update:value="update"
      />
      <LabeledInput
        v-model:value.number="network.vlan"
        required
        type="number"
        class="mb-20"
        :min="1"
        :max="4094"
        :mode="mode"
        placeholder="e.g. 1 - 4094"
        label-key="harvester.setting.vmMigrationNetwork.vlan"
        :disabled="disableEdit"
        @update:value="inputVlan"
      />
      <LabeledInput
        v-model:value="network.range"
        required
        class="mb-5"
        :mode="mode"
        :placeholder="t('harvester.setting.vmMigrationNetwork.range.placeholder')"
        label-key="harvester.setting.vmMigrationNetwork.range.label"
        :disabled="disableEdit"
        @update:value="update"
      />
      <ArrayList
        v-model:value="network.exclude"
        :show-header="true"
        :default-add-value="''"
        :mode="mode"
        :add-disabled="disableEdit"
        :add-label="t('harvester.setting.vmMigrationNetwork.exclude.addButton')"
        :value-label="t('harvester.setting.vmMigrationNetwork.exclude.label')"
        :value-placeholder="t('harvester.setting.storageNetwork.exclude.placeholder')"
        @update:value="update"
      />
    </template>
  </div>
</template>
