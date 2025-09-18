<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import Tab from '@shell/components/Tabbed/Tab';
import { NETWORK_ATTACHMENT } from '@shell/config/types';
import Loading from '@shell/components/Loading';
import CreateEditView from '@shell/mixins/create-edit-view';
import { RadioGroup } from '@components/Form/Radio';
import { NETWORK_PROTOCOL, NETWORK_TYPE } from '@pkg/harvester/config/types';
import { set } from '@shell/utils/object';
import ArrayList from '@shell/components/form/ArrayList';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../../types';
import ResourceTabs from '@shell/components/form/ResourceTabs/index';
import { Banner } from '@components/Banner';
import AccessControlList from './AccessControlList';

export default {
  name: 'EditSubnet',

  emits: ['update:value'],

  components: {
    Banner,
    CruResource,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    Tab,
    RadioGroup,
    ArrayList,
    ResourceTabs,
    Loading,
    AccessControlList
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  created() {
    const vpc = this.$route.query.vpc || '';
    const enableDHCP = this.value?.spec?.enableDHCP || false;

    set(this.value.spec, 'enableDHCP', enableDHCP);
    set(this.value, 'spec', this.value.spec || {
      cidrBlock:  '',
      protocol:   NETWORK_PROTOCOL.IPv4,
      provider:   '',
      vpc,
      gatewayIP:  '',
      excludeIps: [],
      private:    false,
      enableDHCP,
      acls:       []
    });
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = {
      vpc: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VPC }),
      nad: this.$store.dispatch(`${ inStore }/findAll`, { type: NETWORK_ATTACHMENT }),
    };

    await allHash(hash);
  },

  computed: {
    showAllowSubnets() {
      return this.value?.spec?.private === true;
    },

    doneLocationOverride() {
      return this.value.doneOverride;
    },

    allowSubnetTooltip() {
      return this.t('harvester.subnet.allowSubnet.tooltip', null, true);
    },

    excludeIPsTooltip() {
      return this.t('harvester.subnet.excludeIPs.tooltip', null, true);
    },

    protocolOptions() {
      return Object.values(NETWORK_PROTOCOL);
    },
    provider: {
      get() {
        const raw = this.value.spec.provider;

        if (!raw) {
          return '';
        }
        const vmNet = raw.split('.')[0] || '';
        const ns = raw.split('.')[1] || '';

        return `${ ns }/${ vmNet }`;
      },

      set(value) {
        const ns = value.split('/')[0] || '';
        const vmNet = value.split('/')[1] || '';
        const provider = `${ vmNet }.${ ns }.ovn`;

        set(this.value, 'spec.provider', provider);
      }
    },

    providerOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vmNets = this.$store.getters[`${ inStore }/all`](NETWORK_ATTACHMENT) || [];

      return vmNets.filter((net) => net.vlanType === NETWORK_TYPE.OVERLAY).map((n) => ({
        label: n.id,
        value: n.id,
      }));
    },

    vpcOptions() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const vpcs = this.$store.getters[`${ inStore }/all`](HCI.VPC) || [];

      return vpcs.map((n) => ({
        label: n.id,
        value: n.id,
      }));
    }
  },

  watch: {
    'value.spec.enableDHCP': {
      handler(newValue) {
        if (newValue === false) {
          this.value.spec.dhcpV4Options = '';
          this.value.spec.dhcpV6Options = '';
        }
      },
    }
  },
  methods: {
    async saveSubnet(buttonCb) {
      const errors = [];
      const name = this.value?.metadata?.name;
      const hasEmptyAcls = this.value?.spec?.acls?.some((acl) => !acl.match || !acl.action || acl.priority === undefined || acl.priority === null);

      try {
        if (!name) {
          errors.push(this.t('validation.required', { key: this.t('generic.name') }, true));
        } else if (!this.value?.spec?.cidrBlock) {
          errors.push(this.t('validation.required', { key: this.t('harvester.subnet.cidrBlock.label') }, true));
        } else if (!this.value?.spec?.provider) {
          errors.push(this.t('validation.required', { key: this.t('harvester.subnet.provider.label') }, true));
        } else if (this.value.spec.excludeIps.includes('')) {
          errors.push(this.t('harvester.validation.subnet.excludeIps'));
        } else if (hasEmptyAcls) {
          errors.push(this.t('harvester.validation.subnet.aclEmptyError'));
        }

        if (errors.length > 0) {
          buttonCb(false);
          this.errors = errors;

          return false;
        }
        await this.value.save();
        buttonCb(true);
        this.done();
      } catch (e) {
        this.errors = [e];
        buttonCb(false);
      }
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
    :apply-hooks="applyHooks"
    :errors="errors"
    @finish="saveSubnet"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />
    <ResourceTabs
      class="mt-15"
      :need-events="false"
      :need-related="false"
      :mode="mode"
      :side-tabs="true"
    >
      <Tab
        name="Basic"
        :label="t('generic.basic')"
        :weight="-1"
        class="bordered-table"
      >
        <div class="row mt-10">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.cidrBlock"
              class="mb-20"
              required
              :placeholder="t('harvester.subnet.cidrBlock.placeholder')"
              :label="t('harvester.subnet.cidrBlock.label')"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.protocol"
              :label="t('harvester.subnet.protocol.label')"
              :options="protocolOptions"
              required
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-10">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="provider"
              :label="t('harvester.subnet.provider.label')"
              :options="providerOptions"
              :tooltip="t('harvester.subnet.provider.tooltip')"
              required
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.vpc"
              :label="t('harvester.subnet.vpc.label')"
              :options="vpcOptions"
              required
              :disabled="true"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.gateway"
              class="mb-20"
              :placeholder="t('harvester.subnet.gateway.placeholder')"
              :label="t('harvester.subnet.gateway.label')"
              :mode="mode"
            />
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <RadioGroup
              v-model:value="value.spec.enableDHCP"
              name="enabled"
              :options="[true, false]"
              :label="t('harvester.subnet.dhcp.label')"
              :labels="[t('generic.enabled'), t('generic.disabled')]"
              :mode="mode"
              :tooltip="t('harvester.subnet.dhcp.tooltip')"
            />
            <LabeledInput
              v-if="value.spec.enableDHCP && value.spec.protocol === 'IPv4'"
              v-model:value="value.spec.dhcpV4Options"
              class="mb-20 mt-20"
              :placeholder="t('harvester.subnet.dhcp.placeholder')"
              :label="t('harvester.subnet.dhcp.v4Options')"
              :mode="mode"
            />
            <LabeledInput
              v-if="value.spec.enableDHCP && value.spec.protocol === 'IPv6'"
              v-model:value="value.spec.dhcpV6Options"
              :placeholder="t('harvester.subnet.dhcp.placeholder')"
              class="mb-20 mt-20"
              :label="t('harvester.subnet.dhcp.v6Options')"
              :mode="mode"
            />
            <Banner
              v-if="value.spec.enableDHCP"
              color="info"
              class="dhcpOption-banner"
            >
              <t
                k="harvester.subnet.dhcp.dhcpOptionBanner"
                :raw="true"
              />
            </Banner>
          </div>
        </div>
        <div class="row mt-20">
          <div class="col span-6">
            <RadioGroup
              v-model:value="value.spec.private"
              name="enabled"
              :options="[true, false]"
              :label="t('harvester.subnet.private.label')"
              :labels="[t('generic.enabled'), t('generic.disabled')]"
              :mode="mode"
              tooltip-key="harvester.subnet.private.tooltip"
            />
          </div>
        </div>
        <ArrayList
          v-if="showAllowSubnets"
          v-model:value="value.spec.allowSubnets"
          :show-header="true"
          class="mt-20"
          :mode="mode"
          :add-label="t('harvester.subnet.allowSubnet.addSubnet')"
        >
          <template #column-headers>
            <div class="box">
              <h3 class="key">
                {{ t('harvester.subnet.allowSubnet.label') }}
                <i
                  v-clean-tooltip="{content: allowSubnetTooltip, triggers: ['hover', 'touch', 'focus'] }"
                  v-stripped-aria-label="allowSubnetTooltip"
                  class="icon icon-info"
                  tabindex="0"
                />
              </h3>
            </div>
          </template>
          <template #columns="scope">
            <div class="key">
              <input
                v-model="scope.row.value"
                :placeholder="t('harvester.subnet.allowSubnet.placeholder')"
              />
            </div>
          </template>
        </ArrayList>
        <ArrayList
          v-model:value="value.spec.excludeIps"
          :show-header="true"
          class="mt-20"
          :mode="mode"
          :add-label="t('harvester.setting.storageNetwork.exclude.addIp')"
        >
          <template #column-headers>
            <div class="box">
              <h3 class="key">
                {{ t('harvester.setting.storageNetwork.exclude.label') }}
                <i
                  v-clean-tooltip="{content: excludeIPsTooltip, triggers: ['hover', 'touch', 'focus'] }"
                  v-stripped-aria-label="excludeIPsTooltip"
                  class="icon icon-info"
                  tabindex="0"
                />
              </h3>
            </div>
          </template>
          <template #columns="scope">
            <div class="key">
              <input
                v-model="scope.row.value"
                :placeholder="t('harvester.setting.storageNetwork.exclude.placeholder')"
              />
            </div>
          </template>
        </ArrayList>
      </Tab>
      <Tab
        name="ACL"
        :label="t('harvester.subnet.acl.label')"
        :weight="-2"
        class="bordered-table"
      >
        <AccessControlList
          v-model:value="value.spec.acls"
          :mode="mode"
        />
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
  .dhcpOption-banner {
    width: max-content;
  }
</style>
