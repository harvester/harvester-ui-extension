<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import { TextAreaAutoGrow } from '@components/Form/TextArea';
import UnitInput from '@shell/components/form/UnitInput';
import CreateEditView from '@shell/mixins/create-edit-view';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';

export default {
  name: 'EditOvaSource',

  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    RadioGroup,
    TextAreaAutoGrow,
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
    this.allSecrets = await this.$store.dispatch('harvester/findAll', { type: SECRET });
  },

  data() {
    if (!this.value.spec) this.value.spec = {};

    // Auth is optional for OVA (public URLs).
    // If credentials.name exists -> Existing.
    // If not -> None (default).
    let initialMode = 'none';

    if (this.value.spec.credentials?.name) {
      initialMode = 'existing';
    }

    return {
      allSecrets:      [],
      authMode:        initialMode,

      newUsername:     '',
      newPassword:     '',
      newCaCert:       '', // Key will be "ca.crt"

      authModeOptions: [
        { label: 'None (Public URL)', value: 'none' },
        { label: 'Create New Credentials', value: 'new' },
        { label: 'Use Existing Secret', value: 'existing' }
      ]
    };
  },

  computed: {
    secretOptions() {
      const currentNamespace = this.value.metadata.namespace || 'default';

      return this.allSecrets
        .filter((s) => s.metadata.namespace === currentNamespace)
        .map((s) => ({
          label: s.nameDisplay,
          value: s.metadata.name
        }));
    },

    isFormValid() {
      // URL is mandatory
      if (!this.value.spec.url) return false;

      if (this.authMode === 'new') {
        // At least a username/password OR a CA cert to be provided.
        if (!this.newUsername && !this.newPassword && !this.newCaCert) return false;
      } else if (this.authMode === 'existing') {
        if (!this.value.spec.credentials?.name) return false;
      }

      return true;
    }
  },

  methods: {
    async saveSource(buttonCb) {
      try {
        if (this.authMode === 'none') {
          // Clear any credential reference
          delete this.value.spec.credentials;
        } else if (this.authMode === 'new') {
          const secretName = `${ this.value.metadata.name }-creds-${ randomStr(4).toLowerCase() }`;
          const namespace = this.value.metadata.namespace || 'default';

          const newSecret = await this.$store.dispatch('harvester/create', {
            type:     SECRET,
            metadata: {
              name: secretName,
              namespace
            }
          });

          newSecret['_type'] = 'Opaque';
          newSecret['data'] = {
            // Optional fields logic
            username: this.newUsername ? btoa(this.newUsername) : undefined,
            password: this.newPassword ? btoa(this.newPassword) : undefined,
            // vm-import-controller code specifies "ca.crt" with a dot. See:
            // https://github.com/harvester/vm-import-controller/blob/main/pkg/apis/migration.harvesterhci.io/v1beta1/ova.go#L35
            'ca.crt': this.newCaCert ? btoa(this.newCaCert) : undefined
          };

          await newSecret.save();

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
        name="basic"
        label="Basics"
        :weight="3"
      >
        <div class="row mb-20">
          <div class="col span-12">
            <LabeledInput
              v-model:value="value.spec.url"
              label="OVA URL"
              placeholder="e.g. https://download.example.com/images/my-vm.ova"
              tooltip="Supports HTTP and HTTPS protocols."
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
                placeholder="(Optional)"
                :mode="mode"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newPassword"
                type="password"
                label="Password"
                placeholder="(Optional)"
                :mode="mode"
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-12">
              <TextAreaAutoGrow
                v-model:value="newCaCert"
                label="CA Certificate (PEM)"
                placeholder="-----BEGIN CERTIFICATE----- ... (Optional)"
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
              v-model:value="value.spec.httpTimeoutSeconds"
              label="HTTP Timeout"
              placeholder="Default: 600"
              suffix="Seconds"
              :mode="mode"
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
