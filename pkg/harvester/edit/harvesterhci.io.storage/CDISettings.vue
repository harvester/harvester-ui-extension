<script>
import { VOLUME_MODE } from '@pkg/harvester/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import ArrayList from '@shell/components/form/ArrayList';
import { Checkbox } from '@components/Form/Checkbox';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { VOLUME_SNAPSHOT_CLASS, HCI } from '../../types';
import { HCI_SETTING } from '../../config/settings';
import { allHash } from '@shell/utils/promise';
import { _EDIT, _CREATE } from '@shell/config/query-params';

export default {
  name: 'CDISettings',

  props: {
    value:    {
      type:     Object,
      required: true
    },
    mode:        {
      type:     String,
      required: true
    },
    provisioner: {
      type:     String,
      required: true
    },
  },

  components: {
    ArrayList,
    Checkbox,
    LabeledInput,
    LabeledSelect,
  },

  emits: ['update:cdiSettings'],

  async fetch() {
    const hash = {
      volumeSnapshotClasses:  this.$store.dispatch(`${ this.inStore }/findAll`, { type: VOLUME_SNAPSHOT_CLASS }),
      csiDriverConfigSetting: this.$store.dispatch(`${ this.inStore }/find`, { type: HCI.SETTING, id: HCI_SETTING.CSI_DRIVER_CONFIG }),
    };

    await allHash(hash);
  },

  data() {
    return {
      cdiSettings: {
        volumeModeAccessModes: [],
        volumeSnapshotClass:   null,
        cloneStrategy:         null,
        filesystemOverhead:    null,
      },
      defaultAddValue: { volumeMode: null, accessModes: [] },
      noneOption:      { label: 'None', value: '' },
    };
  },

  created() {
    if (this.mode === _CREATE ) {
      this.setDefaultVolumeSnapshotClass();
    } else {
      this.initCDISettingsFromAnnotations();
    }
  },

  computed: {
    inStore() {
      return this.$store.getters['currentProduct'].inStore;
    },

    allVolumeModeOptions() {
      return Object.values(VOLUME_MODE).map((mode) => ({ label: mode, value: mode }));
    },

    selectedVolumeModes() {
      return this.cdiSettings.volumeModeAccessModes
        .map((item) => item.volumeMode)
        .filter(Boolean);
    },

    volumeModeOptions() {
      return [this.noneOption, ...this.allVolumeModeOptions].filter( (option) => !this.selectedVolumeModes.includes(option.value) );
    },

    allVolumeModesSelected() {
      return this.selectedVolumeModes.length === this.allVolumeModeOptions.length;
    },

    accessModeOptions() {
      return [
        { label: 'ReadWriteOnce', value: 'ReadWriteOnce' },
        { label: 'ReadOnlyMany', value: 'ReadOnlyMany' },
        { label: 'ReadWriteMany', value: 'ReadWriteMany' },
        { label: 'ReadWriteOncePod', value: 'ReadWriteOncePod' },
      ];
    },

    cloneStrategyOptions() {
      return [
        this.noneOption,
        { label: this.t('harvester.storage.cdiSettings.cloneStrategy.copy'), value: 'copy' },
        { label: this.t('harvester.storage.cdiSettings.cloneStrategy.snapshot'), value: 'snapshot' },
        { label: this.t('harvester.storage.cdiSettings.cloneStrategy.csiClone'), value: 'csi-clone' },
      ];
    },

    volumeSnapshotClassOptions() {
      const allClasses = this.$store.getters[`${ this.inStore }/all`](VOLUME_SNAPSHOT_CLASS) || [];
      const filtered = allClasses.filter((c) => c.driver === this.provisioner);

      return [this.noneOption, ...filtered.map((c) => ({ label: c.name, value: c.name }))];
    },

    isFilesystemOverheadValid() {
      const val = this.cdiSettings.filesystemOverhead;

      if (val === null || val === '') return true;
      const regex = /^(0(\.\d{1,3})?|1(\.0{1,3})?)$/;

      return regex.test(val);
    },

    isCustomClass() {
      return this.mode === _CREATE || this.mode === _EDIT;
    }
  },

  watch: {
    provisioner() {
      this.resetCdiSettings();
      this.$nextTick(this.setDefaultVolumeSnapshotClass);
    },

    cdiSettings: {
      handler(val) {
        this.$emit('update:cdiSettings', val);
      },
      deep:      true,
      immediate: true,
    }
  },

  methods: {
    setDefaultVolumeSnapshotClass() {
      try {
        const setting = this.$store.getters[`${ this.inStore }/byId`](HCI.SETTING, HCI_SETTING.CSI_DRIVER_CONFIG);
        const config = JSON.parse(setting?.value || '{}');
        const defaultClass = config?.[this.provisioner]?.volumeSnapshotClassName || null;

        const allClasses = this.$store.getters[`${ this.inStore }/all`](VOLUME_SNAPSHOT_CLASS) || [];
        const matched = allClasses.find((cls) => cls.name === defaultClass && cls.driver === this.provisioner);

        this.cdiSettings.volumeSnapshotClass = matched?.name || null;
      } catch (e) {
        console.error('Failed to parse CSI config:', e); // eslint-disable-line no-console
        this.cdiSettings.volumeSnapshotClass = null;
      }
    },

    initCDISettingsFromAnnotations() {
      const annotations = this.value?.metadata?.annotations || {};

      let volumeModeAccessModes = [];
      const rawVolumeMode = annotations[HCI_ANNOTATIONS.VOLUME_MODE_ACCESS_MODES];

      if (rawVolumeMode) {
        try {
          const parsed = JSON.parse(rawVolumeMode);

          volumeModeAccessModes = Object.entries(parsed).map(([volumeMode, accessModes]) => ({
            volumeMode,
            accessModes: Array.isArray(accessModes) ? accessModes : [],
          }));
        } catch (e) {
          console.error('Failed to parse annotation:', e); // eslint-disable-line no-console
        }
      }

      if (volumeModeAccessModes.length) {
        this.cdiSettings.volumeModeAccessModes = volumeModeAccessModes;
      }
      if (annotations[HCI_ANNOTATIONS.VOLUME_SNAPSHOT_CLASS]) {
        this.cdiSettings.volumeSnapshotClass = annotations[HCI_ANNOTATIONS.VOLUME_SNAPSHOT_CLASS];
      }
      if (annotations[HCI_ANNOTATIONS.CLONE_STRATEGY]) {
        this.cdiSettings.cloneStrategy = annotations[HCI_ANNOTATIONS.CLONE_STRATEGY];
      }
      if (annotations[HCI_ANNOTATIONS.FILESYSTEM_OVERHEAD]) {
        this.cdiSettings.filesystemOverhead = annotations[HCI_ANNOTATIONS.FILESYSTEM_OVERHEAD];
      }
    },

    resetCdiSettings() {
      this.cdiSettings.volumeModeAccessModes = [this.defaultAddValue];
      this.cdiSettings.volumeSnapshotClass = null;
      this.cdiSettings.cloneStrategy = null;
      this.cdiSettings.filesystemOverhead = null;
    },

    validateFilesystemOverhead(e) {
      const val = e.target.value;

      this.cdiSettings.filesystemOverhead = val;
    }
  }
};
</script>

