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
import { RcSection } from '@components/RcSection';
import { RcContentGroup } from '@components/Layout';
import { NODE } from '@shell/config/types';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { isIpv4 } from '@shell/utils/string';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../../../../types';
import { ADD_ONS } from '../../../../config/harvester-map';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { KUBEOVN_CONFIGURATION_ID, isIpv6, isPlaceholderNeighbor, withoutLeadingZeros } from '../../../../models/kubeovn.io.configuration';

const AS_MAX = 4294967294;

const cleanList = (list) => [...new Set((list || []).map((item) => `${ item || '' }`.trim()).filter(Boolean))];
const isAsNumber = (value) => /^\d+$/.test(`${ value ?? '' }`.trim()) && Number(value) >= 1 && Number(value) <= AS_MAX;
const asText = (value) => `${ value ?? '' }`.trim();

// Cluster-wide Kube-OVN settings, edited on this page. For now there is one section, the BGP speaker.
export default {
  name: 'HarvesterOverlayNetworkSettings',

  components: {
    ArrayList,
    Banner,
    CruResource,
    LabeledInput,
    LabeledSelect,
    Loading,
    MessageLink,
    RadioGroup,
    RcContentGroup,
    RcSection,
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
      neighborsV4:   [],
      neighborsV6:   [],
      neighborAS:    '',
      clusterAS:     '',
      routerID:      '',
      nextHopV4:     '',
      nextHopV6:     '',
      loadedState:   null,
      // Bumped after a save so the form is drawn again from the saved values, as after a reload
      formKey:       0,
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

    isView() {
      return this.mode === _VIEW;
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

    neighborV4Rules() {
      return [(value) => this.neighborError(value, isIpv4)];
    },

    neighborV6Rules() {
      return [(value) => this.neighborError(value, isIpv6)];
    },

    // One neighbor in either list is enough
    hasNeighbor() {
      return cleanList(this.neighborsV4).length + cleanList(this.neighborsV6).length > 0;
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
      const untouched = configuration.bgpUntouched;

      this.nodeNames = configuration.bgpSpeakerHosts;
      this.bgpEnabled = this.nodeNames.length > 0;
      this.neighborsV4 = configuration.bgpNeighborsV4;
      this.neighborsV6 = configuration.bgpNeighborsV6;
      // An untouched install only has placeholder AS numbers: show empty fields instead of values nobody chose
      this.neighborAS = untouched ? '' : bgp.neighborAS ?? '';
      this.clusterAS = untouched ? '' : bgp.clusterAS ?? '';
      this.routerID = bgp.routerID || '';
      // The speaker uses the last next hop of each family
      this.nextHopV4 = configuration.bgpNextHops.filter(isIpv4).pop() || '';
      this.nextHopV6 = configuration.bgpNextHops.filter(isIpv6).pop() || '';
      this.loadedState = this.formState();
    },

    formState() {
      return {
        enabled:     this.bgpEnabled,
        nodeNames:   [...this.nodeNames],
        neighborsV4: cleanList(this.neighborsV4),
        neighborsV6: cleanList(this.neighborsV6),
        neighborAS:  asText(this.neighborAS),
        clusterAS:   asText(this.clusterAS),
        routerID:    this.routerID.trim(),
        nextHopV4:   this.nextHopV4.trim(),
        nextHopV6:   this.nextHopV6.trim(),
      };
    },

    neighborError(value, isFamily) {
      const ip = `${ value || '' }`.trim();

      if (!ip) {
        return this.hasNeighbor ? undefined : this.t('harvester.bgp.validation.neighborRequired', null, true);
      }

      if (withoutLeadingZeros(ip)) {
        return this.leadingZeroError(ip);
      }

      // Harvester installs these before anyone sets up BGP, and this page hides them, so saving one would lose it
      if (isPlaceholderNeighbor(ip)) {
        return this.t('harvester.bgp.validation.placeholderNeighbor', { ip }, true);
      }

      const key = isFamily === isIpv4 ? 'neighborV4' : 'neighborV6';

      return isFamily(ip) ? undefined : this.t(`harvester.bgp.validation.${ key }`, { ip }, true);
    },

    asError(field, value) {
      return isAsNumber(value) ? undefined : this.t('harvester.bgp.validation.asNumber', { key: this.t(`harvester.bgp.${ field }.label`), max: AS_MAX }, true);
    },

    // The speaker can't parse these, so it would not start
    leadingZeroError(ip) {
      return this.t('harvester.bgp.validation.leadingZero', { ip, fixed: withoutLeadingZeros(ip) }, true);
    },

    routerIDError(value) {
      const ip = `${ value || '' }`.trim();

      if (!ip) {
        return undefined;
      }

      if (withoutLeadingZeros(ip)) {
        return this.leadingZeroError(ip);
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

      if (ip && withoutLeadingZeros(ip)) {
        return this.leadingZeroError(ip);
      }

      return ip && !isFamily(ip) ? this.t(`harvester.bgp.validation.${ key }`, { key: this.t(`harvester.bgp.${ field }.label`) }, true) : undefined;
    },

    validateBgp() {
      if (!this.bgpEnabled) {
        return [];
      }

      const errors = [];

      if (!this.nodeNames.length) {
        errors.push(this.t('harvester.bgp.validation.hostsRequired', null, true));
      }

      if (!this.hasNeighbor) {
        errors.push(this.t('harvester.bgp.validation.neighborRequired', null, true));
      } else {
        // The first bad address is enough here: the lists flag each one
        errors.push([
          ...cleanList(this.neighborsV4).map((ip) => this.neighborError(ip, isIpv4)),
          ...cleanList(this.neighborsV6).map((ip) => this.neighborError(ip, isIpv6)),
        ].find(Boolean));
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
        neighborV4Address: state.neighborsV4.join(','),
        neighborV6Address: state.neighborsV6.join(','),
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

          // Stay on the page, showing what was saved
          this.configuration = configuration;
          this.loadBgp(configuration);
          this.formKey++;
        }

        this.errors = [];
        buttonCb(true);
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        buttonCb(false);
      }
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <h1 class="mb-20">
      {{ t('harvester.overlayNetworkSettings.title') }}
    </h1>
    <CruResource
      v-if="featureEnabled && addonEnabled && configuration"
      :resource="configuration"
      :mode="mode"
      :can-yaml="false"
      :show-cancel="false"
      :validation-passed="validationPassed"
      :errors="errors"
      @finish="save"
      @error="e => errors = e"
    >
      <!-- One section per setting; Save covers them all -->
      <RcSection
        :key="formKey"
        :title="t('harvester.bgp.label')"
        type="primary"
        mode="with-header"
        :expandable="false"
        data-testid="bgp-section"
      >
        <RcContentGroup>
          <Banner
            color="info"
            class="mt-0 mb-0"
            :label="t('harvester.bgp.description')"
          />
          <!-- The section title names this choice, as in the shell's own sections -->
          <RadioGroup
            v-model:value="bgpEnabled"
            data-testid="bgp-enabled"
            name="bgp-enabled"
            :aria-label="t('harvester.bgp.label')"
            :mode="mode"
            :options="[true, false]"
            :labels="[t('generic.enabled'), t('generic.disabled')]"
          />
        </RcContentGroup>
        <template v-if="bgpEnabled">
          <RcContentGroup>
            <div class="row">
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
            <div class="row">
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
          </RcContentGroup>
          <RcSection
            :title="t('harvester.bgp.neighbors.label')"
            type="secondary"
            mode="with-header"
            :expandable="false"
            data-testid="bgp-neighbors-section"
          >
            <!-- One neighbor in either list is enough, so neither list is marked required -->
            <p
              v-if="!isView"
              class="mb-0"
            >
              {{ t('harvester.bgp.neighbors.description') }}
            </p>
            <div class="row">
              <div class="col span-6">
                <ArrayList
                  v-model:value="neighborsV4"
                  data-testid="bgp-neighbors-v4"
                  :mode="mode"
                  :initial-empty-row="true"
                  :rules="neighborV4Rules"
                  :show-header="true"
                  :value-label="t('harvester.bgp.neighborsV4.label')"
                  :a11y-label="t('harvester.bgp.neighborsV4.label')"
                  :value-placeholder="t('harvester.bgp.neighborsV4.placeholder')"
                  :add-label="t('harvester.bgp.neighborsV4.add')"
                />
              </div>
              <div class="col span-6">
                <ArrayList
                  v-model:value="neighborsV6"
                  data-testid="bgp-neighbors-v6"
                  :mode="mode"
                  :initial-empty-row="true"
                  :rules="neighborV6Rules"
                  :show-header="true"
                  :value-label="t('harvester.bgp.neighborsV6.label')"
                  :a11y-label="t('harvester.bgp.neighborsV6.label')"
                  :value-placeholder="t('harvester.bgp.neighborsV6.placeholder')"
                  :add-label="t('harvester.bgp.neighborsV6.add')"
                />
              </div>
            </div>
            <div class="row">
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
          </RcSection>
          <RcSection
            :title="t('harvester.bgp.sections.advanced')"
            type="secondary"
            mode="with-header"
            :expandable="false"
            data-testid="bgp-advanced-section"
          >
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
          </RcSection>
        </template>
      </RcSection>
    </CruResource>
    <!-- No form: the section says why -->
    <RcSection
      v-else
      :title="t('harvester.bgp.label')"
      type="primary"
      mode="with-header"
      :expandable="false"
      data-testid="bgp-section"
    >
      <Banner
        v-if="!featureEnabled"
        color="warning"
        class="mt-0 mb-0"
        :label="t('harvester.bgp.unsupported')"
      />
      <Banner
        v-else-if="!addonEnabled"
        color="warning"
        class="mt-0 mb-0"
      >
        <MessageLink
          :to="addonLocation"
          prefix-label="harvester.overlayNetworkSettings.noAddonEnabled.prefix"
          middle-label="harvester.overlayNetworkSettings.noAddonEnabled.middle"
          suffix-label="harvester.overlayNetworkSettings.noAddonEnabled.suffix"
        />
      </Banner>
      <!-- The Configuration could not be read -->
      <template v-else>
        <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
          class="mt-0 mb-0"
          :label="err"
        />
      </template>
    </RcSection>
  </div>
</template>
