<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import { Checkbox } from '@components/Form/Checkbox';
import CreateEditView from '@shell/mixins/create-edit-view';
import FormValidation from '@shell/mixins/form-validation';
import { SECRET } from '@shell/config/types';
import { randomStr } from '@shell/utils/string';
import { mapGetters } from 'vuex';

const PROVIDER_TYPES = [
  { labelKey: 'harvester.addons.forklift.fields.providerTypeVsphere', value: 'vsphere' },
  { labelKey: 'harvester.addons.forklift.fields.providerTypeOpenstack', value: 'openstack' },
  { labelKey: 'harvester.addons.forklift.fields.providerTypeOpenshift', value: 'openshift' },
];

export default {
  name: 'EditForkliftProvider',

  emits: ['update:value'],

  components: {
    CruResource,
    Tabbed,
    Tab,
    LabeledInput,
    LabeledSelect,
    NameNsDescription,
    RadioGroup,
    Checkbox,
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
    if (!this.value.spec) {
      this.value.spec = {
        type:   'vsphere',
        url:    '',
        secret: {},
      };
    }

    const initialMode = this.value.spec.secret?.name ? 'existing' : 'new';

    return {
      allSecrets:    [],
      authMode:      initialMode,
      newUsername:    '',
      newPassword:   '',
      newCaCert:     '',
      skipTlsVerify: true,

      fvFormRuleSets: [
        { path: 'metadata.name', rules: ['nameRequired'] },
        { path: 'spec.url', rules: ['urlRequired'] },
      ],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    providerTypes() {
      return PROVIDER_TYPES.map((pt) => ({
        label: this.t(pt.labelKey),
        value: pt.value,
      }));
    },

    authModeOptions() {
      return [
        { label: this.t('harvester.addons.forklift.fields.createSecret'), value: 'new' },
        { label: this.t('harvester.addons.forklift.fields.useSecret'), value: 'existing' }
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

    fvExtraRules() {
      return {
        nameRequired: (val) => !val ? this.t('validation.required', { key: this.t('harvester.fields.name') }) : undefined,
        urlRequired:  (val) => !val ? this.t('validation.required', { key: this.t('harvester.addons.forklift.fields.url') }) : undefined,
      };
    },

    isFormValid() {
      if (!this.fvFormIsValid) {
        return false;
      }

      // Local openshift provider doesn't need auth or URL
      if (this.value.spec.type === 'openshift') {
        return true;
      }

      if (this.authMode === 'new') {
        if (!this.newUsername || !this.newPassword) {
          return false;
        }
      } else if (!this.value.spec.secret?.name) {
        return false;
      }

      return true;
    }
  },

  methods: {
    usernameRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.forklift.fields.username') }) : undefined;
    },
    passwordRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.forklift.fields.password') }) : undefined;
    },
    secretRule(val) {
      return !val ? this.t('validation.required', { key: this.t('harvester.addons.forklift.fields.selectSecret') }) : undefined;
    },

    async saveProvider(buttonCb) {
      const inStore = this.$store.getters['currentProduct'].inStore;

      try {
        // Local openshift provider uses empty secret
        if (this.value.spec.type === 'openshift') {
          this.value.spec.secret = {};
          this.value.spec.url = '';
          await this.save(buttonCb);

          return;
        }

        if (this.authMode === 'new') {
          const secretName = `${ this.value.metadata.name }-creds-${ randomStr(4).toLowerCase() }`;
          const namespace = this.value.metadata.namespace || 'default';

          const newSecret = await this.$store.dispatch(`${ inStore }/create`, {
            type:     SECRET,
            metadata: {
              name:   secretName,
              namespace,
              labels: {
                createdForProviderType: this.value.spec.type,
                createdForResourceType: 'providers',
              }
            }
          });

          newSecret['_type'] = 'Opaque';
          newSecret['data'] = {
            user:               btoa(this.newUsername),
            password:           btoa(this.newPassword),
            insecureSkipVerify: btoa(String(this.skipTlsVerify)),
            url:                btoa(this.value.spec.url),
          };

          if (this.newCaCert) {
            newSecret.data.cacert = btoa(this.newCaCert);
          }

          await newSecret.save();

          this.value.spec.secret = {
            name: secretName,
            namespace,
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
    @finish="saveProvider"
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
        :label="t('harvester.addons.forklift.titles.basic')"
        :weight="2"
      >
        <div class="row mb-20">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="value.spec.type"
              :options="providerTypes"
              :label="t('harvester.addons.forklift.fields.providerType')"
              :mode="mode"
              required
            />
          </div>
          <div
            v-if="value.spec.type !== 'openshift'"
            class="col span-6"
          >
            <LabeledInput
              v-model:value="value.spec.url"
              :label="t('harvester.addons.forklift.fields.url')"
              :placeholder="t('harvester.addons.forklift.placeholders.url')"
              :mode="mode"
              :rules="fvGetAndReportPathRules('spec.url')"
              required
            />
          </div>
        </div>
      </Tab>

      <Tab
        v-if="value.spec.type !== 'openshift'"
        name="auth"
        :label="t('harvester.addons.forklift.titles.auth')"
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
                :label="t('harvester.addons.forklift.fields.username')"
                :mode="mode"
                :rules="[usernameRule]"
                required
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="newPassword"
                type="password"
                :label="t('harvester.addons.forklift.fields.password')"
                :mode="mode"
                :rules="[passwordRule]"
                required
              />
            </div>
          </div>
          <div class="row mb-20">
            <div class="col span-12">
              <LabeledInput
                v-model:value="newCaCert"
                type="multiline"
                :label="t('harvester.addons.forklift.fields.caCert')"
                :placeholder="t('harvester.addons.forklift.placeholders.caCert')"
                :min-height="100"
                :mode="mode"
              />
            </div>
          </div>

          <div class="row mb-20">
            <div class="col span-12">
              <Checkbox
                v-model:value="skipTlsVerify"
                :label="t('harvester.addons.forklift.fields.insecureSkipVerify')"
                :mode="mode"
              />
            </div>
          </div>
        </div>

        <div v-if="authMode === 'existing'">
          <div class="row mb-20">
            <div class="col span-6">
              <LabeledSelect
                v-model:value="value.spec.secret.name"
                :options="secretOptions"
                :label="t('harvester.addons.forklift.fields.selectSecret')"
                :mode="mode"
                :rules="[secretRule]"
                required
              />
            </div>
          </div>
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
