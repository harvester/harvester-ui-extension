<script>
import { mapGetters } from 'vuex';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { Checkbox } from '@components/Form/Checkbox';
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Banner } from '@components/Banner';
import KeyValue from '@shell/components/form/KeyValue';
import NodeScheduling from '@shell/components/form/NodeScheduling';
import PodAffinity from '@shell/components/form/PodAffinity';
import UnitInput from '@shell/components/form/UnitInput';
import { randomStr } from '@shell/utils/string';
import { _CONFIG, _EDIT, _VIEW } from '@shell/config/query-params';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import CreateEditView from '@shell/mixins/create-edit-view';
import { AFTER_SAVE_HOOKS } from '@shell/mixins/child-hook';
import { HCI } from '../types';
import VM_MIXIN from '../mixins/harvester-vm';
import Reserved from './kubevirt.io.virtualmachine/VirtualMachineReserved';
import Volume from './kubevirt.io.virtualmachine/VirtualMachineVolume';
import Network from './kubevirt.io.virtualmachine/VirtualMachineNetwork';
import CpuMemory from './kubevirt.io.virtualmachine/VirtualMachineCpuMemory';
import CloudConfig from './kubevirt.io.virtualmachine/VirtualMachineCloudConfig';
import SSHKey from './kubevirt.io.virtualmachine/VirtualMachineSSHKey';

export default {
  name: 'HarvesterEditVMTemplate',

  emits: ['update:templateValue'],

  components: {
    Tab,
    SSHKey,
    Volume,
    Tabbed,
    Network,
    Checkbox,
    CpuMemory,
    CruResource,
    CloudConfig,
    LabeledSelect,
    NameNsDescription,
    NodeScheduling,
    PodAffinity,
    Reserved,
    UnitInput,
    Banner,
    KeyValue,
  },

  mixins: [CreateEditView, VM_MIXIN],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  data() {
    if (this.mode === _EDIT) {
      this.value.cleanForNew();
    }

    const templateId = this.value.templateId || this.$route.query.templateId;

    return {
      templateId,
      templateValue:    null,
      templateSpec:     null,
      versionName:      '',
      description:      '',
      defaultVersion:   null,
      isDefaultVersion: false,
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),
    isConfig() {
      return this.$route.query?.as === _CONFIG || this.isView;
    },

    realTemplateMode() {
      return this.templateId ? _VIEW : this.mode;
    },

    secretNamePrefix() {
      return this.templateValue?.metadata?.name;
    },
  },

  watch: {
    templateId: {
      async handler(neu) {
        const templates = await this.$store.dispatch('harvester/findAll', { type: HCI.VM_TEMPLATE });
        let templateValue = templates.find( (V) => V.id === neu) || null;
        let templateSpec = templateValue?.spec;

        if (!templateValue) {
          templateSpec = {
            description:      '',
            defaultVersionId: ''
          };

          templateValue = await this.$store.dispatch('harvester/create', {
            metadata: {
              name:      '',
              namespace: ''
            },
            spec: templateSpec,
            type: HCI.VM_TEMPLATE
          });
        }

        this.templateValue = templateValue;
        this.templateSpec = templateSpec;
      },
      immediate: true
    }
  },

  created() {
    this.registerAfterHook(async() => {
      if (this.isDefaultVersion) {
        // Set the default version according to annotation:[HCI_ANNOTATIONS.TEMPLATE_VERSION_CUSTOM_NAME]
        const versions = await this.$store.dispatch('harvester/findAll', { type: HCI.VM_VERSION, opt: { force: true } });

        const version = versions.find( (V) => V?.metadata?.annotations?.[HCI_ANNOTATIONS.TEMPLATE_VERSION_CUSTOM_NAME] === this.customName);

        if (version) {
          try {
            this.templateValue.defaultVersionId = version.id;

            const data = [{
              op: 'replace', path: '/spec/defaultVersionId', value: version.id
            }];

            await this.templateValue.patch( data, { url: this.templateValue.linkFor('view') });
          } catch (err) {
            return Promise.reject(new Error(err.message));
          }
        }
      }
    });
  },

  mounted() {
    this.imageId = this.diskRows[0]?.image || '';
  },

  methods: {
    async saveVMT(buttonCb) {
      this.parseVM();

      const templates = await this.$store.dispatch('harvester/findAll', { type: HCI.VM_TEMPLATE });
      const template = templates.find( (O) => O.metadata.name === this.templateValue.metadata.name);

      try {
        if (!this.templateId) {
          if (this.templateValue?.metadata?.name) {
            await this.templateValue.save();
          } else {
            this.errors = [this.t('validation.required', { key: this.t('harvester.vmTemplate.nameNsDescription.name') })];
            buttonCb(false);

            return;
          }
        } else {
          template.save();
        }

        this.value.cleanForNew();
        this.customName = randomStr(10);
        this.value.metadata['annotations'] = {
          ...this.value.metadata.annotations,
          [HCI_ANNOTATIONS.TEMPLATE_VERSION_CUSTOM_NAME]: this.customName
        };

        const name = this.templateValue.metadata.name || template.metadata.name;
        const namespace = this.templateValue.metadata.namespace || template.metadata.namespace;

        if (this.isCreate) {
          this.value.metadata.namespace = namespace;
        }

        this.value.spec['templateId'] = `${ namespace }/${ name }`;

        // inherit labels and annotations so the VM gets them when created from the template
        this.value.spec.vm.metadata.labels = {
          ...this.value.spec.vm.metadata.labels,
          ...this.value.metadata.labels
        };
        this.value.spec.vm.metadata.annotations = {
          ...this.value.spec.vm.metadata.annotations,
          ...this.value.metadata.annotations
        };
        const res = await this.value.save();

        await this.saveSecret(res);
        await this.applyHooks(AFTER_SAVE_HOOKS);
        this.done();
      } catch (e) {
        this.errors = [e];
        buttonCb(false);
      }
    },

    onTabChanged({ tab }) {
      if (tab.name === 'advanced') {
        this.$refs.yamlEditor?.refresh();
      }
    },
  },
};
</script>

