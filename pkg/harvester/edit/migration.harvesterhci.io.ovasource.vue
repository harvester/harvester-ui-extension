<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import UnitInput from '@shell/components/form/UnitInput';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { mapGetters } from 'vuex';

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
    UnitInput
  },

  mixins: [CreateEditView, FormValidation],

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
    const inStore = this.$store.getters['currentProduct'].inStore;

    this.allSecrets = await this.$store.dispatch(`${ inStore }/findAll`, { type: SECRET });
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

      // Validation Rules for static fields
      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
        { path: 'spec.url', rules: ['urlRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    authModeOptions() {
      return [
        { label: this.t('harvester.addons.vmImport.fields.none'), value: 'none' },
        { label: this.t('harvester.addons.vmImport.fields.createSecret'), value: 'new' },
        { label: this.t('harvester.addons.vmImport.fields.useSecret'), value: 'existing' }
      ];
    },

    secretOptions() {
      const currentNamespace = this.value.metadata.namespace || 'default';

      return this.allSecrets
        .filter((s) => s.metadata.namespace === currentNamespace)
        .map((s) => ({
          label: s.nameDisplay,
          value: s.metadata.name
        }));
    },

    // Define custom rules for the FormValidation mixin
    fvExtraRules() {
      return {
        nameRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined,
        urlRequired:  (val) => !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.ova.fields.url') }) : undefined,
      };
    },

    isFormValid() {
      if (!this.fvFormIsValid) {
        return false;
      }

      if (this.authMode === 'new') {
        // At least a username/password OR a CA cert to be provided.
        // If the user selected "Create New", they likely intend to enter something.
        if (!this.newUsername && !this.newPassword && !this.newCaCert) return false;
      } else if (this.authMode === 'existing') {
        if (!this.value.spec.credentials?.name) return false;
      }

      return true;
    }
  },

  watch: {
    authMode(newMode) {
      if (newMode === 'existing') {
        // Bind to value.spec.credentials.name for existing credential
        // Ensure 'credentials' object exists first when selected
        if (!this.value.spec.credentials) {
          this.value.spec.credentials = {
            name:      '',
            namespace: this.value.metadata.namespace || 'default'
          };
        }
      }
    }
  },

  methods: {
    secretRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.fields.selectSecret') }) : undefined;
    },

    async saveSource(buttonCb) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      try {
        if (this.authMode === 'none') {
          // Clear any credential reference
          delete this.value.spec.credentials;
        } else if (this.authMode === 'new') {
          const secretName = `${ this.value.metadata.name }-creds-${ randomStr(4).toLowerCase() }`;
          const namespace = this.value.metadata.namespace || 'default';

          const newSecret = await this.$store.dispatch(`${ inStore }/create`, {
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
            // vm-import-controller code specifies "ca.crt" with a dot.
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
      :rules="{ name: fvGetAndReportPathRules('metadata.name') }"
      @update:value="$emit('update:value', $event)"
    />

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="basic"
        :label="t('harvester.addons.vmImport.titles.basic')"
        :weight="3"
      >
        <div class="row mb-20">
          <div class="col span-12">
            <LabeledInput
              v-model:value="value.spec.url"
              :label="t('harvester.addons.vmImport.ova.fields.url')"
              :placeholder="t('harvester.addons.vmImport.ova.placeholders.url')"
              tooltip="Supports HTTP and HTTPS protocols."
              :mode="mode"
              :rules="fvGetAndReportPathRules('spec.url')"
              required
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="auth"
        :label="t('harvester.addons.vmImport.titles.auth')"
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
                :label="t('harvester.addons.vmImport.fields.username')"
                placeholder="(Optional)"
                :mode="mode"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newPassword"
                type="password"
                :label="t('harvester.addons.vmImport.fields.password')"
                placeholder="(Optional)"
                :mode="mode"
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-12">
              <LabeledInput
                v-model:value="newCaCert"
                type="multiline"
                :label="t('harvester.addons.vmImport.fields.caCert')"
                :placeholder="t('harvester.addons.vmImport.placeholders.caCert')"
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
                :label="t('harvester.addons.vmImport.fields.selectSecret')"
                :mode="mode"
                :rules="[secretRule]"
                required
              />
            </div>
          </div>
        </div>
      </Tab>

      <Tab
        name="advanced"
        :label="t('harvester.addons.vmImport.titles.advanced')"
        :weight="1"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <UnitInput
              v-model:value="value.spec.httpTimeoutSeconds"
              :label="t('harvester.addons.vmImport.ova.fields.httpTimeout')"
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
