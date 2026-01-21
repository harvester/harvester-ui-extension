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
  name: 'EditOpenstackSource',

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

  inheritAttrs: false,

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
    if (!this.value.spec.credentials) this.value.spec.credentials = {};

    const initialMode = this.value.spec.credentials.name ? 'existing' : 'new';

    return {
      allSecrets:      [],
      authMode:        initialMode,

      newUsername:     '',
      newPassword:     '',
      newProjectName:  '',
      newDomainName:   '',
      newCaCert:       '',

      // Rules for fields that exist in the value object (Model)
      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
        { path: 'spec.endpoint', rules: ['endpointRequired'] },
        { path: 'spec.region', rules: ['regionRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    authModeOptions() {
      return [
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
        nameRequired:     (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined,
        endpointRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.openstack.fields.endpoint') }) : undefined,
        regionRequired:   (val) => !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.openstack.fields.region') }) : undefined,
      };
    },

    // Combine mixin validation + conditional manual checks
    isFormValid() {
      // Check static fields via Mixin
      if (!this.fvFormIsValid) {
        return false;
      }

      // Check conditional fields
      if (this.authMode === 'new') {
        if (!this.newUsername || !this.newPassword) return false;
        if (!this.newProjectName || !this.newDomainName) return false;
      } else {
        if (!this.value.spec.credentials.name) return false;
      }

      return true;
    }
  },

  methods: {
    usernameRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.fields.username') }) : undefined;
    },
    passwordRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.fields.password') }) : undefined;
    },
    projectRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.openstack.fields.projectName') }) : undefined;
    },
    domainRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.openstack.fields.domainName') }) : undefined;
    },
    secretRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.vmImport.fields.selectSecret') }) : undefined;
    },

    async saveSource(buttonCb) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      try {
        if (this.authMode === 'new') {
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
            username:     btoa(this.newUsername),
            password:     btoa(this.newPassword),
            project_name: btoa(this.newProjectName),
            domain_name:  btoa(this.newDomainName),
            ca_cert:      this.newCaCert ? btoa(this.newCaCert) : undefined
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
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.endpoint"
              :label="t('harvester.addons.vmImport.openstack.fields.endpoint')"
              :placeholder="t('harvester.addons.vmImport.openstack.placeholders.endpoint')"
              :mode="mode"
              :rules="fvGetAndReportPathRules('spec.endpoint')"
              required
            />
          </div>
          <div class="col span-6">
            <LabeledInput
              v-model:value="value.spec.region"
              :label="t('harvester.addons.vmImport.openstack.fields.region')"
              :placeholder="t('harvester.addons.vmImport.openstack.placeholders.region')"
              :mode="mode"
              :rules="fvGetAndReportPathRules('spec.region')"
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
                :mode="mode"
                :rules="[usernameRule]"
                required
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newPassword"
                type="password"
                :label="t('harvester.addons.vmImport.fields.password')"
                :mode="mode"
                :rules="[passwordRule]"
                required
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-6">
              <LabeledInput
                v-model:value="newProjectName"
                :label="t('harvester.addons.vmImport.openstack.fields.projectName')"
                :placeholder="t('harvester.addons.vmImport.openstack.placeholders.projectName')"
                :mode="mode"
                :rules="[projectRule]"
                required
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newDomainName"
                :label="t('harvester.addons.vmImport.openstack.fields.domainName')"
                :placeholder="t('harvester.addons.vmImport.openstack.placeholders.domainName')"
                :mode="mode"
                :rules="[domainRule]"
                required
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
              v-model:value="value.spec.uploadImageRetryCount"
              :label="t('harvester.addons.vmImport.openstack.fields.retryCount')"
              :placeholder="t('harvester.addons.vmImport.openstack.placeholders.retryCount')"
              suffix="Times"
              :mode="mode"
            />
          </div>
          <div class="col span-6">
            <UnitInput
              v-model:value="value.spec.uploadImageRetryDelay"
              :label="t('harvester.addons.vmImport.openstack.fields.retryDelay')"
              :placeholder="t('harvester.addons.vmImport.openstack.placeholders.retryDelay')"
              suffix="Seconds"
              :mode="mode"
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
