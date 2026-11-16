<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import ArrayList from '@shell/components/form/ArrayList';
import InfoBox from '@shell/components/InfoBox';
import Loading from '@shell/components/Loading';
import MessageLink from '@shell/components/MessageLink';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import UnitInput from '@shell/components/form/UnitInput';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Checkbox } from '@components/Form/Checkbox';
import { RadioGroup } from '@components/Form/Radio';
import { Banner } from '@components/Banner';
import CreateEditView from '@shell/mixins/create-edit-view';
import { _EDIT, _VIEW, MODE } from '@shell/config/query-params';
import { allHash } from '@shell/utils/promise';
import { isValidIP } from '@shell/utils/validators/cidr';
import { HCI } from '../types';

// Limits from the VpcEgressGateway CRD
const MAX_REPLICAS = 10;
const MAX_BFD_VALUE = 3600000;
const MAX_BANDWIDTH_MBPS = 9223372036854;
// A whole number in Mbps, or a quantity in bits per second such as 100M or 1Gi
const BANDWIDTH_PATTERN = /^([0-9]+|([0-9]+(\.[0-9]+)?|\.[0-9]+)(M|Mi|G|Gi))$/;
const BFD_DEFAULTS = {
  enabled: false, minRX: 1000, minTX: 1000, multiplier: 3
};

const isBlank = (value) => value === null || value === undefined || `${ value }`.trim() === '';
const isWholeNumber = (value, min, max) => /^\d+$/.test(`${ value }`.trim()) && Number(value) >= min && Number(value) <= max;
const isValidBandwidth = (value) => BANDWIDTH_PATTERN.test(`${ value }`.trim()) && (!isWholeNumber(value, 0, Infinity) || Number(value) <= MAX_BANDWIDTH_MBPS);
const toBandwidth = (value) => (isWholeNumber(value, 0, Infinity) ? Number(value) : `${ value }`.trim());
const cleanList = (list) => (list || []).map((item) => `${ item || '' }`.trim()).filter(Boolean);
const hasSelectors = (spec) => !!spec?.selectors?.length;

