<script>
import { LabeledInput } from '@components/Form/LabeledInput';
import { RadioGroup } from '@components/Form/Radio';
import UnitInput from '@shell/components/form/UnitInput';
import { MEBIBYTE } from '../../utils/unit';
import { Banner } from '@components/Banner';

export default {
  name: 'KubevirtMigration',

  components: {
    LabeledInput,
    UnitInput,
    RadioGroup,
    Banner
  },

  props: {
    registerBeforeHook: {
      type:     Function,
      required: true
    },
    value: {
      type:    Object,
      default: () => ({
        value:   '',
        default: '{}'
      })
    },
  },

  data() {
    const migration = this.parseJSON(this.value?.value) || this.parseJSON(this.value?.default) || {};

    return {
      MEBIBYTE,
      migration,
      parseError: null,
    };
  },

  created() {
    this.registerBeforeHook?.(this.willSave, 'willSave');
  },

  methods: {
    parseJSON(string) {
      try {
        return JSON.parse(string);
      } catch (e) {
        this.parseError = this.t('kubevirtMigration.parseError', { error: e.message });
        // eslint-disable-next-line no-console
        console.error('Failed to parse JSON:', e.message);

        return null;
      }
    },

    updateValue() {
      if (this.value) {
        this.value.value = JSON.stringify(this.migration);
      }
    },

    useDefault() {
      if (this.value?.default) {
        const defaultMigration = this.parseJSON(this.value.default) || {};

        this.migration = defaultMigration;
        this.updateValue();
      }
    },

    async willSave() {
      this.updateValue();

      return Promise.resolve();
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

    <div class="migration-field">
      <LabeledInput
        v-model:value.number="migration.parallelMigrationsPerCluster"
        :label="t('harvester.setting.kubevirtMigration.parallelMigrationsPerCluster')"
        type="number"
        min="1"
      />
      <LabeledInput
        v-model:value.number="migration.parallelOutboundMigrationsPerNode"
        :label="t('harvester.setting.kubevirtMigration.parallelOutboundMigrationsPerNode')"
        type="number"
        min="1"
      />
      <UnitInput
        v-model:value="migration.bandwidthPerMigration"
        min="0"
        :label="t('harvester.setting.kubevirtMigration.bandwidthPerMigration')"
        :mode="mode"
        :suffix="MEBIBYTE"
        :tooltip="t('harvester.setting.kubevirtMigration.bandwidthPerMigrationTooltip', _, true)"
      />
      <UnitInput
        v-model:value="migration.completionTimeoutPerGiB"
        :label="t('harvester.setting.kubevirtMigration.completionTimeoutPerGiB')"
        :mode="mode"
        :suffix="migration.completionTimeoutPerGiB === 1 ? 'Second' : 'Seconds'"
        min="10"
      />
      <UnitInput
        v-model:value="migration.progressTimeout"
        :label="t('harvester.setting.kubevirtMigration.progressTimeout')"
        :mode="mode"
        :suffix="migration.progressTimeout === 1 ? 'Second' : 'Seconds'"
        min="10"
      />
      <div
        v-for="field in ['allowAutoConverge','allowPostCopy','unsafeMigrationOverride','allowWorkloadDisruption','disableTLS','matchSELinuxLevelOnMigration']"
        :key="field"
      >
        <label
          class="mb-5"
          :for="field"
        >{{ t(`harvester.setting.kubevirtMigration.${field}`) }}</label>
        <RadioGroup
          :id="field"
          v-model:value="migration[field]"
          :options="[
            { label: t('advancedSettings.edit.trueOption'), value: true },
            { label: t('advancedSettings.edit.falseOption'), value: false },
          ]"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.migration-field {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
