<script>
import { mapGetters } from 'vuex';
import { Banner } from '@components/Banner';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { CONFIG_MAP, SECRET, SERVICE_ACCOUNT } from '@shell/config/types';

const MAX_FILESYSTEMS = 3;

const FS_TYPE_CONFIGMAP = 'configmap';
const FS_TYPE_SECRET = 'secret';
const FS_TYPE_SERVICEACCOUNT = 'serviceaccount';

const DEFAULT_VOLUME_NAMES = {
  [FS_TYPE_CONFIGMAP]:      'configfs',
  [FS_TYPE_SECRET]:         'secretfs',
  [FS_TYPE_SERVICEACCOUNT]: 'serviceaccountfs',
};

const FS_TYPE_OPTIONS = [
  { label: 'ConfigMap', value: FS_TYPE_CONFIGMAP },
  { label: 'Secret', value: FS_TYPE_SECRET },
  { label: 'ServiceAccount', value: FS_TYPE_SERVICEACCOUNT },
];

function emptyRow() {
  return {
    fsType:       FS_TYPE_CONFIGMAP,
    volumeName:   DEFAULT_VOLUME_NAMES[FS_TYPE_CONFIGMAP],
    resourceName: '',
  };
}

export default {
  name: 'VirtualMachineFilesystem',

  components: {
    Banner,
    LabeledSelect,
    LabeledInput,
  },

  props: {
    mode: {
      type:    String,
      default: 'create',
    },
    namespace: {
      type:    String,
      default: '',
    },
  },

  data() {
    return { rows: [emptyRow()] };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    inStore() {
      return this.$store.getters['currentProduct'].inStore;
    },

    configMaps() {
      return this.$store.getters[`${ this.inStore }/all`](CONFIG_MAP)
        .filter((cm) => !this.namespace || cm.metadata.namespace === this.namespace)
        .map((cm) => ({ label: cm.metadata.name, value: cm.metadata.name }));
    },

    secrets() {
      return this.$store.getters[`${ this.inStore }/all`](SECRET)
        .filter((s) => !this.namespace || s.metadata.namespace === this.namespace)
        .map((s) => ({ label: s.metadata.name, value: s.metadata.name }));
    },

    serviceAccounts() {
      return this.$store.getters[`${ this.inStore }/all`](SERVICE_ACCOUNT)
        .filter((sa) => !this.namespace || sa.metadata.namespace === this.namespace)
        .map((sa) => ({ label: sa.metadata.name, value: sa.metadata.name }));
    },

    canAddRow() {
      return this.rows.length < MAX_FILESYSTEMS;
    },

    isView() {
      return this.mode === 'view';
    },

    completedRows() {
      return this.rows.filter((r) => r.fsType && r.volumeName && r.resourceName);
    },
  },

  methods: {
    fsTypeOptions() {
      return FS_TYPE_OPTIONS;
    },

    resourceOptions(fsType) {
      if (fsType === FS_TYPE_CONFIGMAP) return this.configMaps;
      if (fsType === FS_TYPE_SECRET) return this.secrets;
      if (fsType === FS_TYPE_SERVICEACCOUNT) return this.serviceAccounts;

      return [];
    },

    onFsTypeChange(row, newType) {
      row.fsType = newType;
      row.volumeName = DEFAULT_VOLUME_NAMES[newType] || '';
      row.resourceName = '';
    },

    addRow() {
      if (this.canAddRow) {
        this.rows.push(emptyRow());
      }
    },

    removeRow(index) {
      this.rows.splice(index, 1);
    },

    mountCommands(row) {
      const vol = row.volumeName || '<volume-name>';

      return `- mkdir -p /mnt/${ vol }\n- mount -t virtiofs ${ vol } /mnt/${ vol }`;
    },
  },
};
</script>

<template>
  <div class="vm-filesystem">
    <p class="mb-20">
      {{ t('harvester.virtualMachine.filesystem.description') }}
    </p>

    <div
      v-for="(row, index) in rows"
      :key="index"
      class="filesystem-row mb-15"
    >
      <div class="row">
        <div class="col span-3">
          <LabeledSelect
            :value="row.fsType"
            :label="t('harvester.virtualMachine.filesystem.type')"
            :options="fsTypeOptions()"
            :mode="mode"
            @update:value="onFsTypeChange(row, $event)"
          />
        </div>

        <div class="col span-3">
          <LabeledInput
            v-model:value="row.volumeName"
            :label="t('harvester.virtualMachine.filesystem.volume')"
            :mode="mode"
          />
        </div>

        <div class="col span-5">
          <LabeledSelect
            v-model:value="row.resourceName"
            :label="t('harvester.virtualMachine.filesystem.resource')"
            :options="resourceOptions(row.fsType)"
            :mode="mode"
          />
        </div>

        <div
          v-if="!isView"
          class="col span-1 remove-col"
        >
          <button
            type="button"
            class="btn role-link remove-btn"
            @click="removeRow(index)"
          >
            {{ t('generic.remove') }}
          </button>
        </div>
      </div>

      <Banner
        v-if="row.fsType && row.volumeName && row.resourceName"
        color="warning"
        class="mt-10"
      >
        <p>{{ t('harvester.virtualMachine.filesystem.mountBannerHint') }}</p>
        <pre class="mt-5 mb-0">- mkdir -p /mnt/{{ row.volumeName }}
- mount -t virtiofs {{ row.volumeName }} /mnt/{{ row.volumeName }}</pre>
      </Banner>
    </div>

    <button
      v-if="!isView && canAddRow"
      type="button"
      class="btn role-tertiary add"
      @click="addRow"
    >
      {{ t('harvester.virtualMachine.filesystem.add') }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.vm-filesystem {
  padding: 10px 0;
}

.filesystem-row {
  border-bottom: 1px solid var(--border);
  padding-bottom: 15px;
}

.remove-col {
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn {
  padding: 0;
}
</style>