export default {
  name: 'EditVpcEgressGateway',

  emits: ['update:value'],

  components: {
    ArrayList,
    Banner,
    Checkbox,
    CruResource,
    InfoBox,
    LabeledInput,
    LabeledSelect,
    Loading,
    MessageLink,
    NameNsDescription,
    RadioGroup,
    ResourceTabs,
    Tab,
    UnitInput,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    }
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      vpcs:    this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
      subnets: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
    });
  },

  data() {
    const spec = this.value?.spec || {};
    const defaultPolicies = hasSelectors(spec) ? [] : [{ snat: true, subnets: [] }];
    const policies = (spec.policies || defaultPolicies).map((policy) => ({
      ...policy,
      snat:    !!policy.snat,
      subnets: [...(policy.subnets || [])],
    }));

    return {
      vpc:              spec.vpc || '',
      replicas:         spec.replicas ?? 1,
      internalSubnet:   spec.internalSubnet || '',
      externalSubnet:   spec.externalSubnet || '',
      internalIPs:      [...(spec.internalIPs || [])],
      externalIPs:      [...(spec.externalIPs || [])],
      policies,
      bfd:              { ...BFD_DEFAULTS, ...spec.bfd },
      bandwidthIngress: spec.bandwidth?.ingress ?? '',
      bandwidthEgress:  spec.bandwidth?.egress ?? '',
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    allSubnets() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](HCI.SUBNET) || [];
    },

    vpcOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];

      return vpcs.map((vpc) => ({ label: vpc.id, value: vpc.id }));
    },

    vpcSubnetOptions() {
      return this.allSubnets
        .filter((subnet) => subnet.spec?.vpc === this.vpc)
        .map((subnet) => ({ label: subnet.id, value: subnet.id }));
    },

    externalSubnetOptions() {
      return this.allSubnets.map((subnet) => ({ label: subnet.id, value: subnet.id }));
    },

    hasSelectors() {
      return hasSelectors(this.value.spec);
    },

    selectedVpc() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.vpc ? this.$store.getters[`${ inStore }/byId`](HCI.VPC, this.vpc) : null;
    },

    vpcBfdPortDisabled() {
      return !!this.selectedVpc && !this.selectedVpc.bfdPortEnabled;
    },

    vpcEditLocation() {
      const location = this.selectedVpc?.detailLocation;

      return location ? { ...location, query: { [MODE]: _EDIT } } : null;
    },
  },

  watch: {
    vpc(neu, old) {
      if (!old || neu === old) {
        return;
      }

      const vpcSubnets = this.vpcSubnetOptions.map((option) => option.value);

      if (!vpcSubnets.includes(this.internalSubnet)) {
        this.internalSubnet = '';
      }

      this.policies.forEach((policy) => {
        policy.subnets = policy.subnets.filter((subnet) => vpcSubnets.includes(subnet));
      });
    },
  },

  methods: {
    addPolicy() {
      this.policies.push({ snat: true, subnets: [] });
    },

    removePolicy(index) {
      this.policies.splice(index, 1);
    },

    validate() {
      const errors = [];
      const replicas = Number(this.replicas);

      if (!this.value.metadata?.name) {
        errors.push(this.t('validation.required', { key: this.t('generic.name') }, true));
      }

      [
        ['vpc', 'harvester.egressGateway.vpc.label'],
        ['internalSubnet', 'harvester.egressGateway.internalSubnet.label'],
        ['externalSubnet', 'harvester.egressGateway.externalSubnet.label'],
      ].forEach(([field, labelKey]) => {
        if (!this[field]) {
          errors.push(this.t('validation.required', { key: this.t(labelKey) }, true));
        }
      });

      if (!isWholeNumber(this.replicas, 0, MAX_REPLICAS)) {
        errors.push(this.t('harvester.egressGateway.validation.replicas', null, true));
      }

      if (!this.policies.length && !hasSelectors(this.value.spec)) {
        errors.push(this.t('harvester.egressGateway.validation.policyRequired', null, true));
      } else if (this.policies.some((policy) => !policy.subnets.length && !policy.ipBlocks?.length)) {
        errors.push(this.t('harvester.egressGateway.validation.policySubnets', null, true));
      }

      [
        ['internalIPs', 'harvester.egressGateway.ips.internal.label'],
        ['externalIPs', 'harvester.egressGateway.ips.external.label'],
      ].forEach(([field, labelKey]) => {
        const ips = cleanList(this[field]);
        const key = this.t(labelKey);

        if (ips.some((ip) => !isValidIP(ip))) {
          errors.push(this.t('harvester.egressGateway.validation.ipList', { key }, true));
        } else if (ips.length && ips.length < replicas) {
          errors.push(this.t('harvester.egressGateway.validation.ipCount', { key, replicas }, true));
        }
      });

      if (this.bfd.enabled && ['minRX', 'minTX', 'multiplier'].some((field) => !isWholeNumber(this.bfd[field], 1, MAX_BFD_VALUE))) {
        errors.push(this.t('harvester.egressGateway.validation.bfd', null, true));
      }

      if ([this.bandwidthIngress, this.bandwidthEgress].some((value) => !isBlank(value) && !isValidBandwidth(value))) {
        errors.push(this.t('harvester.egressGateway.validation.bandwidth', null, true));
      }

      return errors;
    },

    toSpec() {
      const spec = {
        ...(this.value.spec || {}),
        vpc:            this.vpc,
        replicas:       Number(this.replicas),
        internalSubnet: this.internalSubnet,
        externalSubnet: this.externalSubnet,
        internalIPs:    cleanList(this.internalIPs),
        externalIPs:    cleanList(this.externalIPs),
        policies:       this.policies.map((policy) => ({ ...policy })),
        bfd:            {
          ...this.bfd,
          minRX:      Number(this.bfd.minRX),
          minTX:      Number(this.bfd.minTX),
          multiplier: Number(this.bfd.multiplier),
        },
        bandwidth: {
          ingress: isBlank(this.bandwidthIngress) ? undefined : toBandwidth(this.bandwidthIngress),
          egress:  isBlank(this.bandwidthEgress) ? undefined : toBandwidth(this.bandwidthEgress),
        },
      };

      ['internalIPs', 'externalIPs', 'policies'].forEach((field) => {
        if (!spec[field].length) {
          delete spec[field];
        }
      });

      Object.keys(spec.bandwidth).forEach((direction) => {
        if (spec.bandwidth[direction] === undefined) {
          delete spec.bandwidth[direction];
        }
      });

      if (!Object.keys(spec.bandwidth).length) {
        delete spec.bandwidth;
      }

      return spec;
    },

    async saveGateway(buttonCb) {
      this.errors = this.validate();

      if (this.errors.length) {
        buttonCb(false);

        return;
      }

      this.value.spec = this.toSpec();
      await this.save(buttonCb);
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="saveGateway"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      @update:value="$emit('update:value', $event)"
    />

    <ResourceTabs
      class="mt-15"
      :need-conditions="false"
      :need-related="false"
      :need-events="false"
      :side-tabs="true"
      :mode="mode"
    >
      <Tab
        name="basic"
        :label="t('generic.basic')"
        :weight="99"
      >
        <div class="row mt-10">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="vpc"
              data-testid="egress-gateway-vpc"
              class="mb-20"
              required
              :options="vpcOptions"
              :mode="mode"
              :label="t('harvester.egressGateway.vpc.label')"
              :placeholder="t('harvester.egressGateway.vpc.placeholder')"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value.number="replicas"
              data-testid="egress-gateway-replicas"
              class="mb-20"
              type="number"
              required
              :min="0"
              :max="10"
              :mode="mode"
              :label="t('harvester.egressGateway.replicas.label')"
              :tooltip="t('harvester.egressGateway.replicas.tooltip')"
            />
          </div>
        </div>
        <div class="row">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="internalSubnet"
              data-testid="egress-gateway-internal-subnet"
              class="mb-20"
              required
              :options="vpcSubnetOptions"
              :mode="mode"
              :label="t('harvester.egressGateway.internalSubnet.label')"
              :placeholder="t('harvester.egressGateway.internalSubnet.placeholder')"
              :tooltip="t('harvester.egressGateway.internalSubnet.tooltip')"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="externalSubnet"
              data-testid="egress-gateway-external-subnet"
              class="mb-20"
              required
              :options="externalSubnetOptions"
              :mode="mode"
              :label="t('harvester.egressGateway.externalSubnet.label')"
              :placeholder="t('harvester.egressGateway.externalSubnet.placeholder')"
              :tooltip="t('harvester.egressGateway.externalSubnet.tooltip')"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="policies"
        :label="t('harvester.egressGateway.policies.label')"
        :weight="98"
      >
        <Banner
          v-if="hasSelectors"
          color="info"
          :label="t('harvester.egressGateway.policies.selectors')"
        />
        <div
          v-for="(policy, index) in policies"
          :key="index"
        >
          <InfoBox class="policy">
            <button
              v-if="!isView"
              type="button"
              class="role-link btn btn-sm remove-policy"
              :aria-label="t('generic.remove')"
              @click="removePolicy(index)"
            >
              <i class="icon icon-x" />
            </button>
            <div class="row">
              <div class="col span-11">
                <Checkbox
                  v-model:value="policy.snat"
                  class="mb-15"
                  :mode="mode"
                  :label="t('harvester.egressGateway.policies.snat')"
                />
                <LabeledSelect
                  v-model:value="policy.subnets"
                  :data-testid="`egress-gateway-policy-subnets-${ index }`"
                  required
                  :multiple="true"
                  :options="vpcSubnetOptions"
                  :mode="mode"
                  :label="t('harvester.egressGateway.policies.subnets.label')"
                  :placeholder="t('harvester.egressGateway.policies.subnets.placeholder')"
                  :tooltip="t('harvester.egressGateway.policies.subnets.tooltip')"
                />
              </div>
            </div>
          </InfoBox>
        </div>
        <button
          v-if="!isView"
          type="button"
          class="btn role-tertiary"
          data-testid="egress-gateway-add-policy"
          @click="addPolicy"
        >
          {{ t('harvester.egressGateway.policies.addLabel') }}
        </button>
      </Tab>

      <Tab
        name="ips"
        :label="t('harvester.egressGateway.ips.label')"
        :weight="97"
      >
        <Banner
          color="info"
          :label="t('harvester.egressGateway.ips.banner')"
        />
        <ArrayList
          v-model:value="internalIPs"
          class="mt-20"
          :mode="mode"
          :title="t('harvester.egressGateway.ips.internal.label')"
          :add-label="t('harvester.egressGateway.ips.internal.add')"
          :value-placeholder="t('harvester.egressGateway.ips.internal.placeholder')"
        />
        <ArrayList
          v-model:value="externalIPs"
          class="mt-20"
          :mode="mode"
          :title="t('harvester.egressGateway.ips.external.label')"
          :add-label="t('harvester.egressGateway.ips.external.add')"
          :value-placeholder="t('harvester.egressGateway.ips.external.placeholder')"
        />
      </Tab>

      <Tab
        name="bfd"
        :label="t('harvester.egressGateway.bfd.label')"
        :weight="96"
      >
        <RadioGroup
          v-model:value="bfd.enabled"
          name="bfd"
          :options="[true, false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
          :label="t('harvester.egressGateway.bfd.enabled')"
          :tooltip="t('harvester.egressGateway.bfd.tooltip')"
          :mode="mode"
        />
        <template v-if="bfd.enabled">
          <Banner
            v-if="vpcBfdPortDisabled"
            color="warning"
          >
            <MessageLink
              :to="vpcEditLocation"
              :prefix="t('harvester.egressGateway.bfd.vpcBfdPort.prefix', { vpc }, true)"
              :middle="t('harvester.egressGateway.bfd.vpcBfdPort.middle')"
              :suffix="t('harvester.egressGateway.bfd.vpcBfdPort.suffix')"
            />
          </Banner>
          <div class="row mt-20">
            <div class="col span-4">
              <UnitInput
                v-model:value="bfd.minRX"
                :min="1"
                :mode="mode"
                :label="t('harvester.egressGateway.bfd.minRX.label')"
                :suffix="t('harvester.egressGateway.bfd.milliseconds')"
              />
            </div>
            <div class="col span-4">
              <UnitInput
                v-model:value="bfd.minTX"
                :min="1"
                :mode="mode"
                :label="t('harvester.egressGateway.bfd.minTX.label')"
                :suffix="t('harvester.egressGateway.bfd.milliseconds')"
              />
            </div>
            <div class="col span-4">
              <LabeledInput
                v-model:value.number="bfd.multiplier"
                type="number"
                :min="1"
                :mode="mode"
                :label="t('harvester.egressGateway.bfd.multiplier.label')"
                :tooltip="t('harvester.egressGateway.bfd.multiplier.tooltip')"
              />
            </div>
          </div>
        </template>
      </Tab>

      <Tab
        name="bandwidth"
        :label="t('harvester.egressGateway.bandwidth.label')"
        :weight="95"
      >
        <Banner
          color="info"
          :label="t('harvester.egressGateway.bandwidth.banner')"
        />
        <div class="row mt-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="bandwidthIngress"
              data-testid="egress-gateway-bandwidth-ingress"
              :mode="mode"
              :label="t('harvester.egressGateway.bandwidth.ingress.label')"
              :placeholder="t('harvester.egressGateway.bandwidth.placeholder')"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="bandwidthEgress"
              data-testid="egress-gateway-bandwidth-egress"
              :mode="mode"
              :label="t('harvester.egressGateway.bandwidth.egress.label')"
              :placeholder="t('harvester.egressGateway.bandwidth.placeholder')"
            />
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
  .policy {
    position: relative;
  }

  .remove-policy {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 0;
  }
</style>
