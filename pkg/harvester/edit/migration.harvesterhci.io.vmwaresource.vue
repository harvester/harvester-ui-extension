<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import CreateEditView from '@shell/mixins/create-edit-view';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';

export default {
  name: 'EditVmwareSource',

  // Declare the event, fixes a console warning
  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    RadioGroup
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
    if (!this.value.spec.credentials) this.value.spec.credentials = {};

    const initialMode = this.value.spec.credentials.name ? 'existing' : 'new';

    return {
      allSecrets:      [],
      authMode:        initialMode,
      newUsername:     '',
      newPassword:     '',
      authModeOptions: [
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
      if (!this.value.spec.endpoint) return false;
      if (!this.value.spec.dc) return false;

      if (this.authMode === 'new') {
        if (!this.newUsername || !this.newPassword) return false;
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
            username: btoa(this.newUsername),
            password: btoa(this.newPassword)
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
        name="basic"
        label="Basics"
        :weight="2"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.endpoint"
              label="vCenter Endpoint"
              placeholder="e.g. https://vscim/sdk"
              :mode="mode"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.dc"
              label="Datacenter"
              placeholder="e.g. DC0"
              tooltip="The exact name of the Datacenter object in vCenter"
              :mode="mode"
              required
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="auth"
        label="Authentication"
        :weight="1"
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
          <div class="text-muted">
            Note: A new Kubernetes Secret will be created to store these credentials.
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
    </Tabbed>
  </CruResource>
</template>
