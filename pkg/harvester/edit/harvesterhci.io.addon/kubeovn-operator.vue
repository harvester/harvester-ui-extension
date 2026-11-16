<script>
import isEqual from 'lodash/isEqual';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { Banner } from '@components/Banner';
import { NODE } from '@shell/config/types';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { isIpv4 } from '@shell/utils/string';
import { isValidIP } from '@shell/utils/validators/cidr';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../types';

// The kubeovn-operator keeps a single Configuration, and the BGP speaker reads its spec.bgp
const CONFIGURATION_ID = 'kube-system/kubeovn';
const AS_MAX = 4294967294;

const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);
const isIpv6 = (ip) => isValidIP(ip) && !isIpv4(ip);
const isAsNumber = (value) => /^\d+$/.test(`${ value }`.trim()) && Number(value) >= 1 && Number(value) <= AS_MAX;

export default {
  name: 'EditAddonKubeovnOperator',

  components: {
    Banner,
    LabeledInput,
    LabeledSelect,
    RadioGroup,
    Tab,
    Tabbed,
  },

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },

    mode: {
      type:     String,
      required: true
    },

    registerBeforeHook: {
      type:     Function,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    // The Configuration only exists while the add-on is enabled, and spec.bgp needs v1.10.0
    if (!this.value.spec?.enabled || !this.bgpFeatureEnabled || !this.$store.getters[`${ inStore }/schemaFor`](HCI.KUBEOVN_CONFIG)) {
      return;
    }

    try {
      const [configuration] = await Promise.all([
        this.$store.dispatch(`${ inStore }/find`, { type: HCI.KUBEOVN_CONFIG, id: CONFIGURATION_ID }),
        this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      ]);

      this.configuration = await this.$store.dispatch(`${ inStore }/clone`, { resource: configuration });
      this.loadBgp(this.configuration.spec?.bgp);
    } catch (e) {
      this.bgpErrors = exceptionToErrorsArray(e);
    }
  },

  data() {
    return {
      configuration:     null,
      nodeNames:         [],
      neighborV4Address: '',
      neighborV6Address: '',
      neighborAS:        '',
      clusterAS:         '',
      routerID:          '',
      nextHops:          '',
      bgpErrors:         [],
    };
  },

  created() {
    this.registerBeforeHook(this.saveBgp, 'saveBgp');
  },

  computed: {
    bgpFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('kubeovnBgp');
    },

    showBgp() {
      return !!this.configuration && this.value.spec.enabled === true;
    },

    bgpMode() {
      return this.mode === _EDIT && this.configuration?.canUpdate ? _EDIT : _VIEW;
    },

    nodeOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE) || [];

      return nodes.map((node) => ({
        label: node.nameDisplay,
        value: node.id,
      }));
    },
  },

  methods: {
    loadBgp(bgp = {}) {
      this.nodeNames = splitList(bgp.nodeNames);
      this.neighborV4Address = bgp.neighborV4Address || '';
      this.neighborV6Address = bgp.neighborV6Address || '';
      this.neighborAS = bgp.neighborAS ?? '';
      this.clusterAS = bgp.clusterAS ?? '';
      this.routerID = bgp.routerID || '';
      this.nextHops = bgp.nextHops || '';
    },

    validateBgp() {
      const errors = [];
      const neighborV4 = splitList(this.neighborV4Address);
      const neighborV6 = splitList(this.neighborV6Address);
      const nextHops = splitList(this.nextHops);

      if (this.nodeNames.length && !neighborV4.length && !neighborV6.length) {
        errors.push(this.t('harvester.bgp.validation.neighborRequired', null, true));
      }

      if (neighborV4.some((ip) => !isIpv4(ip))) {
        errors.push(this.t('harvester.bgp.validation.ipv4List', { key: this.t('harvester.bgp.neighborV4Address.label') }, true));
      }

      if (neighborV6.some((ip) => !isIpv6(ip))) {
        errors.push(this.t('harvester.bgp.validation.ipv6List', { key: this.t('harvester.bgp.neighborV6Address.label') }, true));
      }

      [['neighborAS', this.neighborAS], ['clusterAS', this.clusterAS]].forEach(([field, value]) => {
        if (!isAsNumber(value)) {
          errors.push(this.t('harvester.bgp.validation.asNumber', { key: this.t(`harvester.bgp.${ field }.label`), max: AS_MAX }, true));
        }
      });

      if (this.routerID.trim() && !isIpv4(this.routerID.trim())) {
        errors.push(this.t('harvester.bgp.validation.routerID', null, true));
      }

      if (nextHops.some((ip) => !isValidIP(ip)) || nextHops.filter(isIpv4).length > 1 || nextHops.filter(isIpv6).length > 1) {
        errors.push(this.t('harvester.bgp.validation.nextHops', null, true));
      }

      return errors;
    },

    toBgpSpec() {
      const bgp = {
        ...(this.configuration.spec?.bgp || {}),
        nodeNames:         this.nodeNames.join(','),
        neighborV4Address: splitList(this.neighborV4Address).join(','),
        neighborV6Address: splitList(this.neighborV6Address).join(','),
        neighborAS:        Number(this.neighborAS),
        clusterAS:         Number(this.clusterAS),
        routerID:          this.routerID.trim(),
        nextHops:          splitList(this.nextHops).join(','),
      };

      // The CRD omits empty strings, so drop them instead of storing ''
      Object.keys(bgp).forEach((key) => {
        if (bgp[key] === '') {
          delete bgp[key];
        }
      });

      return bgp;
    },

    // Runs before the add-on is saved. BGP lives in the Kube-OVN Configuration, not in the add-on values.
    async saveBgp() {
      if (!this.showBgp || this.bgpMode !== _EDIT) {
        return;
      }

      const errors = this.validateBgp();

      if (errors.length) {
        return Promise.reject(errors);
      }

      const bgp = this.toBgpSpec();

      if (isEqual(bgp, this.configuration.spec?.bgp || {})) {
        return;
      }

      this.configuration.spec = { ...this.configuration.spec, bgp };

      try {
        await this.configuration.save();
      } catch (e) {
        // Plain messages, so the form doesn't treat a conflict on the Configuration as one on the add-on
        return Promise.reject(exceptionToErrorsArray(e));
      }
    },
  },
};
</script>

