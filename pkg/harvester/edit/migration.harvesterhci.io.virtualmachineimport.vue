<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { Checkbox } from '@components/Form/Checkbox';
import CreateEditView from '@shell/mixins/create-edit-view';
import { STORAGE_CLASS } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';

// API Types and Constants
const MIGRATION_GROUP = 'migration.harvesterhci.io';
const VMWARE_KIND = 'VmwareSource';
const OPENSTACK_KIND = 'OpenstackSource';
const OVA_KIND = 'OvaSource';

// Full API types for the fetch dispatch
const VMWARE_SOURCE_TYPE = `${ MIGRATION_GROUP }.${ VMWARE_KIND.toLowerCase() }`;
const OPENSTACK_SOURCE_TYPE = `${ MIGRATION_GROUP }.${ OPENSTACK_KIND.toLowerCase() }`;
const OVA_SOURCE_TYPE = `${ MIGRATION_GROUP }.${ OVA_KIND.toLowerCase() }`;
const CLUSTER_NETWORK = 'network.harvesterhci.io.clusternetwork';

export default {
  name: 'EditVirtualMachineImport',

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    Checkbox
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:     Object,
      required: true,
    },
    mode: {
      type:     String,
      required: true,
    },
  },

  async fetch() {
    // Fetch all dependencies in parallel to speed up the page load
    const hash = {
      storageClasses:   this.$store.dispatch('harvester/findAll', { type: STORAGE_CLASS }),
      networks:         this.$store.dispatch('harvester/findAll', { type: CLUSTER_NETWORK }),
      vmwareSources:    this.$store.dispatch('harvester/findAll', { type: VMWARE_SOURCE_TYPE }),
      openstackSources: this.$store.dispatch('harvester/findAll', { type: OPENSTACK_SOURCE_TYPE }),
      ovaSources:       this.$store.dispatch('harvester/findAll', { type: OVA_SOURCE_TYPE }).catch(() => []),
    };

    const res = await allHash(hash);

    this.allStorageClasses = res.storageClasses;
    this.allNetworks = res.networks;
    this.vmwareSources = res.vmwareSources;
    this.openstackSources = res.openstackSources;
    this.ovaSources = res.ovaSources;
  },

  data() {
    // Ensure the spec object exists to prevent 'undefined' errors during rendering
    if (!this.value.spec) this.value.spec = {};
    if (!this.value.spec.sourceCluster) this.value.spec.sourceCluster = {};
    if (!this.value.spec.networkMapping) this.value.spec.networkMapping = [];

    // Detect if in Edit mode by checking the existing kind
    // This allows to pre-select the correct Provider Type tab
    let initialProvider = '';
    const existingKind = this.value.spec.sourceCluster.kind;

    if (existingKind === VMWARE_KIND) initialProvider = 'vmware';
    else if (existingKind === OPENSTACK_KIND) initialProvider = 'openstack';
    else if (existingKind === OVA_KIND) initialProvider = 'ova';

    // Construct the unique key (Kind/Namespace/Name) if we are editing an existing resource
    let initialSourceKey = null;

    if (this.value.spec.sourceCluster.name) {
      initialSourceKey = `${ existingKind }/${ this.value.spec.sourceCluster.namespace }/${ this.value.spec.sourceCluster.name }`;
    }

    return {
      allStorageClasses: [],
      allNetworks:       [],
      vmwareSources:     [],
      openstackSources:  [],
      ovaSources:        [],

      // UI State
      sourceProviderType: initialProvider,
      selectedSourceKey:  initialSourceKey,

      // Static Options
      providerTypeOptions: [
        { label: 'VMware', value: 'vmware' },
        { label: 'OpenStack', value: 'openstack' },
        { label: 'OVA', value: 'ova' }
      ],
      diskBusOptions: [
        // Allow resetting selection / reset to the default behavior (sending null/empty)
        { label: 'Use Default', value: '' },
        { label: 'VirtIO', value: 'virtio' },
        { label: 'SCSI', value: 'scsi' },
        { label: 'SATA', value: 'sata' },
        { label: 'USB', value: 'usb' },
      ],
      interfaceModelOptions: [
        // Allow resetting selection / reset to the default behavior (sending null/empty)
        { label: 'Use Default', value: '' },
        { label: 'VirtIO', value: 'virtio' },
        { label: 'e1000', value: 'e1000' },
        { label: 'e1000e', value: 'e1000e' },
        { label: 'ne2k_pci', value: 'ne2k_pci' },
        { label: 'pcnet', value: 'pcnet' },
        { label: 'rtl8139', value: 'rtl8139' },
      ]
    };
  },

  computed: {
    // Return only the sources that match the selected Provider Type (VMware or OpenStack)
    sourceOptions() {
      let list = [];

      if (this.sourceProviderType === 'vmware') {
        list = this.vmwareSources;
      } else if (this.sourceProviderType === 'openstack') {
        list = this.openstackSources;
      } else if (this.sourceProviderType === 'ova') {
        list = this.ovaSources;
      }

      return list.map((s) => {
        // Fallback for API version/kind if missing on the object
        let kind = s.kind;

        if (!kind) {
          if (this.sourceProviderType === 'vmware') kind = VMWARE_KIND;
          else if (this.sourceProviderType === 'openstack') kind = OPENSTACK_KIND;
          else if (this.sourceProviderType === 'ova') kind = OVA_KIND;
        }

        const apiVersion = s.apiVersion || `${ MIGRATION_GROUP }/v1beta1`;

        return {
          label: s.metadata.name,
          value: `${ kind }/${ s.metadata.namespace }/${ s.metadata.name }`,
          // We attach the raw metadata so we can easily populate the spec later without re-finding the object
          raw:   {
            kind,
            apiVersion,
            name:      s.metadata.name,
            namespace: s.metadata.namespace
          }
        };
      });
    },

    // Perform various form validations before allowing to submit
    isFormValid() {
      // Check VM Name is valid
      const nameError = this.fvNameRule(this.value.spec.virtualMachineName);

      if (nameError) return false;

      // Check mandatory fields in Basics
      if (!this.value.spec.virtualMachineName) return false;
      if (!this.selectedSourceKey) return false;

      // Check Network Mappings
      // If any row is missing source or destination, the form is invalid.
      const networks = this.value.spec.networkMapping || [];
      const hasInvalidRow = networks.some((row) => !row.sourceNetwork || !row.destinationNetwork);

      if (hasInvalidRow) return false;

      return true;
    },

    // Filter out internal storage classes
    // to prevent selecting a class that might cause the import to fail
    storageClassOptions() {
      return this.allStorageClasses
        .filter((sc) => {
          const isInternal = sc.parameters?.['harvesterhci.io/isInternalStorageClass'] === 'true';

          return !isInternal;
        })
        .map((sc) => ({
          label: sc.nameDisplay,
          value: sc.id
        }));
    },

    networkOptions() {
      return this.allNetworks.map((n) => ({
        label: n.nameDisplay || n.metadata.name,
        value: n.id
      }));
    }
  },

  methods: {
    // Clear the selected cluster if the user switches providers (e.g. VMware -> OpenStack)
    // Prevents submitting a VMware cluster name while the kind is OpenStack
    onProviderTypeChange(newType) {
      this.selectedSourceKey = null;
      this.value.spec.sourceCluster = {};
    },

    // Update the sourceCluster object based on the single dropdown selection
    updateSource(key) {
      this.selectedSourceKey = key;
      const selectedOption = this.sourceOptions.find((o) => o.value === key);

      if (selectedOption) {
        this.value.spec.sourceCluster = {
          kind:       selectedOption.raw.kind,
          apiVersion: selectedOption.raw.apiVersion,
          name:       selectedOption.raw.name,
          namespace:  selectedOption.raw.namespace,
        };
      } else {
        this.value.spec.sourceCluster = {};
      }
    },

    addNetworkMapping() {
      this.value.spec.networkMapping.push({
        sourceNetwork:         '',
        destinationNetwork:    '',
        networkInterfaceModel: ''
      });
    },

    removeNetworkMapping(index) {
      this.value.spec.networkMapping.splice(index, 1);
    },

    // Validates that the input follows Kubernetes Naming Rules (RFC 1123).
    // If the source VM has uppercase letters or spaces, the user must be warned
    // that they cannot import it until they rename it on the source. See:
    // https://docs.harvesterhci.io/v1.6/advanced/addons/vmimport/#source-virtual-machine-name-is-not-rfc1123-compliant
    fvNameRule(val) {
      if (!val) return undefined; // 'Required' check handles empty state separately

      // Regex: Lowercase alphanumeric, hyphens allowed in middle, start/end with alphanumeric
      const rfc1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

      if (!rfc1123.test(val)) {
        return 'Invalid format. Name must be lowercase, alphanumeric, and cannot contain spaces (e.g. "my-vm-1"). If your Source VM name does not match this, you must rename it on the Source cluster first.';
      }

      return undefined;
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    :validation-passed="isFormValid"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      @update:value="$emit('update:value', $event)"
    />

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="basic"
        label="Basics"
        :weight="3"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="sourceProviderType"
              :options="providerTypeOptions"
              label="Source Provider Type"
              :mode="mode"
              @update:value="onProviderTypeChange"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              :value="selectedSourceKey"
              :options="sourceOptions"
              label="Source Cluster"
              :placeholder="sourceProviderType ? 'Select a cluster...' : 'Select a provider type first'"
              :disabled="!sourceProviderType"
              :mode="mode"
              required
              @update:value="updateSource"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.virtualMachineName"
              label="VM Name"
              placeholder="Must match the name in the source cluster"
              tooltip="This must match the Source VM name exactly. If your Source VM name contains spaces or uppercase letters, you must rename it in VMware/OpenStack first, as Harvester does not support those characters."
              :rules="[fvNameRule]"
              :mode="mode"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.storageClass"
              :options="storageClassOptions"
              label="Target Storage Class"
              :mode="mode"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="networking"
        label="Network Mapping"
        :weight="2"
      >
        <div
          v-for="(row, i) in value.spec.networkMapping"
          :key="i"
          class="network-row box mb-10"
        >
          <div class="row">
            <div class="col span-4">
              <LabeledInput
                v-model:value="row.sourceNetwork"
                label="Source Network Name"
                :mode="mode"
                required
              />
            </div>
            <div class="col span-4">
              <LabeledSelect
                v-model:value="row.destinationNetwork"
                :options="networkOptions"
                label="Destination Network"
                :mode="mode"
                required
              />
            </div>
            <div class="col span-3">
              <LabeledSelect
                v-model:value="row.networkInterfaceModel"
                :options="interfaceModelOptions"
                label="Interface Model"
                :mode="mode"
              />
            </div>
            <div class="col span-1 remove-btn-container">
              <button
                type="button"
                class="btn role-link"
                @click="removeNetworkMapping(i)"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="btn role-secondary"
          @click="addNetworkMapping"
        >
          Add Network Mapping
        </button>
      </Tab>

      <Tab
        name="advanced"
        label="Advanced"
        :weight="1"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.folder"
              label="Folder"
              placeholder="e.g. /Datacenters/DC1/vm"
              :mode="mode"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.defaultDiskBusType"
              :options="diskBusOptions"
              label="Default Disk Bus"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.defaultNetworkInterfaceModel"
              :options="interfaceModelOptions"
              label="Default Network Interface"
              :mode="mode"
            />
          </div>
        </div>

        <div class="row">
          <div class="col span-12">
            <Checkbox
              v-model:value="value.spec.skipPreflightChecks"
              label="Skip Preflight Checks"
              :mode="mode"
            />
            <Checkbox
              v-model:value="value.spec.forcePowerOff"
              label="Force Power Off Source VM"
              :mode="mode"
              class="mt-10"
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>

<style lang="scss" scoped>
/*
  Borders for network mapping rows make them better visible as
  they are more complex objects than simple key-value pairs.
*/
.network-row {
  border: 1px solid var(--border);
  padding: 10px;
  border-radius: var(--border-radius);
  background: var(--body-bg);
}

/* Centers the remove button vertically with the adjacent inputs */
.remove-btn-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
