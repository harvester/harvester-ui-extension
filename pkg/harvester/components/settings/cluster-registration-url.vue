<script>
import Tip from '@shell/components/Tip';
import MessageLink from '@shell/components/MessageLink';
import CreateEditView from '@shell/mixins/create-edit-view';
import { LabeledInput } from '@components/Form/LabeledInput';
import { HCI_SETTING } from '../../config/settings';
import { Checkbox } from '@components/Form/Checkbox';

export default {
  name: 'HarvesterEditClusterRegistrationURL',

  components: {
    LabeledInput, Tip, MessageLink, Checkbox
  },

  mixins: [CreateEditView],

  data() {
    let parseDefaultValue = {};

    try {
      const tlsVerifyEnabled = this.$store.getters['harvester-common/getFeatureEnabled']('clusterRegistrationTLSVerify');

      parseDefaultValue = tlsVerifyEnabled ? JSON.parse(this.value.value) : this.value.value;
    } catch (error) {
      parseDefaultValue = this.getDefaultValue();
    }

    return {
      parseDefaultValue,
      errors: []
    };
  },

  computed: {
    toCA() {
      return `${ HCI_SETTING.ADDITIONAL_CA }?mode=edit`;
    },
    clusterRegistrationTLSVerifyEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('clusterRegistrationTLSVerify');
    },
    registrationURL: {
      get() {
        return this.clusterRegistrationTLSVerifyEnabled ? this.parseDefaultValue.url : this.parseDefaultValue;
      },

      set(value) {
        if (this.clusterRegistrationTLSVerifyEnabled) {
          this.parseDefaultValue.url = value;
        } else {
          this.parseDefaultValue = value;
        }
      }
    }
  },

  methods: {
    getDefaultValue() {
      if (this.clusterRegistrationTLSVerifyEnabled) {
        return { url: '', insecureSkipTLSVerify: false };
      } else {
        return '';
      }
    },

    updateUrl() {
      this.update();
    },

    update() {
      if (this.clusterRegistrationTLSVerifyEnabled) {
        this.value['value'] = JSON.stringify(this.parseDefaultValue);
      } else {
        this.value['value'] = this.parseDefaultValue;
      }
    },

    useDefault() {
      this.parseDefaultValue = this.getDefaultValue();
    },

    updateInsecureSkipTLSVerify(newValue) {
      const { url = '' } = this.parseDefaultValue;

      this.parseDefaultValue = { url, insecureSkipTLSVerify: newValue };
      this.update();
    },
  }
};
</script>

<template>
  <div
    class="row"
  >
    <div class="col span-12">
      <LabeledInput
        v-model:value="registrationURL"
        class="mb-20"
        :mode="mode"
        :label="t('harvester.setting.clusterRegistrationUrl.url')"
        @update:value="updateUrl"
      />
      <div v-if="clusterRegistrationTLSVerifyEnabled">
        <Checkbox
          v-model:value="parseDefaultValue.insecureSkipTLSVerify"
          class="check mb-5"
          type="checkbox"
          :label="t('harvester.setting.clusterRegistrationUrl.insecureSkipTLSVerify')"
          @update:value="updateInsecureSkipTLSVerify"
        />
        <Tip
          class="mb-20"
          icon="icon icon-info"
        >
          <MessageLink
            :to="toCA"
            target="_blank"
            prefix-label="harvester.setting.clusterRegistrationUrl.tip.prefix"
            middle-label="harvester.setting.clusterRegistrationUrl.tip.middle"
            suffix-label="harvester.setting.clusterRegistrationUrl.tip.suffix"
          />
        </Tip>
      </div>
    </div>
  </div>
</template>