<template>
  <Tabbed :side-tabs="true">
    <Tab
      name="basic"
      :label="t('generic.basic')"
      :weight="99"
    >
      <RadioGroup
        v-model:value="value.spec.enabled"
        class="mb-20"
        name="model"
        :mode="mode"
        :options="[true,false]"
        :labels="[t('generic.enabled'), t('generic.disabled')]"
      />
      <Banner
        v-for="(err, i) in bgpErrors"
        :key="i"
        color="error"
        :label="err"
      />
    </Tab>
    <Tab
      v-if="showBgp"
      name="bgp"
      :label="t('harvester.bgp.label')"
      :weight="98"
    >
      <Banner
        color="info"
        class="mt-0"
        :label="t('harvester.bgp.description')"
      />
      <div class="row mt-20">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="nodeNames"
            data-testid="bgp-node-names"
            :mode="bgpMode"
            :multiple="true"
            :options="nodeOptions"
            :label="t('harvester.bgp.nodeNames.label')"
            :placeholder="t('harvester.bgp.nodeNames.placeholder')"
            :tooltip="t('harvester.bgp.nodeNames.tooltip')"
          />
        </div>
      </div>
      <div class="row mt-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="neighborV4Address"
            data-testid="bgp-neighbor-v4"
            :mode="bgpMode"
            :label="t('harvester.bgp.neighborV4Address.label')"
            :placeholder="t('harvester.bgp.neighborV4Address.placeholder')"
            :tooltip="t('harvester.bgp.neighborV4Address.tooltip')"
          />
        </div>
        <div class="col span-6">
          <LabeledInput
            v-model:value="neighborV6Address"
            data-testid="bgp-neighbor-v6"
            :mode="bgpMode"
            :label="t('harvester.bgp.neighborV6Address.label')"
            :placeholder="t('harvester.bgp.neighborV6Address.placeholder')"
            :tooltip="t('harvester.bgp.neighborV6Address.tooltip')"
          />
        </div>
      </div>
      <div class="row mt-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="neighborAS"
            data-testid="bgp-neighbor-as"
            type="number"
            min="1"
            required
            :mode="bgpMode"
            :label="t('harvester.bgp.neighborAS.label')"
            :placeholder="t('harvester.bgp.neighborAS.placeholder')"
            :tooltip="t('harvester.bgp.neighborAS.tooltip')"
          />
        </div>
        <div class="col span-6">
          <LabeledInput
            v-model:value="clusterAS"
            data-testid="bgp-cluster-as"
            type="number"
            min="1"
            required
            :mode="bgpMode"
            :label="t('harvester.bgp.clusterAS.label')"
            :placeholder="t('harvester.bgp.clusterAS.placeholder')"
            :tooltip="t('harvester.bgp.clusterAS.tooltip')"
          />
        </div>
      </div>
      <div class="row mt-20">
        <div class="col span-6">
          <LabeledInput
            v-model:value="routerID"
            data-testid="bgp-router-id"
            :mode="bgpMode"
            :label="t('harvester.bgp.routerID.label')"
            :placeholder="t('harvester.bgp.routerID.placeholder')"
            :tooltip="t('harvester.bgp.routerID.tooltip')"
          />
        </div>
        <div class="col span-6">
          <LabeledInput
            v-model:value="nextHops"
            data-testid="bgp-next-hops"
            :mode="bgpMode"
            :label="t('harvester.bgp.nextHops.label')"
            :placeholder="t('harvester.bgp.nextHops.placeholder')"
            :tooltip="t('harvester.bgp.nextHops.tooltip')"
          />
        </div>
      </div>
    </Tab>
  </Tabbed>
</template>

<style lang="scss" scoped>
  :deep() .radio-group {
    display: flex;
    .radio-container {
      margin-right: 30px;
    }
  }
</style>
