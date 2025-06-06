<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import { Banner } from '@components/Banner';
import { LabeledInput } from '@components/Form/LabeledInput';

export default {
  name: 'HarvesterHttpProxy',

  components: { Banner, LabeledInput },

  mixins: [CreateEditView],

  data() {
    let parseDefaultValue = {};

    try {
      parseDefaultValue = JSON.parse(this.value.value);
    } catch (error) {
      parseDefaultValue = JSON.parse(this.value.default);
    }

    return {
      parseDefaultValue,
      errors: []
    };
  },

  created() {
    this.update();
  },

  methods: {
    update() {
      const value = JSON.stringify(this.parseDefaultValue);

      this.value['value'] = value;
    }
  },

  watch: {
    value: {
      handler(neu) {
        const parseDefaultValue = JSON.parse(neu.value);

        this['parseDefaultValue'] = parseDefaultValue;
      },
      deep: true
    }
  }
};
</script>

<template>
  <div>
    <Banner color="warning">
      <t
        k="harvester.setting.httpProxy.warning"
        :raw="true"
      />
    </Banner>

    <div
      class="row"
      @input="update"
    >
      <div class="col span-12">
        <LabeledInput
          v-model:value="parseDefaultValue.httpProxy"
          class="mb-20"
          :mode="mode"
          label="http-proxy"
        />

        <LabeledInput
          v-model:value="parseDefaultValue.httpsProxy"
          class="mb-20"
          :mode="mode"
          label="https-proxy"
        />

        <LabeledInput
          v-model:value="parseDefaultValue.noProxy"
          class="mb-20"
          :mode="mode"
          label="no-proxy"
        />
      </div>
    </div>
  </div>
</template>
