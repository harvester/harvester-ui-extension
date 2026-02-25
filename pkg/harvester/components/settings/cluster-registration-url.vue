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
      parseDefaultValue = JSON.parse(this.value.value);
    } catch (error) {
      parseDefaultValue = { url: '', insecureSkipTLSVerify: true };
    }

    return {
      parseDefaultValue,
      errors: []
    };
  },

  created() {
    this.update();
  },
  computed: {
    toCA() {
      return `${ HCI_SETTING.ADDITIONAL_CA }?mode=edit`;
    }
  },

  watch: {
    value: {
      handler(neu) {
        let parseDefaultValue;

        try {
          parseDefaultValue = JSON.parse(neu.value);
        } catch (err) {
          parseDefaultValue = { url: '', insecureSkipTLSVerify: true };
        }
        this.parseDefaultValue = parseDefaultValue;
        this.update();
      },
      deep: true
    }
  },

  methods: {
    update() {
      this.value['value'] = JSON.stringify(this.parseDefaultValue);
    },

    useDefault() {
      this.parseDefaultValue = { url: '', insecureSkipTLSVerify: true };
    }
  }
};
</script>

<template>
  <div
    class="row"
    @input="update"
  >
    <div class="col span-12">
      <LabeledInput
        v-model:value="parseDefaultValue.url"
        class="mb-20"
        :mode="mode"
        :label="t('harvester.setting.clusterRegistrationUrl.url')"
      />
      <Checkbox
        v-model:value="parseDefaultValue.insecureSkipTLSVerify"
        class="check mb-5"
        type="checkbox"
        :label="t('harvester.setting.clusterRegistrationUrl.insecureSkipTLSVerify')"
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
</template>

<style lang="scss" scoped>
// p {
//   display: flex;
//   align-items: center;
// }

</style>
