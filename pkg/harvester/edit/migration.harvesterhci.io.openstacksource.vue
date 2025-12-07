<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import { TextArea } from '@components/Form/TextArea';
import UnitInput from '@shell/components/form/UnitInput';
import CreateEditView from '@shell/mixins/create-edit-view';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';

export default {
  name: 'EditOpenstackSource',

  // Declare the event, fixes a console warning
  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    RadioGroup,
    TextArea,
    UnitInput
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
    // Load all existing secrets to populate the "Use Existing Secret" dropdown.
    this.allSecrets = await this.$store.dispatch('harvester/findAll', { type: SECRET });
  },

  data() {
    // Initialize the spec structure if it's missing (e.g. fresh create)
    if (!this.value.spec) this.value.spec = {};
    if (!this.value.spec.credentials) this.value.spec.credentials = {};

    // If a secret name is already set, assume the user wants to keep using it, otherwise "Create New".
    const initialMode = this.value.spec.credentials.name ? 'existing' : 'new';

    return {
      allSecrets:      [],
      authMode:        initialMode,

      // Temporary fields for credential input.
      // NOT bind these to the resource model directly to avoid
      // leaking plain-text passwords into the CRD yaml.
      newUsername:     '',
      newPassword:     '',
      newProjectName:  '',
      newDomainName:   '',
      newCaCert:       '',

      authModeOptions: [
        { label: 'Create New Credentials', value: 'new' },
        { label: 'Use Existing Secret', value: 'existing' }
      ]
    };
  },

  computed: {
    // Filter secrets for the ones in the same namespace.
    secretOptions() {
      const currentNamespace = this.value.metadata.namespace || 'default';

      return this.allSecrets
        .filter((s) => s.metadata.namespace === currentNamespace)
        .map((s) => ({
          label: s.nameDisplay,
          value: s.metadata.name
        }));
    },

    // Controls the "Save" button state, enforce required fields.
    isFormValid() {
      if (!this.value.spec.endpoint) return false;
      if (!this.value.spec.region) return false;

      if (this.authMode === 'new') {
        // OpenStack requires these 4 fields
        if (!this.newUsername || !this.newPassword) return false;
        if (!this.newProjectName || !this.newDomainName) return false;
        // CA Cert is optional (e.g. public cloud), don't block saving if empty
      } else {
        if (!this.value.spec.credentials.name) return false;
      }

      return true;
    }
  },

  methods: {
    async saveSource(buttonCb) {
      try {
        if (this.authMode === 'new') {
          const secretName = `${ this.value.metadata.name }-creds-${ randomStr(4).toLowerCase() }`;
          const namespace = this.value.metadata.namespace || 'default';

          // Create the model with the correct Schema ID (SECRET)
          const newSecret = await this.$store.dispatch('harvester/create', {
            type:     SECRET,
            metadata: {
              name: secretName,
              namespace
            }
          });

          // Use '_type' to set the Kubernetes 'type' field.
          // Setting 'type' directly overwrites the Schema ID and breaks the save() URL.
          newSecret['_type'] = 'Opaque';

          // base64 encode the data
          newSecret['data'] = {
            username:     btoa(this.newUsername),
            password:     btoa(this.newPassword),
            project_name: btoa(this.newProjectName),
            domain_name:  btoa(this.newDomainName),
            // Only include CA cert if the user provided one
            ca_cert:      this.newCaCert ? btoa(this.newCaCert) : undefined
          };

          await newSecret.save();

          // Link the new secret to the Source
          this.value.spec.credentials = {
            name: secretName,
            namespace
          };
        }

        await this.save(buttonCb);
      } catch (err) {
        this.errors = [err];
        buttonCb(false);
      }
    }
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
    @finish="saveSource"
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
        name="connection"
        label="Connection"
        :weight="3"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.endpoint"
              label="Identity Service Endpoint"
              placeholder="e.g. https://devstack/identity"
              :mode="mode"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.region"
              label="Region"
              placeholder="e.g. RegionOne"
              :mode="mode"
              required
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="auth"
        label="Authentication"
        :weight="2"
      >
        <div class="row mb-20">
          <div class="col span-12">
            <RadioGroup
              v-model:value="authMode"
              name="authMode"
              :options="authModeOptions"
              :mode="mode"
            />
          </div>
        </div>

        <div v-if="authMode === 'new'">
          <div class="row mb-20">
            <div class="col span-6">
              <LabeledInput
                v-model:value="newUsername"
                label="Username"
                :mode="mode"
                required
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newPassword"
                type="password"
                label="Password"
                :mode="mode"
                required
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-6">
              <LabeledInput
                v-model:value="newProjectName"
                label="Project Name"
                placeholder="e.g. admin"
                :mode="mode"
                required
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newDomainName"
                label="Domain Name"
                placeholder="e.g. default"
                :mode="mode"
                required
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-12">
              <TextArea
                v-model:value="newCaCert"
                label="CA Certificate (PEM)"
                placeholder="-----BEGIN CERTIFICATE----- ..."
                :min-height="100"
                :mode="mode"
              />
            </div>
          </div>
        </div>

        <div v-if="authMode === 'existing'">
          <div class="row mb-20">
            <div class="col span-6">
              <LabeledSelect
                v-model:value="value.spec.credentials.name"
                :options="secretOptions"
                label="Select Secret"
                :mode="mode"
                required
              />
            </div>
          </div>
        </div>
      </Tab>

      <Tab
        name="advanced"
        label="Advanced"
        :weight="1"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <UnitInput
              v-model:value="value.spec.uploadImageRetryCount"
              label="Upload Image Retry Count"
              placeholder="Default: 30"
              suffix="Times"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <UnitInput
              v-model:value="value.spec.uploadImageRetryDelay"
              label="Upload Image Retry Delay"
              placeholder="Default: 10"
              suffix="Seconds"
              :mode="mode"
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
