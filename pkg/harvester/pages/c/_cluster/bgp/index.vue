<script>
import Loading from '@shell/components/Loading';
import AsyncButton from '@shell/components/AsyncButton';
import MessageLink from '@shell/components/MessageLink';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Banner } from '@components/Banner';
import { NODE } from '@shell/config/types';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { allHash } from '@shell/utils/promise';
import { isIpv4 } from '@shell/utils/string';
import { isValidIP } from '@shell/utils/validators/cidr';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../../../types';
import { ADD_ONS } from '../../../../config/harvester-map';

// The kubeovn-operator keeps a single Configuration, and the BGP speaker reads its spec.bgp
const CONFIGURATION_ID = 'kube-system/kubeovn';
const AS_MAX = 4294967294;

const splitList = (value) => `${ value || '' }`.split(',').map((item) => item.trim()).filter(Boolean);
const isIpv6 = (ip) => isValidIP(ip) && !isIpv4(ip);
const isAsNumber = (value) => /^\d+$/.test(`${ value }`.trim()) && Number(value) >= 1 && Number(value) <= AS_MAX;

export default {
  name: 'HarvesterBgp',

  components: {
    AsyncButton,
    Banner,
    LabeledInput,
    LabeledSelect,
    Loading,
    MessageLink,
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
      await this.loadConfiguration();
    } catch (e) {
      this.errors = exceptionToErrorsArray(e);
    }
  },

  data() {
    return {
      addonEnabled:      false,
      configuration:     null,
      nodeNames:         [],
      neighborV4Address: '',
      neighborV6Address: '',
      neighborAS:        '',
      clusterAS:         '',
      routerID:          '',
      nextHops:          '',
      errors:            [],
      addonLink:         `${ HCI.ADD_ONS }/kube-system/${ ADD_ONS.KUBEOVN_OPERATOR }?mode=edit`,
    };
  },

  computed: {
    featureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('kubeovnBgp');
    },

    mode() {
      return this.configuration?.canUpdate ? _EDIT : _VIEW;
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
    async loadConfiguration() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const configuration = await this.$store.dispatch(`${ inStore }/find`, { type: HCI.KUBEOVN_CONFIG, id: CONFIGURATION_ID });
      const bgp = configuration.spec?.bgp || {};

      this.configuration = await this.$store.dispatch(`${ inStore }/clone`, { resource: configuration });
      this.nodeNames = splitList(bgp.nodeNames);
      this.neighborV4Address = bgp.neighborV4Address || '';
      this.neighborV6Address = bgp.neighborV6Address || '';
      this.neighborAS = bgp.neighborAS ?? '';
      this.clusterAS = bgp.clusterAS ?? '';
      this.routerID = bgp.routerID || '';
      this.nextHops = bgp.nextHops || '';
    },

    validate() {
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

    async save(buttonCb) {
      this.errors = this.validate();

      if (this.errors.length) {
        buttonCb(false);

        return;
      }

      try {
        this.configuration.spec = { ...this.configuration.spec, bgp: this.toBgpSpec() };
        await this.configuration.save();
        await this.loadConfiguration();
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
        :to="addonLink"
        prefix-label="harvester.bgp.noAddonEnabled.prefix"
        middle-label="harvester.bgp.noAddonEnabled.middle"
        suffix-label="harvester.bgp.noAddonEnabled.suffix"
      />
    </Banner>
    <template v-else-if="configuration">
      <Banner
        color="info"
        :label="t('harvester.bgp.description')"
      />
      <div class="row mt-20">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="nodeNames"
            data-testid="bgp-node-names"
            :mode="mode"
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
            :mode="mode"
            :label="t('harvester.bgp.neighborV4Address.label')"
            :placeholder="t('harvester.bgp.neighborV4Address.placeholder')"
            :tooltip="t('harvester.bgp.neighborV4Address.tooltip')"
          />
        </div>
        <div class="col span-6">
          <LabeledInput
            v-model:value="neighborV6Address"
            data-testid="bgp-neighbor-v6"
            :mode="mode"
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
            :mode="mode"
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
            :mode="mode"
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
            :mode="mode"
            :label="t('harvester.bgp.routerID.label')"
            :placeholder="t('harvester.bgp.routerID.placeholder')"
            :tooltip="t('harvester.bgp.routerID.tooltip')"
          />
        </div>
        <div class="col span-6">
          <LabeledInput
            v-model:value="nextHops"
            data-testid="bgp-next-hops"
            :mode="mode"
            :label="t('harvester.bgp.nextHops.label')"
            :placeholder="t('harvester.bgp.nextHops.placeholder')"
            :tooltip="t('harvester.bgp.nextHops.tooltip')"
          />
        </div>
      </div>
    </template>
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      color="error"
      :label="err"
    />
    <div v-if="configuration && mode === 'edit'">
      <AsyncButton
        data-testid="bgp-save"
        class="pull-right mt-20"
        mode="edit"
        @click="save"
      />
    </div>
  </div>
</template>
