<script>
import { mapGetters } from 'vuex';
import { Banner } from '@components/Banner';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import { CONFIG_MAP, SECRET, SERVICE_ACCOUNT } from '@shell/config/types';
import { _VIEW } from '@shell/config/query-params';
import CopyToClipboard from '@shell/components/CopyToClipboard';
import MessageLink from '@shell/components/MessageLink';
import { FILESYSTEM_SOURCE_TYPE } from '@pkg/harvester/config/types';

const MAX_FILESYSTEMS = 3;

const { CONFIGMAP: FS_TYPE_CONFIGMAP, SECRET: FS_TYPE_SECRET, SERVICEACCOUNT: FS_TYPE_SERVICEACCOUNT } = FILESYSTEM_SOURCE_TYPE;

const DEFAULT_VOLUME_NAMES = {
  [FS_TYPE_CONFIGMAP]:      'appconfigfs',
  [FS_TYPE_SECRET]:         'appsecretfs',
  [FS_TYPE_SERVICEACCOUNT]: 'appserviceaccountfs',
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
    CopyToClipboard,
    MessageLink,
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
    value: {
      type:    Array,
      default: () => [],
    },
  },

  data() {
    return { rows: this.value.length > 0 ? this.value.map((r) => ({ ...r })) : [emptyRow()] };
  },

  watch: {
    value(newVal) {
      if (newVal && newVal.length > 0) {
        const incoming = JSON.stringify(newVal);
        const current = JSON.stringify(this.rows);

        if (incoming !== current) {
          this.rows = newVal.map((r) => ({ ...r }));
        }
      }
    },

    rows: {
      deep: true,
      handler(val) {
        this.$emit('update:value', val.map((r) => ({ ...r })));
      },
    },
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
      return this.mode === _VIEW;
    },

    completedRows() {
      return this.rows.filter((r) => r.fsType && r.volumeName && r.resourceName);
    },

    allMountCommands() {
      return this.completedRows.map((r) => this.mountCommands(r)).join('\n');
    },
  },

  methods: {
    fsTypeOptions(currentIndex) {
      const usedTypes = this.rows
        .filter((_, i) => i !== currentIndex)
        .map((r) => r.fsType);

      return FS_TYPE_OPTIONS.filter((opt) => !usedTypes.includes(opt.value));
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
        const usedTypes = this.rows.map((r) => r.fsType);
        const nextType = FS_TYPE_OPTIONS.find((opt) => !usedTypes.includes(opt.value))?.value || FS_TYPE_CONFIGMAP;

        this.rows.push({
          fsType:       nextType,
          volumeName:   DEFAULT_VOLUME_NAMES[nextType] || '',
          resourceName: '',
        });
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
            :options="fsTypeOptions(index)"
            :mode="mode"
            required
            @update:value="onFsTypeChange(row, $event)"
          />
        </div>

        <div class="col span-3">
          <LabeledInput
            v-model:value="row.volumeName"
            :label="t('harvester.virtualMachine.filesystem.volume')"
            :mode="mode"
            required
          />
        </div>

        <div class="col span-5">
          <LabeledSelect
            v-model:value="row.resourceName"
            :label="t('harvester.virtualMachine.filesystem.resource')"
            :options="resourceOptions(row.fsType)"
            :mode="mode"
            required
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
    </div>

    <Banner
      v-if="completedRows.length > 0"
      color="warning"
      class="mt-10"
    >
      <div>
        <MessageLink
          :to="{ hash: '#advanced' }"
          prefix-label="harvester.virtualMachine.filesystem.mountBannerHint"
          middle-label="harvester.virtualMachine.filesystem.mountBannerHintLink"
          suffix-label="harvester.virtualMachine.filesystem.mountBannerHintSuffix"
        />
        <div class="pre-wrapper mt-10">
          <pre class="mt-5 mb-0">{{ allMountCommands }}</pre>
          <CopyToClipboard
            :text="allMountCommands"
            :show-label="false"
            class="icon-btn"
            action-color="bg-transparent"
          />
        </div>
      </div>
    </Banner>

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

.pre-wrapper {
  position: relative;

  pre {
    padding-right: 36px;
  }

  .icon-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 2px 4px;
    line-height: 1;

    :deep(.btn.role-primary) {
      &:hover {
        background-color: rgba(0, 0, 0, 0.1);
      }
    }
  }
}
</style>
