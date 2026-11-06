<script>
import { Banner } from '@components/Banner';
import { Checkbox } from '@components/Form/Checkbox';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RcSection } from '@components/RcSection';
import { BACKUP_TYPE } from '../../config/types';

const ENGINES = [BACKUP_TYPE.RESTIC, BACKUP_TYPE.KOPIA];
const QUANTITY_FIELDS = ['memoryRequest', 'memoryLimit', 'ephemeralRequest', 'ephemeralLimit', 'cacheSize'];

// The backend fills omitted fields from the default, so show those values instead of empty inputs
function parseConfig(value, defaultValue) {
  const defaults = JSON.parse(defaultValue || '{}');
  const current = JSON.parse(value || '{}');

  return Object.fromEntries(ENGINES.map((engine) => [engine, { ...defaults[engine], ...current[engine] }]));
}

export default {
  name: 'ThirdPartyBackupConfig',

  components: {
    Banner,
    Checkbox,
    LabeledInput,
    RcSection,
  },

  props: {
    registerBeforeHook: {
      type:     Function,
      required: true
    },
    mode: {
      type:    String,
      default: 'edit'
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
    let config = Object.fromEntries(ENGINES.map((engine) => [engine, {}]));
    let parseError = null;

    try {
      config = parseConfig(this.value?.value, this.value?.default);
    } catch (e) {
      parseError = this.t('harvester.setting.thirdPartyBackupConfig.parseError', { error: e.message });
    }

    return {
      ENGINES,
      QUANTITY_FIELDS,
      RESTIC: BACKUP_TYPE.RESTIC,
      config,
      parseError,
    };
  },

  created() {
    this.registerBeforeHook?.(this.willSave, 'willSave');
  },

  methods: {
    updateValue() {
      if (this.value) {
        this.value.value = JSON.stringify(this.config);
      }
    },

    useDefault() {
      this.parseError = null;
      this.config = parseConfig('', this.value?.default);
      this.updateValue();
    },

    willSave() {
      this.updateValue();

      return Promise.resolve();
    },
  },
};
</script>

<template>
  <div data-testid="third-party-backup-config">
    <Banner
      v-if="parseError"
      color="error"
    >
      {{ parseError }}
    </Banner>

    <RcSection
      v-for="engine in ENGINES"
      :key="engine"
      background="secondary"
      class="mb-20"
      :data-testid="`${ engine }-section`"
      :expandable="false"
      mode="with-header"
      :title="t(`harvester.backup.type.${ engine }`)"
      type="secondary"
    >
      <div class="engine-fields">
        <LabeledInput
          v-for="field in QUANTITY_FIELDS"
          :key="field"
          v-model:value="config[engine][field]"
          :data-testid="`${ engine }-${ field }`"
          :disabled="field === 'cacheSize' && !!config[engine].noCache"
          :label="t(`harvester.setting.thirdPartyBackupConfig.${ field }`)"
          :mode="mode"
          :sub-label="field === 'cacheSize' ? t('harvester.setting.thirdPartyBackupConfig.cacheSizeHint') : ''"
        />
        <LabeledInput
          v-model:value.number="config[engine].maxConcurrentJobs"
          :data-testid="`${ engine }-maxConcurrentJobs`"
          :label="t('harvester.setting.thirdPartyBackupConfig.maxConcurrentJobs')"
          min="0"
          :mode="mode"
          :sub-label="t('harvester.setting.thirdPartyBackupConfig.maxConcurrentJobsHint')"
          type="number"
        />
      </div>

      <Checkbox
        v-if="engine === RESTIC"
        v-model:value="config[engine].noCache"
        :data-testid="`${ engine }-noCache`"
        :label="t('harvester.setting.thirdPartyBackupConfig.noCache')"
        :mode="mode"
      />
    </RcSection>
  </div>
</template>

<style lang="scss" scoped>
.engine-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  // The hints under the last row overflow the height of their inputs
  margin-bottom: 20px;
}
</style>