<template>
  <ArrayList
    v-model:value="cdiSettings.volumeModeAccessModes"
    :initial-empty-row="true"
    :show-header="true"
    :mode="mode"
    :title="t('harvester.storage.cdiSettings.volumeModeAccessModes.label')"
    :add-label="t('harvester.storage.cdiSettings.volumeModeAccessModes.add')"
    :default-add-value="defaultAddValue"
    :protip="t('harvester.storage.cdiSettings.volumeModeAccessModes.tooltip')"
    :add-disabled="allVolumeModesSelected"
  >
    <template #column-headers>
      <div class="column-headers">
        <div
          class="row"
          :class="{ custom: isCustomClass }"
        >
          <label
            class="col span-3 value text-label mb-10"
            for="volumeMode"
          >
            {{ t('harvester.storage.cdiSettings.volumeModeAccessModes.volumeMode') }}
          </label>
          <label
            class="col span-9 value text-label mb-10"
            for="accessModes"
          >
            {{ t('harvester.storage.cdiSettings.volumeModeAccessModes.accessModes.label') }}
          </label>
        </div>
      </div>
    </template>

    <template #columns="{ row }">
      <div class="row">
        <div class="col span-3">
          <LabeledSelect
            id="volumeMode"
            v-model:value="row.value.volumeMode"
            :mode="mode"
            :options="volumeModeOptions"
          />
        </div>
        <div
          id="accessModes"
          class="col span-9"
        >
          <Checkbox
            v-for="opt in accessModeOptions"
            :key="opt.value"
            v-model:value="row.value.accessModes"
            :value-when-true="opt.value"
            :label="opt.label"
            type="checkbox"
            :mode="mode"
          />
        </div>
      </div>
    </template>
  </ArrayList>

  <LabeledSelect
    v-model:value="cdiSettings.volumeSnapshotClass"
    class="select mt-20 mb-20"
    :label="t('harvester.storage.cdiSettings.volumeSnapshotClass.label')"
    :tooltip="t('harvester.storage.cdiSettings.volumeSnapshotClass.tooltip')"
    :mode="mode"
    :options="volumeSnapshotClassOptions"
  />

  <LabeledSelect
    v-model:value="cdiSettings.cloneStrategy"
    class="select mb-20"
    :label="t('harvester.storage.cdiSettings.cloneStrategy.label')"
    :tooltip="t('harvester.storage.cdiSettings.cloneStrategy.tooltip')"
    :mode="mode"
    :options="cloneStrategyOptions"
  />

  <LabeledInput
    v-model:value="cdiSettings.filesystemOverhead"
    class="select mb-20"
    :label="t('harvester.storage.cdiSettings.fileSystemOverhead.label')"
    :tooltip="t('harvester.storage.cdiSettings.fileSystemOverhead.tooltip')"
    :mode="mode"
    type="number"
    :min="0"
    :max="1"
    :step="0.001"
    :placeholder="t('harvester.storage.cdiSettings.fileSystemOverhead.placeholder')"
    :status="isFilesystemOverheadValid ? null : 'error'"
    @input="validateFilesystemOverhead"
  />
</template>

<style scoped lang="scss">
  .column-headers .row.custom {
    max-width: calc(100% - 75px);
  }

  .row {
    align-items: center;
  }

  .select {
    max-width: 480px;
  }
</style>
