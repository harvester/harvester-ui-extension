<script>
import isEqual from 'lodash/isEqual';
import ArrayList from '@shell/components/form/ArrayList';
import CruResource from '@shell/components/CruResource';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import Loading from '@shell/components/Loading';
import MessageLink from '@shell/components/MessageLink';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { Banner } from '@components/Banner';
import { NODE } from '@shell/config/types';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { isIpv4 } from '@shell/utils/string';
import { isValidIP } from '@shell/utils/validators/cidr';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../../../../types';
import { ADD_ONS } from '../../../../config/harvester-map';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { KUBEOVN_CONFIGURATION_ID, PLACEHOLDER_AS, isIpv6 } from '../../../../models/kubeovn.io.configuration';

const AS_MAX = 4294967294;

const cleanList = (list) => [...new Set((list || []).map((item) => `${ item || '' }`.trim()).filter(Boolean))];
const isAsNumber = (value) => /^\d+$/.test(`${ value ?? '' }`.trim()) && Number(value) >= 1 && Number(value) <= AS_MAX;
const asText = (value) => `${ value ?? '' }`.trim();

export default {
  name: 'HarvesterOverlayNetworkBgp',

  components: {
    ArrayList,
    Banner,
    CruResource,
    LabeledInput,
    LabeledSelect,
    Loading,
    MessageLink,
    RadioGroup,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = await allHash({
      addons: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS }),
      nodes:  this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
    });

    this.addonEnabled = hash.addons.find((addon) => addon.name === ADD_ONS.KUBEOVN_OPERATOR)?.spec?.enabled === true;

    if (!this.addonEnabled || !this.featureEnabled) {
      return;
    }

    try {
      const configuration = await this.$store.dispatch(`${ inStore }/find`, { type: HCI.KUBEOVN_CONFIG, id: KUBEOVN_CONFIGURATION_ID });

      this.configuration = await this.$store.dispatch(`${ inStore }/clone`, { resource: configuration });
      this.loadBgp(this.configuration);
    } catch (e) {
      this.errors = exceptionToErrorsArray(e);
    }
  },

  data() {
    return {
      addonEnabled:  false,
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
      errors:        [],
    };
  },

  computed: {
    featureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('kubeovnBgp');
    },

    mode() {
      return this.configuration?.canUpdate ? _EDIT : _VIEW;
    },

    settingsLocation() {
      return { name: `${ PRODUCT_NAME }-c-cluster-overlay-network-settings` };
    },

    addonLocation() {
      return {
        name:   `${ PRODUCT_NAME }-c-cluster-resource-namespace-id`,
        params: {
          resource: HCI.ADD_ONS, namespace: 'kube-system', id: ADD_ONS.KUBEOVN_OPERATOR
        },
        query: { mode: _EDIT },
      };
    },

    // Save stays disabled until the form is valid; each field shows its own error
    validationPassed() {
      return this.validateBgp().length === 0;
    },

    nodeOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE) || [];

      return nodes.map((node) => ({
        label: node.nameDisplay,
        value: node.id,
      }));
    },

    // Each field shows its own error once touched, so a disabled Save always has a visible reason
    nodeNamesRules() {
      return [(value) => ((value || []).length ? undefined : this.t('harvester.bgp.validation.hostsRequired', null, true))];
    },

    neighborRules() {
      return [(value) => (cleanList(this.neighbors).length ? this.neighborError(value) : this.t('harvester.bgp.validation.neighborRequired', null, true))];
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
    loadBgp(configuration) {
      const bgp = configuration.bgp;
      const unconfigured = !configuration.bgpSpeakerHosts.length &&
        bgp.neighborAS === PLACEHOLDER_AS.neighborAS && bgp.clusterAS === PLACEHOLDER_AS.clusterAS;

      this.nodeNames = configuration.bgpSpeakerHosts;
      this.bgpEnabled = this.nodeNames.length > 0;
      this.neighbors = configuration.bgpNeighbors;
      // An untouched install only has placeholder AS numbers: show empty fields instead of values nobody chose
      this.neighborAS = unconfigured ? '' : bgp.neighborAS ?? '';
      this.clusterAS = unconfigured ? '' : bgp.clusterAS ?? '';
      this.routerID = bgp.routerID || '';
      // The speaker uses the last next hop of each family
      this.nextHopV4 = configuration.bgpNextHops.filter(isIpv4).pop() || '';
      this.nextHopV6 = configuration.bgpNextHops.filter(isIpv6).pop() || '';
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

    async save(buttonCb) {
      // Save is disabled while the form is invalid; this is the backstop
      const errors = this.validateBgp();

      if (errors.length) {
        this.errors = errors;
        buttonCb(false);

        return;
      }

      try {
        if (!isEqual(this.formState(), this.loadedState)) {
          // The operator keeps updating the Configuration's status, so the copy loaded with the page goes stale
          // and saving it fails with a conflict. Save the BGP values on top of the latest copy instead.
          const inStore = this.$store.getters['currentProduct'].inStore;
          const latest = await this.$store.dispatch(`${ inStore }/find`, {
            type: HCI.KUBEOVN_CONFIG, id: KUBEOVN_CONFIGURATION_ID, opt: { force: true }
          });
          const configuration = await this.$store.dispatch(`${ inStore }/clone`, { resource: latest });
          const bgp = this.toBgpSpec(configuration.spec?.bgp);

          if (!isEqual(bgp, configuration.spec?.bgp || {})) {
            configuration.spec = { ...configuration.spec, bgp };
            await configuration.save();
          }
        }

        buttonCb(true);
        this.done();
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        buttonCb(false);
      }
    },

    done() {
      this.$router.push(this.settingsLocation);
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <h1 class="mb-20">
      <router-link :to="settingsLocation">
        {{ t('harvester.overlayNetworkSettings.title') }}:
      </router-link>
      {{ t('harvester.bgp.label') }}
    </h1>
    <Banner
      v-if="!featureEnabled"
      color="warning"
      :label="t('harvester.bgp.unsupported')"
    />
    <Banner
      v-else-if="!addonEnabled"
      color="warning"
    >
      <MessageLink
        :to="addonLocation"
        prefix-label="harvester.overlayNetworkSettings.noAddonEnabled.prefix"
        middle-label="harvester.overlayNetworkSettings.noAddonEnabled.middle"
        suffix-label="harvester.overlayNetworkSettings.noAddonEnabled.suffix"
      />
    </Banner>
    <CruResource
      v-else-if="configuration"
      :resource="configuration"
      :mode="mode"
      :can-yaml="false"
      :cancel-event="true"
      :validation-passed="validationPassed"
      :errors="errors"
      @finish="save"
      @cancel="done"
      @error="e => errors = e"
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
        :mode="mode"
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
              :mode="mode"
              :multiple="true"
              :required="true"
              :rules="nodeNamesRules"
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
              :mode="mode"
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
              :mode="mode"
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
              :mode="mode"
              :initial-empty-row="true"
              :required="true"
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
              :mode="mode"
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
              :mode="mode"
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
              :mode="mode"
              :rules="nextHopV6Rules"
              :label="t('harvester.bgp.nextHopV6.label')"
              :placeholder="t('harvester.bgp.nextHopV6.placeholder', null, true)"
              :tooltip="t('harvester.bgp.nextHopV6.tooltip')"
            />
          </div>
        </div>
      </template>
    </CruResource>
    <template v-else>
      <!-- The Configuration could not be read: the form is not shown, so its errors are shown here -->
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </template>
  </div>
</template>