<template>
  <CruResource
    v-if="templateSpec && spec"
    :done-route="doneRoute"
    :resource="value"
    :can-yaml="false"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="saveVMT"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="templateValue"
      :mode="realTemplateMode"
      name-label="harvester.vmTemplate.nameNsDescription.name"
      :namespaced="true"
      @update:value="$emit('update:templateValue', $event)"
    />

    <Checkbox
      v-if="templateId"
      v-model:value="isDefaultVersion"
      class="mb-20"
      :label="t('tableHeaders.defaultVersion')"
      type="checkbox"
      :mode="mode"
    />

    <Tabbed
      :side-tabs="true"
      @changed="onTabChanged"
    >
      <Tab
        name="Basics"
        :label="t('harvester.vmTemplate.tabs.basics')"
      >
        <CpuMemory
          :cpu="cpu"
          :memory="memory"
          :max-cpu="maxCpu"
          :max-memory="maxMemory"
          :enable-hot-plug="cpuMemoryHotplugEnabled"
          :disabled="isConfig"
          @updateCpuMemory="updateCpuMemory"
        />

        <div class="mb-20">
          <SSHKey
            v-model:value="sshKey"
            :create-namespace="true"
            :namespace="templateValue.metadata.namespace"
            :disable-create="isView"
            :mode="mode"
            @update:sshKey="updateSSHKey"
          />
        </div>
      </Tab>

      <Tab
        name="Volume"
        :label="t('harvester.tab.volume')"
        :weight="-1"
      >
        <Volume
          v-model:value="diskRows"
          :mode="mode"
          :namespace="value.metadata.namespace"
          :existing-volume-disabled="true"
        />
      </Tab>

      <Tab
        name="Network"
        :label="t('harvester.tab.network')"
        :weight="-2"
      >
        <Network
          v-model:value="networkRows"
          :mode="mode"
        />
      </Tab>

      <Tab
        name="nodeScheduling"
        :label="t('workload.container.titles.nodeScheduling')"
        :weight="-3"
      >
        <template #default>
          <NodeScheduling
            :mode="mode"
            :value="spec.template.spec"
            :nodes="nodesIdOptions"
          />
        </template>
      </Tab>

      <Tab
        :label="t('harvester.tab.vmScheduling')"
        name="vmScheduling"
        :weight="-4"
      >
        <template #default>
          <PodAffinity
            :mode="mode"
            :value="spec.template.spec"
            :nodes="nodes"
            :all-namespaces-option-available="true"
            :namespaces="filteredNamespaces"
            :overwrite-labels="affinityLabels"
          />
        </template>
      </Tab>

      <Tab
        name="labels"
        :label="t('generic.labels')"
        :weight="-9"
      >
        <Banner color="info">
          <t k="harvester.virtualMachine.labels.banner" />
        </Banner>
        <KeyValue
          key="labels"
          :value="value.labels"
          :add-label="t('labels.addLabel')"
          :mode="mode"
          :read-allowed="false"
          :value-can-be-empty="true"
          @update:value="value.setLabels($event)"
        />
      </Tab>

      <Tab
        name="instanceLabel"
        :label="t('harvester.tab.instanceLabel')"
        :weight="-10"
      >
        <Banner color="info">
          <t k="harvester.virtualMachine.instanceLabels.banner" />
        </Banner>
        <KeyValue
          key="instance-labels"
          :value="value.instanceLabels"
          :protected-keys="value.systemLabels || []"
          :toggle-filter="toggler"
          :add-label="t('labels.addLabel')"
          :mode="mode"
          :read-allowed="false"
          :value-can-be-empty="true"
          @update:value="value.setInstanceLabels($event)"
        />
      </Tab>
      <Tab
        name="annotations"
        :label="t('harvester.tab.annotations')"
        :weight="-11"
      >
        <Banner color="info">
          <t k="harvester.virtualMachine.annotations.banner" />
        </Banner>
        <KeyValue
          key="annotations"
          :value="value.annotations"
          :protected-keys="value.systemAnnotations || []"
          :toggle-filter="true"
          :add-label="t('labels.addAnnotation')"
          :mode="mode"
          :read-allowed="false"
          :value-can-be-empty="true"
          @update:value="value.setAnnotations($event)"
        />
      </Tab>
      <Tab
        name="advanced"
        :label="t('harvester.tab.advanced')"
        :weight="-99"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="runStrategy"
              label-key="harvester.virtualMachine.runStrategy"
              :options="runStrategies"
              :mode="mode"
            />
          </div>

          <div class="col span-6">
            <LabeledSelect
              v-model:value="osType"
              label-key="harvester.virtualMachine.osType"
              :mode="mode"
              :options="OS"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="maintenanceStrategy"
              label-key="harvester.virtualMachine.maintenanceStrategy.label"
              :options="maintenanceStrategies"
              :get-option-label="getMaintenanceStrategyOptionLabel"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <Reserved
              :reserved-memory="reservedMemory"
              :mode="mode"
              @updateReserved="updateReserved"
            />
          </div>
        </div>
        <div class="row mb-20">
          <a
            v-if="showAdvanced"
            v-t="'harvester.generic.showMore'"
            role="button"
            @click="toggleAdvanced"
          />
          <a
            v-else
            v-t="'harvester.generic.showMore'"
            role="button"
            @click="toggleAdvanced"
          />
        </div>

        <div v-if="showAdvanced">
          <div class="row mb-20">
            <div class="col span-6">
              <UnitInput
                v-model:value="terminationGracePeriodSeconds"
                :suffix="terminationGracePeriodSeconds == 1 ? 'Second' : 'Seconds'"
                :label="t('harvester.virtualMachine.terminationGracePeriodSeconds.label')"
                :mode="mode"
                @change="updateTerminationGracePeriodSeconds"
              />
            </div>
          </div>
        </div>

        <CloudConfig
          ref="yamlEditor"
          :mode="mode"
          :user-script="userScript"
          :namespace="templateValue.metadata.namespace"
          :network-script="networkScript"
          @updateUserData="updateUserData"
          @updateNetworkData="updateNetworkData"
        />

        <div class="spacer"></div>
        <Checkbox
          v-if="value.cpuPinningFeatureEnabled"
          v-model:value="cpuPinning"
          class="check"
          type="checkbox"
          tooltip-key="harvester.virtualMachine.cpuPinning.tooltip"
          label-key="harvester.virtualMachine.cpuPinning.label"
          :mode="mode"
        />
        <Checkbox
          v-model:value="installUSBTablet"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.enableUsb')"
          :mode="mode"
        />

        <Checkbox
          v-model:value="installAgent"
          class="check"
          type="checkbox"
          label-key="harvester.virtualMachine.installAgent"
          :mode="mode"
        />

        <Checkbox
          v-model:value="tpmEnabled"
          class="check"
          type="checkbox"
          label-key="harvester.virtualMachine.advancedOptions.tpm"
          :mode="mode"
        />

        <Checkbox
          v-if="value.tpmPersistentStateFeatureEnabled && tpmEnabled"
          v-model:value="tpmPersistentStateEnabled"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.advancedOptions.tpmPersistentState')"
          :mode="mode"
        />

        <Checkbox
          v-model:value="efiEnabled"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.advancedOptions.efiEnabled')"
          :mode="mode"
        />

        <Checkbox
          v-if="value.efiPersistentStateFeatureEnabled && efiEnabled"
          v-model:value="efiPersistentStateEnabled"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.advancedOptions.efiPersistentState')"
          :mode="mode"
        />

        <Checkbox
          v-if="efiEnabled"
          v-model:value="secureBoot"
          class="check"
          type="checkbox"
          :label="t('harvester.virtualMachine.advancedOptions.secureBoot')"
          :mode="mode"
        />
      </Tab>
    </Tabbed>
  </CruResource>
</template>
