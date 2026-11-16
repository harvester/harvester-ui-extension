<script>
import isEqual from 'lodash/isEqual';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import ArrayList from '@shell/components/form/ArrayList';
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

// Values Harvester installs before anyone sets up BGP. The addresses are documentation addresses, never a real neighbor.
const PLACEHOLDER_NEIGHBORS = ['192.0.2.1', '2001:db8::1'];
const PLACEHOLDER_AS = { neighborAS: 64512, clusterAS: 64513 };

const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);
const cleanList = (list) => [...new Set((list || []).map((item) => `${ item || '' }`.trim()).filter(Boolean))];
const isIpv6 = (ip) => isValidIP(ip) && !isIpv4(ip);
const isAsNumber = (value) => /^\d+$/.test(`${ value ?? '' }`.trim()) && Number(value) >= 1 && Number(value) <= AS_MAX;
const asText = (value) => `${ value ?? '' }`.trim();

export default {
  name: 'EditAddonKubeovnOperator',

  components: {
    ArrayList,
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
      configuration: null,
      bgpEnabled:    false,
      nodeNames:     [],
      neighbors:     [],
      neighborAS:    '',
      clusterAS:     '',
      routerID:      '',
      nextHopV4:     '',
      nextHopV6:     '',
      loadedState:   null,
      bgpErrors:     [],
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

    // Inline checks, shown under each field once it has been touched. saveBgp runs the same checks.
    neighborRules() {
      return [(value) => this.neighborError(value)];
    },

    neighborASRules() {
      return [(value) => this.asError('neighborAS', value)];
    },

    clusterASRules() {
      return [(value) => this.asError('clusterAS', value)];
    },

    routerIDRules() {
      return [(value) => this.routerIDError(value)];
    },

    nextHopV4Rules() {
      return [(value) => this.nextHopError('nextHopV4', value, isIpv4)];
    },

    nextHopV6Rules() {
      return [(value) => this.nextHopError('nextHopV6', value, isIpv6)];
    },
  },

  methods: {
    loadBgp(bgp = {}) {
      const nextHops = splitList(bgp.nextHops);
      const unconfigured = !splitList(bgp.nodeNames).length &&
        bgp.neighborAS === PLACEHOLDER_AS.neighborAS && bgp.clusterAS === PLACEHOLDER_AS.clusterAS;

      this.nodeNames = splitList(bgp.nodeNames);
      this.bgpEnabled = this.nodeNames.length > 0;
      this.neighbors = [...splitList(bgp.neighborV4Address), ...splitList(bgp.neighborV6Address)].filter((ip) => !PLACEHOLDER_NEIGHBORS.includes(ip));
      // An untouched install only has placeholder AS numbers: show empty fields instead of values nobody chose
      this.neighborAS = unconfigured ? '' : bgp.neighborAS ?? '';
      this.clusterAS = unconfigured ? '' : bgp.clusterAS ?? '';
      this.routerID = bgp.routerID || '';
      // The speaker uses the last next hop of each family
      this.nextHopV4 = nextHops.filter(isIpv4).pop() || '';
      this.nextHopV6 = nextHops.filter(isIpv6).pop() || '';
      this.loadedState = this.formState();
    },

    formState() {
      return {
        enabled:    this.bgpEnabled,
        nodeNames:  [...this.nodeNames],
        neighbors:  cleanList(this.neighbors),
        neighborAS: asText(this.neighborAS),
        clusterAS:  asText(this.clusterAS),
        routerID:   this.routerID.trim(),
        nextHopV4:  this.nextHopV4.trim(),
        nextHopV6:  this.nextHopV6.trim(),
      };
    },

    neighborError(value) {
      const ip = `${ value || '' }`.trim();

      return ip && !isValidIP(ip) ? this.t('harvester.bgp.validation.neighborAddress', null, true) : undefined;
    },

    asError(field, value) {
      return isAsNumber(value) ? undefined : this.t('harvester.bgp.validation.asNumber', { key: this.t(`harvester.bgp.${ field }.label`), max: AS_MAX }, true);
    },

    routerIDError(value) {
      const ip = `${ value || '' }`.trim();

      if (!ip) {
        return undefined;
      }

      if (!isIpv4(ip)) {
        return this.t('harvester.bgp.validation.routerID', null, true);
      }

      // Every speaker needs its own router ID, and this one would go to every selected host
      return this.nodeNames.length > 1 ? this.t('harvester.bgp.validation.routerIDMultipleHosts', null, true) : undefined;
    },

    nextHopError(field, value, isFamily) {
      const ip = `${ value || '' }`.trim();
      const key = isFamily === isIpv4 ? 'ipv4' : 'ipv6';

      return ip && !isFamily(ip) ? this.t(`harvester.bgp.validation.${ key }`, { key: this.t(`harvester.bgp.${ field }.label`) }, true) : undefined;
    },

    validateBgp() {
      if (!this.bgpEnabled) {
        return [];
      }

      const neighbors = cleanList(this.neighbors);
      const errors = [];

      if (!this.nodeNames.length) {
        errors.push(this.t('harvester.bgp.validation.hostsRequired', null, true));
      }

      if (!neighbors.length) {
        errors.push(this.t('harvester.bgp.validation.neighborRequired', null, true));
      } else if (neighbors.some((ip) => this.neighborError(ip))) {
        errors.push(this.neighborError(neighbors.find((ip) => this.neighborError(ip))));
      }

      errors.push(
        this.asError('neighborAS', this.neighborAS),
        this.asError('clusterAS', this.clusterAS),
        this.routerIDError(this.routerID),
        this.nextHopError('nextHopV4', this.nextHopV4, isIpv4),
        this.nextHopError('nextHopV6', this.nextHopV6, isIpv6),
      );

      return errors.filter(Boolean);
    },

    toBgpSpec(current = {}) {
      const bgp = { ...current };

      // Disabled: no host runs the speaker. Keep the other values for when it is turned back on.
      if (!this.bgpEnabled) {
        delete bgp.nodeNames;

        return bgp;
      }

      const state = this.formState();

      Object.assign(bgp, {
        nodeNames:         state.nodeNames.join(','),
        neighborV4Address: state.neighbors.filter(isIpv4).join(','),
        neighborV6Address: state.neighbors.filter(isIpv6).join(','),
        neighborAS:        Number(state.neighborAS),
        clusterAS:         Number(state.clusterAS),
        routerID:          state.routerID,
        nextHops:          [state.nextHopV4, state.nextHopV6].filter(Boolean).join(','),
      });

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
      if (!this.showBgp || this.bgpMode !== _EDIT || isEqual(this.formState(), this.loadedState)) {
        return;
      }

      const errors = this.validateBgp();

      if (errors.length) {
        return Promise.reject(errors);
      }

      try {
        // The operator keeps updating the Configuration's status, so the copy loaded with the form goes stale
        // and saving it fails with a conflict. Save the BGP values on top of the latest copy instead.
        const inStore = this.$store.getters['currentProduct'].inStore;
        const latest = await this.$store.dispatch(`${ inStore }/find`, {
          type: HCI.KUBEOVN_CONFIG, id: CONFIGURATION_ID, opt: { force: true }
        });
        const configuration = await this.$store.dispatch(`${ inStore }/clone`, { resource: latest });
        const bgp = this.toBgpSpec(configuration.spec?.bgp);

        if (!isEqual(bgp, configuration.spec?.bgp || {})) {
          configuration.spec = { ...configuration.spec, bgp };
          await configuration.save();
        }

        // Saved: if the add-on save fails and Save is pressed again, don't save the Configuration twice
        this.loadedState = this.formState();
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
      <RadioGroup
        v-model:value="bgpEnabled"
        data-testid="bgp-enabled"
        class="mt-20"
        name="bgp-enabled"
        :mode="bgpMode"
        :label="t('harvester.bgp.enabled.label')"
        :options="[true, false]"
        :labels="[t('generic.enabled'), t('generic.disabled')]"
        tooltip-key="harvester.bgp.enabled.tooltip"
      />
      <template v-if="bgpEnabled">
        <div class="row mt-20">
          <div class="col span-12">
            <LabeledSelect
              v-model:value="nodeNames"
              data-testid="bgp-node-names"
              :mode="bgpMode"
              :multiple="true"
              :required="true"
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
              v-model:value="clusterAS"
              data-testid="bgp-cluster-as"
              type="number"
              min="1"
              :required="true"
              :mode="bgpMode"
              :rules="clusterASRules"
              :label="t('harvester.bgp.clusterAS.label')"
              :placeholder="t('harvester.bgp.clusterAS.placeholder')"
              :tooltip="t('harvester.bgp.clusterAS.tooltip')"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="routerID"
              data-testid="bgp-router-id"
              :mode="bgpMode"
              :rules="routerIDRules"
              :label="t('harvester.bgp.routerID.label')"
              :placeholder="t('harvester.bgp.routerID.placeholder', null, true)"
              :tooltip="t('harvester.bgp.routerID.tooltip')"
            />
          </div>
        </div>

        <div class="row mt-20">
          <div class="col span-6">
            <ArrayList
              v-model:value="neighbors"
              data-testid="bgp-neighbors"
              :mode="bgpMode"
              :initial-empty-row="true"
              :rules="neighborRules"
              :title="t('harvester.bgp.neighbors.label')"
              :protip="t('harvester.bgp.neighbors.tooltip')"
              :value-placeholder="t('harvester.bgp.neighbors.placeholder')"
              :add-label="t('harvester.bgp.neighbors.add')"
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
              :required="true"
              :mode="bgpMode"
              :rules="neighborASRules"
              :label="t('harvester.bgp.neighborAS.label')"
              :placeholder="t('harvester.bgp.neighborAS.placeholder')"
              :tooltip="t('harvester.bgp.neighborAS.tooltip')"
            />
          </div>
        </div>

        <h3 class="mt-20">
          {{ t('harvester.bgp.sections.advanced') }}
        </h3>
        <div class="row">
          <div class="col span-6">
            <LabeledInput
              v-model:value="nextHopV4"
              data-testid="bgp-next-hop-v4"
              :mode="bgpMode"
              :rules="nextHopV4Rules"
              :label="t('harvester.bgp.nextHopV4.label')"
              :placeholder="t('harvester.bgp.nextHopV4.placeholder', null, true)"
              :tooltip="t('harvester.bgp.nextHopV4.tooltip')"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="nextHopV6"
              data-testid="bgp-next-hop-v6"
              :mode="bgpMode"
              :rules="nextHopV6Rules"
              :label="t('harvester.bgp.nextHopV6.label')"
              :placeholder="t('harvester.bgp.nextHopV6.placeholder', null, true)"
              :tooltip="t('harvester.bgp.nextHopV6.tooltip')"
            />
          </div>
        </div>
      </template>
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
