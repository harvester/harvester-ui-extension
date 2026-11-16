<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import Tab from '@shell/components/Tabbed/Tab';
import Loading from '@shell/components/Loading';
import CreateEditView from '@shell/mixins/create-edit-view';
import ResourceTabs from '@shell/components/form/ResourceTabs/index';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import { Banner } from '@components/Banner';
import StaticRoutes from './StaticRoutes';
import VpcPeerings from './VpcPeerings';
import { set } from '@shell/utils/object';
import { isValidIP } from '@shell/utils/validators/cidr';

const splitIPs = (value) => `${ value || '' }`.split(',').map((ip) => ip.trim()).filter(Boolean);

export default {
  name: 'EditVPC',

  emits: ['update:value'],

  components: {
    Banner,
    CruResource,
    LabeledInput,
    NameNsDescription,
    RadioGroup,
    Tab,
    StaticRoutes,
    ResourceTabs,
    Loading,
    VpcPeerings
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  data() {
    set(this.value, 'spec', this.value.spec || {
      staticRoutes: [],
      vpcPeerings:  [],
    });

    const bfdPort = this.value.spec.bfdPort || {};

    return {
      staticRoutes:   [],
      bfdPortEnabled: bfdPort.enabled === true,
      bfdPortIP:      bfdPort.ip || '',
    };
  },

  methods: {
    validateBfdPort() {
      if (!this.bfdPortEnabled) {
        return [];
      }

      const ips = splitIPs(this.bfdPortIP);
      const ipv6Count = ips.filter((ip) => ip.includes(':')).length;

      if (!ips.length) {
        return [this.t('validation.required', { key: this.t('harvester.vpc.bfdPort.ip.label') }, true)];
      }

      if (ips.length > 2 || ips.some((ip) => !isValidIP(ip)) || (ips.length === 2 && ipv6Count !== 1)) {
        return [this.t('harvester.vpc.bfdPort.validation.ip', null, true)];
      }

      return [];
    },

    applyBfdPort() {
      const current = this.value.spec.bfdPort;

      if (!this.bfdPortEnabled && !current) {
        return;
      }

      const bfdPort = {
        ...(current || {}),
        enabled: this.bfdPortEnabled,
        ip:      splitIPs(this.bfdPortIP).join(','),
      };

      if (!bfdPort.ip) {
        delete bfdPort.ip;
      }

      this.value.spec.bfdPort = bfdPort;
    },

    async saveVpc(buttonCb) {
      const errors = [];

      try {
        const name = this.value?.metadata?.name;

        if (!name) {
          errors.push(this.t('validation.required', { key: this.t('generic.name') }, true));
        }

        errors.push(...this.validateBfdPort());

        if (errors.length > 0) {
          buttonCb(false);
          this.errors = errors;

          return false;
        }
        this.applyBfdPort();
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
    @finish="saveVpc"
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
      :mode="mode"
      :side-tabs="true"
    >
      <Tab
        name="staticRoutes"
        :label="t('harvester.vpc.staticRoutes.label')"
        :weight="-1"
        class="bordered-table"
      >
        <StaticRoutes
          v-model:value="value.spec.staticRoutes"
          class="col span-12"
          :mode="mode"
        />
      </Tab>
      <Tab
        name="vpcPeerings"
        :label="t('harvester.vpc.vpcPeerings.label')"
        :weight="-2"
        class="bordered-table"
      >
        <VpcPeerings
          v-model:value="value.spec.vpcPeerings"
          class="col span-12"
          :mode="mode"
          :vpc="value"
        />
      </Tab>
      <Tab
        name="bfdPort"
        :label="t('harvester.vpc.bfdPort.label')"
        :weight="-3"
      >
        <Banner
          color="info"
          :label="t('harvester.vpc.bfdPort.banner')"
        />
        <RadioGroup
          v-model:value="bfdPortEnabled"
          name="bfdPort"
          data-testid="vpc-bfd-port-enabled"
          :options="[true, false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
          :aria-label="t('harvester.vpc.bfdPort.label')"
          :mode="mode"
        />
        <div
          v-if="bfdPortEnabled"
          class="row mt-20"
        >
          <div class="col span-6">
            <LabeledInput
              v-model:value="bfdPortIP"
              data-testid="vpc-bfd-port-ip"
              required
              :mode="mode"
              :label="t('harvester.vpc.bfdPort.ip.label')"
              :placeholder="t('harvester.vpc.bfdPort.ip.placeholder')"
              :tooltip="t('harvester.vpc.bfdPort.ip.tooltip')"
            />
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
