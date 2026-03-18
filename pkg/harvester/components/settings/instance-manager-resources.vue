<script>
import UnitInput from '@shell/components/form/UnitInput';
import { Banner } from '@components/Banner';

export default {
  name: 'HarvesterInstanceManagerResources',

  components: {
    UnitInput,
    Banner,
  },

  props: {
    value: {
      type:    Object,
      default: () => ({
        value:   '',
        default: '{}'
      })
    },
  },

  data() {
    const resources = this.parseJSON(this.value?.value) || this.parseJSON(this.value?.default) || {};

    return {
      resources,
      parseError: null,
    };
  },

  methods: {
    parseJSON(string) {
      try {
        return JSON.parse(string);
      } catch (e) {
        this.parseError = this.t('harvester.setting.instanceManagerResources.parseError', { error: e.message });

        return null;
      }
    },

    update() {
      if (!this.value) return;

      const cpu = { ...this.resources?.cpu };

      if (cpu.v1 !== null) cpu.v1 = String(cpu.v1);
      if (cpu.v2 !== null) cpu.v2 = String(cpu.v2);

      this.value.value = JSON.stringify({ ...this.resources, cpu });
    },

    useDefault() {
      if (this.value?.default) {
        this.resources = this.parseJSON(this.value.default) || {};
        this.update();
      }
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-if="parseError"
      color="error"
    >
      {{ parseError }}
    </Banner>

    <div class="row">
      <div class="col span-12">
        <UnitInput
          v-model:value="resources.cpu.v1"
          :label="t('harvester.setting.instanceManagerResources.v1')"
          suffix="%"
          :delay="0"
          type="number"
          min="0"
          max="100"
          required
          :mode="mode"
          class="mb-20"
          @update:value="update"
        />
        <UnitInput
          v-model:value="resources.cpu.v2"
          :label="t('harvester.setting.instanceManagerResources.v2')"
          suffix="%"
          :delay="0"
          type="number"
          min="0"
          max="100"
          required
          :mode="mode"
          class="mb-20"
          @update:value="update"
        />
      </div>
    </div>
  </div>
</template>
