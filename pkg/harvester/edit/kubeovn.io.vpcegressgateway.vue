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
import { _EDIT, MODE } from '@shell/config/query-params';
import { allHash } from '@shell/utils/promise';
import { isValidIP } from '@shell/utils/validators/cidr';
import { HCI } from '../types';

// Limits from the VpcEgressGateway CRD
const MAX_REPLICAS = 10;
const MAX_BFD_VALUE = 3600000;
const MAX_BANDWIDTH_MBPS = 9223372036854;
// A whole number in Mbps, or a quantity in bits per second such as 100M or 1Gi
const BANDWIDTH_PATTERN = /^([0-9]+|([0-9]+(\.[0-9]+)?|\.[0-9]+)(M|Mi|G|Gi))$/;
const IP_FIELDS = {
  internalIPs: { labelKey: 'harvester.egressGateway.ips.internal.label', subnet: 'internalSubnetResource' },
  externalIPs: { labelKey: 'harvester.egressGateway.ips.external.label', subnet: 'externalSubnetResource' },
};
const BFD_DEFAULTS = {
  enabled: false, minRX: 1000, minTX: 1000, multiplier: 3
};

const isBlank = (value) => value === null || value === undefined || `${ value }`.trim() === '';
const isWholeNumber = (value, min, max) => /^\d+$/.test(`${ value }`.trim()) && Number(value) >= min && Number(value) <= max;
const isValidBandwidth = (value) => BANDWIDTH_PATTERN.test(`${ value }`.trim()) && (!isWholeNumber(value, 0, Infinity) || Number(value) <= MAX_BANDWIDTH_MBPS);
const toBandwidth = (value) => (isWholeNumber(value, 0, Infinity) ? Number(value) : `${ value }`.trim());
const cleanList = (list) => (list || []).map((item) => `${ item || '' }`.trim()).filter(Boolean);
const isValidBfdValue = (value) => isWholeNumber(value, 1, MAX_BFD_VALUE);

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
    const policies = (spec.policies || [{ snat: true, subnets: [] }]).map((policy) => ({
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
    allSubnets() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](HCI.SUBNET) || [];
    },

    vpcOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];

      return vpcs.map((vpc) => ({ label: vpc.id, value: vpc.id }));
    },

    vpcSubnets() {
      return this.allSubnets.filter((subnet) => subnet.spec?.vpc === this.vpc);
    },

    vpcSubnetOptions() {
      return this.vpcSubnets.map((subnet) => ({ label: subnet.id, value: subnet.id }));
    },

    internalSubnetOptions() {
      return this.vpcSubnets
        .filter((subnet) => subnet.isOverlayAttachment)
        .map((subnet) => ({ label: subnet.id, value: subnet.id }));
    },

    externalSubnetOptions() {
      return this.allSubnets
        .filter((subnet) => subnet.networkAttachment)
        .map((subnet) => ({ label: subnet.id, value: subnet.id }));
    },

    internalSubnetResource() {
      return this.allSubnets.find((subnet) => subnet.id === this.internalSubnet);
    },

    externalSubnetResource() {
      return this.allSubnets.find((subnet) => subnet.id === this.externalSubnet);
    },

    selectedVpc() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.vpc ? this.$store.getters[`${ inStore }/byId`](HCI.VPC, this.vpc) : null;
    },

    tabErrors() {
      return this.isView ? {
        basic: [], policies: [], ips: [], bfd: [], bandwidth: []
      } : this.validateTabs();
    },

    validationPassed() {
      return this.validate().length === 0;
    },

    replicasRules() {
      return [(value) => (isWholeNumber(value, 0, MAX_REPLICAS) ? undefined : this.t('harvester.egressGateway.validation.replicas', null, true))];
    },

    externalSubnetRules() {
      return [(value) => (value && value === this.internalSubnet ? this.t('harvester.egressGateway.validation.sameSubnet', null, true) : undefined)];
    },

    internalIPRules() {
      return [(ip) => this.ipError('internalIPs', ip)];
    },

    externalIPRules() {
      return [(ip) => this.ipError('externalIPs', ip)];
    },

    ipCountErrors() {
      return Object.keys(IP_FIELDS).map((field) => this.ipCountError(field)).filter(Boolean);
    },

    bfdRules() {
      return [(value) => (isValidBfdValue(value) ? undefined : this.t('harvester.egressGateway.validation.bfd', null, true))];
    },

    bandwidthRules() {
      return [(value) => (isBlank(value) || isValidBandwidth(value) ? undefined : this.t('harvester.egressGateway.validation.bandwidth', null, true))];
    },

    vpcBfdPortDisabled() {
      return !!this.selectedVpc && !this.selectedVpc.bfdPortEnabled;
    },

    vpcEditLocation() {
      const location = this.selectedVpc?.detailLocation;

      return location ? {
        ...location, query: { [MODE]: _EDIT }, hash: '#bfdPort'
      } : null;
    },
  },

  watch: {
    vpc(neu, old) {
      if (!old || neu === old) {
        return;
      }

      const vpcSubnets = this.vpcSubnetOptions.map((option) => option.value);

      if (!this.internalSubnetOptions.some((option) => option.value === this.internalSubnet)) {
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

    ipError(field, ip) {
      const value = `${ ip || '' }`.trim();
      const { labelKey, subnet: subnetField } = IP_FIELDS[field];
      const key = this.t(labelKey);
      const subnet = this[subnetField];

      if (!value) {
        return undefined;
      }

      if (!isValidIP(value)) {
        return this.t('harvester.egressGateway.validation.ipList', { key }, true);
      }

      if (cleanList(this[field]).filter((other) => other === value).length > 1) {
        return this.t('harvester.egressGateway.validation.ipDuplicate', { key }, true);
      }

      if (subnet && !subnet.canAssignIP(value)) {
        return this.t('harvester.egressGateway.validation.ipSubnet', {
          key, subnet: subnet.id, cidr: subnet.spec?.cidrBlock
        }, true);
      }

      return undefined;
    },

    ipCountError(field) {
      const ips = cleanList(this[field]);
      const replicas = Number(this.replicas);

      if (ips.length && ips.length < replicas) {
        return this.t('harvester.egressGateway.validation.ipCount', { key: this.t(IP_FIELDS[field].labelKey), replicas }, true);
      }

      return undefined;
    },

    policySubnetsError(policy) {
      return policy.subnets.length || policy.ipBlocks?.length ? undefined : this.t('harvester.egressGateway.validation.policySubnets', null, true);
    },

    // The errors of each tab, so each tab can be marked and Save stays disabled until there are none
    validateTabs() {
      const errors = {
        basic: [], policies: [], ips: [], bfd: [], bandwidth: []
      };

      [
        ['vpc', 'harvester.egressGateway.vpc.label'],
        ['internalSubnet', 'harvester.egressGateway.internalSubnet.label'],
        ['externalSubnet', 'harvester.egressGateway.externalSubnet.label'],
      ].forEach(([field, labelKey]) => {
        if (!this[field]) {
          errors.basic.push(this.t('validation.required', { key: this.t(labelKey) }, true));
        }
      });

      if (this.internalSubnet && this.internalSubnet === this.externalSubnet) {
        errors.basic.push(this.t('harvester.egressGateway.validation.sameSubnet', null, true));
      }

      if (!isWholeNumber(this.replicas, 0, MAX_REPLICAS)) {
        errors.basic.push(this.t('harvester.egressGateway.validation.replicas', null, true));
      }

      if (!this.policies.length) {
        errors.policies.push(this.t('harvester.egressGateway.validation.policyRequired', null, true));
      } else if (this.policies.some((policy) => this.policySubnetsError(policy))) {
        errors.policies.push(this.t('harvester.egressGateway.validation.policySubnets', null, true));
      }

      Object.keys(IP_FIELDS).forEach((field) => {
        const ipError = cleanList(this[field]).map((ip) => this.ipError(field, ip)).find(Boolean);
        const error = ipError || this.ipCountError(field);

        if (error) {
          errors.ips.push(error);
        }
      });

      if (this.bfd.enabled && ['minRX', 'minTX', 'multiplier'].some((field) => !isValidBfdValue(this.bfd[field]))) {
        errors.bfd.push(this.t('harvester.egressGateway.validation.bfd', null, true));
      }

      if ([this.bandwidthIngress, this.bandwidthEgress].some((value) => !isBlank(value) && !isValidBandwidth(value))) {
        errors.bandwidth.push(this.t('harvester.egressGateway.validation.bandwidth', null, true));
      }

      return errors;
    },

    validate() {
      const errors = this.value.metadata?.name ? [] : [this.t('validation.required', { key: this.t('generic.name') }, true)];

      return [...errors, ...Object.values(this.validateTabs()).flat()];
    },

    // The intervals are hidden while BFD is off, so a value cleared there falls back to its default
    bfdSpec() {
      const bfd = { ...this.bfd };

      ['minRX', 'minTX', 'multiplier'].forEach((field) => {
        bfd[field] = isValidBfdValue(bfd[field]) || this.bfd.enabled ? Number(bfd[field]) : BFD_DEFAULTS[field];
      });

      return bfd;
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
        bfd:            this.bfdSpec(),
        bandwidth:      {
          ingress: isBlank(this.bandwidthIngress) ? undefined : toBandwidth(this.bandwidthIngress),
          egress:  isBlank(this.bandwidthEgress) ? undefined : toBandwidth(this.bandwidthEgress),
        },
      };

      ['internalIPs', 'externalIPs'].forEach((field) => {
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
    :validation-passed="validationPassed"
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
        :error="tabErrors.basic.length > 0"
        :error-icon-tooltip="tabErrors.basic.join(' ')"
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
              :rules="replicasRules"
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
              :options="internalSubnetOptions"
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
              :rules="externalSubnetRules"
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
        :error="tabErrors.policies.length > 0"
        :error-icon-tooltip="tabErrors.policies.join(' ')"
      >
        <Banner
          v-if="!isView && !policies.length"
          color="error"
          :label="t('harvester.egressGateway.validation.policyRequired')"
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
                  :required="!policy.ipBlocks?.length"
                  :rules="[() => policySubnetsError(policy)]"
                  :multiple="true"
                  :options="vpcSubnetOptions"
                  :mode="mode"
                  :label="t('harvester.egressGateway.policies.subnets.label')"
                  :placeholder="t('harvester.egressGateway.policies.subnets.placeholder')"
                  :tooltip="t('harvester.egressGateway.policies.subnets.tooltip')"
                />
                <LabeledInput
                  v-if="policy.ipBlocks?.length"
                  class="mt-15"
                  :data-testid="`egress-gateway-policy-ip-blocks-${ index }`"
                  :value="policy.ipBlocks.join(', ')"
                  mode="view"
                  :label="t('harvester.egressGateway.policies.ipBlocks.label')"
                  :tooltip="t('harvester.egressGateway.policies.ipBlocks.tooltip')"
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
        :error="tabErrors.ips.length > 0"
        :error-icon-tooltip="tabErrors.ips.join(' ')"
      >
        <Banner
          color="info"
          :label="t('harvester.egressGateway.ips.banner')"
        />
        <Banner
          v-for="error in ipCountErrors"
          :key="error"
          color="error"
          :label="error"
        />
        <ArrayList
          v-model:value="internalIPs"
          class="mt-20"
          :rules="internalIPRules"
          :mode="mode"
          :title="t('harvester.egressGateway.ips.internal.label')"
          :add-label="t('harvester.egressGateway.ips.internal.add')"
          :value-placeholder="t('harvester.egressGateway.ips.internal.placeholder')"
        />
        <ArrayList
          v-model:value="externalIPs"
          class="mt-20"
          :rules="externalIPRules"
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
        :error="tabErrors.bfd.length > 0"
        :error-icon-tooltip="tabErrors.bfd.join(' ')"
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
              target="_blank"
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
                :rules="bfdRules"
                :label="t('harvester.egressGateway.bfd.minRX.label')"
                :suffix="t('harvester.egressGateway.bfd.milliseconds')"
              />
            </div>
            <div class="col span-4">
              <UnitInput
                v-model:value="bfd.minTX"
                :min="1"
                :mode="mode"
                :rules="bfdRules"
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
                :rules="bfdRules"
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
        :error="tabErrors.bandwidth.length > 0"
        :error-icon-tooltip="tabErrors.bandwidth.join(' ')"
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
              :rules="bandwidthRules"
              :label="t('harvester.egressGateway.bandwidth.ingress.label')"
              :placeholder="t('harvester.egressGateway.bandwidth.placeholder')"
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="bandwidthEgress"
              data-testid="egress-gateway-bandwidth-egress"
              :mode="mode"
              :rules="bandwidthRules"
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
