<script>
import CruResource from '@shell/components/CruResource';
import { RadioGroup } from '@components/Form/Radio';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { TextAreaAutoGrow } from '@components/Form/TextArea';
import UnitInput from '@shell/components/form/UnitInput';
import CreateEditView from '@shell/mixins/create-edit-view';
import { DOC } from '../config/doc-links';
import { docLink } from '../utils/feature-flags';

import { HCI_ALLOWED_SETTINGS, HCI_SINGLE_CLUSTER_ALLOWED_SETTING, HCI_SETTING } from '../config/settings';

export default {
  components: {
    CruResource,
    LabeledInput,
    LabeledSelect,
    RadioGroup,
    TextAreaAutoGrow,
    UnitInput
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  data() {
    const t = this.$store.getters['i18n/t'];
    const setting =
      HCI_ALLOWED_SETTINGS[this.value.id] ||
      HCI_SINGLE_CLUSTER_ALLOWED_SETTING[this.value.id];

    let enumOptions = [];

    if (setting.kind === 'enum') {
      enumOptions = setting.options.map((id) => ({
        label: `advancedSettings.enum.harv-${ this.value.id }.${ id }`,
        value: id
      }));
    }

    const canReset =
      setting.canReset || !!this.value.default || this.value.canReset;

    if (this.value.value === undefined) {
      this.value['value'] = null;
    }

    this.value.value = this.value.value || this.value.default || '';
    const oldValue = this.value.value;

    const isHarvester = this.value?.type?.includes('harvesterhci');

    // Get all the custom volume types from the file names of this folder
    const customSettingComponents = require
      .context('../components/settings', false, /^.*\.vue$/)
      .keys()
      .map((path) => path.replace(/(\.\/)|(.vue)/g, ''));

    return {
      setting,
      description: isHarvester ? t(
        `advancedSettings.descriptions.harv-${ this.value.id }`,
        this.getDocLinkParams()
      ) : t(
        `advancedSettings.descriptions.${ this.value.id }`,
        this.getDocLinkParams()
      ),
      editHelp:           t(`advancedSettings.editHelp.${ this.value.id }`),
      enumOptions,
      canReset,
      errors:             [],
      hasCustomComponent: false,
      customComponent:    null,
      customSettingComponents,
      oldValue
    };
  },

  computed: {
    doneLocationOverride() {
      return this.value.doneOverride;
    }
  },

  created() {
    let customComponent = false;
    const hasCustomComponent = this.customSettingComponents.includes(this.value.id);

    if ( hasCustomComponent ) {
      try {
        customComponent = require(`../components/settings/${ this.value.id }.vue`).default;
      } catch {}
    } else {
      // Some resources like vlan and network go out to a non-standard location (edit/<resource>/<id>.vue). For example
      // 'edit/harvesterhci.io.managedchart/rancher-monitoring.vue'
      const resource = this.$route.params.resource;
      const name = this.value.metadata.name;

      try {
        customComponent = require(`./${ resource }/${ name }.vue`).default;
      } catch {}
    }

    this.hasCustomComponent = !!customComponent;
    this.customComponent = customComponent;

    this.registerAfterHook(() => {
      if (this.value.id === HCI_SETTING.RANCHER_MANAGER_SUPPORT) {
        this.$store.commit('isRancherInHarvester', this.value.value === 'true');
      }
    });
  },

  methods: {
    done() {
      this.$router.go(-1);
    },

    async saveSettings(done) {
      const t = this.$store.getters['i18n/t'];

      // Validate the JSON if the setting is a json value
      if (this.setting.kind === 'json' && this.value.default) {
        try {
          JSON.parse(this.value.value);
          this.errors = [];
        } catch (e) {
          this.errors = [t('advancedSettings.edit.invalidJSON')];

          return done(false);
        }
      }

      if (this.value.metadata.name === HCI_SETTING.CLUSTER_REGISTRATION_URL && this.oldValue && this.value.value !== this.oldValue) {
        await this.clusterRegistrationUrlTip();
      }

      // remove any leading zeros (e.g. '0123' becomes 123)
      if (this.setting.kind === 'number' && this.value.value) {
        const num = Number(this.value.value);

        this.value.value = isNaN(num) ? 0 : `${ num }`;
      }

      this.save(done);
    },

    clusterRegistrationUrlTip() {
      return new Promise((resolve) => {
        this.$store.dispatch('harvester/promptModal', {
          component: 'MessageBox',
          callback:  (action) => {
            if (action === 'ok') {
              resolve();
            }
          },
          contentKey: 'harvester.setting.clusterRegistrationUrl.message'
        }, { root: true });
      });
    },

    useDefault(ev) {
      // Lose the focus on the button after click
      if (ev && ev.srcElement) {
        ev.srcElement.blur();
      }

      if (this.value.id === HCI_SETTING.VLAN) {
        this.value.enable = false;
        if (this.value.config) {
          this.value.config.defaultPhysicalNIC = '';
        }
      } else {
        this.value.value = this.value.default || '';
      }

      if (typeof this.$refs.settingComp?.useDefault === 'function') {
        this.$refs.settingComp.useDefault();
      }
    },
    getDocLinkParams() {
      const setting = HCI_ALLOWED_SETTINGS[this.value.id] || HCI_SINGLE_CLUSTER_ALLOWED_SETTING[this.value.id];

      if (setting?.docPath) {
        const version = this.$store.getters['harvester-common/getServerVersion']();
        const url = docLink(DOC[setting.docPath], version);

        return { url };
      }

      return {};
    }
  }
};
</script>

<template>
  <CruResource
    class="route"
    :errors="errors"
    :mode="mode"
    :resource="value"
    :subtypes="[]"
    :can-yaml="false"
    :cancel-event="true"
    @error="e=>errors=e"
    @finish="saveSettings"
    @cancel="done"
  >
    <h4 v-clean-html="description"></h4>

    <h5
      v-if="editHelp"
      v-clean-html="editHelp"
      class="edit-help"
    />

    <div class="edit-change mt-20">
      <h5 v-t="'advancedSettings.edit.changeSetting'" />
      <button
        :disabled="!canReset"
        type="button"
        class="btn role-primary"
        @click="useDefault"
      >
        {{ t('advancedSettings.edit.useDefault') }}
      </button>
    </div>

    <div class="mt-20">
      <div v-if="setting.from === 'import'">
        <component
          :is="customComponent"
          v-if="hasCustomComponent"
          ref="settingComp"
          v-model:value="value"
          :register-before-hook="registerBeforeHook"
          :mode="mode"
        />
      </div>
      <div v-else-if="setting.kind === 'enum'">
        <LabeledSelect
          v-model:value="value.value"
          :label="t('advancedSettings.edit.value')"
          :localized-label="true"
          :mode="mode"
          :options="enumOptions"
        />
      </div>
      <div v-else-if="setting.kind === 'boolean'">
        <RadioGroup
          v-model:value="value.value"
          name="settings_value"
          :labels="[
            t('advancedSettings.edit.trueOption'),
            t('advancedSettings.edit.falseOption')
          ]"
          :options="['true', 'false']"
        />
      </div>
      <div v-else-if="setting.kind === 'multiline' || setting.kind === 'json'">
        <TextAreaAutoGrow
          v-model:value="value.value"
          :min-height="254"
        />
      </div>
      <div v-else-if="setting.kind === 'number'">
        <LabeledInput
          v-model:value="value.value"
          :label="t('advancedSettings.edit.value')"
          type="number"
        />
      </div>
      <div v-else>
        <LabeledInput
          v-model:value="value.value"
          :label="t('advancedSettings.edit.value')"
        />
      </div>
    </div>
  </CruResource>
</template>

<style lang="scss" scoped>
.edit-change {
  align-items: center;
  display: flex;

  > h5 {
    flex: 1;
  }
}

:deep() .edit-help code {
  padding: 1px 5px;
}
</style>
