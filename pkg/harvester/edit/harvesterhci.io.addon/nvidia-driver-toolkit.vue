<script>
import merge from 'lodash/merge';
import jsyaml from 'js-yaml';
import { clone } from '@shell/utils/object';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { RadioGroup } from '@components/Form/Radio';
import { LabeledInput } from '@components/Form/LabeledInput';
import { Banner } from '@components/Banner';

import CreateEditView from '@shell/mixins/create-edit-view';

const DEFAULT_VALUE = { image: { repository: 'rancher/harvester-nvidia-driver-toolkit' } };

export default {
  name:       'EditAddonNvidiaDriverToolkit',
  components: {
    Banner,
    LabeledInput,
    RadioGroup,
    Tabbed,
    Tab,
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:     Object,
      required: true,
    },

    mode: {
      type:     String,
      required: true
    },
  },

  data() {
    return {
      initSpec:          clone(this.value.spec),
      valuesContentJson: this.parseValuesContent()
    };
  },

  watch: {
    valuesContentJson: {
      handler(neu) {
        this.update(neu);
      },
      deep: true,
    }
  },

  computed: {
    parsingSpecError() {
      return this.valuesContentJson && (this.valuesContentJson.image === undefined || this.valuesContentJson.driverLocation === undefined);
    }
  },

  methods: {
    parseValuesContent() {
      try {
        return merge({}, DEFAULT_VALUE, jsyaml.load(this.value.spec.valuesContent));
      } catch (err) {
        this.$store.dispatch('growl/fromError', {
          title: this.$store.getters['i18n/t']('generic.notification.title.error'),
          err:   err.data || err,
        }, { root: true });

        return DEFAULT_VALUE;
      }
    },

    toggleEnable(v) {
      this.resetSpec();
      this.value.spec.enabled = v;
    },

    resetSpec() {
      this.value.spec = clone(this.initSpec);

      this.valuesContentJson = this.parseValuesContent();
    },

    update(values) {
      this.value.spec.valuesContent = jsyaml.dump(values);
    }
  }
};
</script>

<template>
  <div>
    <Banner
      v-if="parsingSpecError"
      color="error"
      :label="t('harvester.addons.nvidiaDriverToolkit.parsingSpecError', null, { raw: true })"
    />
    <Tabbed
      v-else
      :side-tabs="true"
    >
      <Tab
        name="basic"
        :label="t('harvester.addons.nvidiaDriverToolkit.titles.basic')"
        :weight="1"
      >
        <RadioGroup
          :value="value.spec.enabled"
          class="mb-20"
          name="model"
          :mode="mode"
          :options="[true,false]"
          :labels="[t('generic.enabled'), t('generic.disabled')]"
          @update:value="toggleEnable"
        />
        <div v-if="value.spec.enabled">
          <div
            v-if="valuesContentJson.image"
            class="row mb-15"
          >
            <div class="col span-6">
              <LabeledInput
                v-model:value="valuesContentJson.image.repository"
                :mode="mode"
                :required="true"
                label-key="harvester.addons.nvidiaDriverToolkit.image.repository"
              />
            </div>
            <div class="col span-6">
              <LabeledInput
                v-model:value="valuesContentJson.image.tag"
                :mode="mode"
                :required="true"
                class="col span-6"
                label-key="harvester.addons.nvidiaDriverToolkit.image.tag"
              />
            </div>
          </div>
          <div class="row mb-15">
            <LabeledInput
              v-model:value="valuesContentJson.driverLocation"
              :mode="mode"
              :required="true"
              label-key="harvester.addons.nvidiaDriverToolkit.driver.location"
            />
          </div>
        </div>
      </Tab>
    </Tabbed>
  </div>
</template>

<style lang="scss" scoped>
  :deep() .radio-group {
    display: flex;
    .radio-container {
      margin-right: 30px;
    }
  }
</style>
