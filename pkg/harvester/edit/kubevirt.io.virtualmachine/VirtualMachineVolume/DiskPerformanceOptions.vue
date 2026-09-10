<script>
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Checkbox } from '@components/Form/Checkbox';
import { Banner } from '@components/Banner';
import { _VIEW } from '@shell/config/query-params';
import { DISK_CACHE_MODE, DISK_IO_MODE, DISK_PERFORMANCE_PROFILE } from '../../../config/harvester-map';

const { DEFAULT, HIGH, CUSTOM } = DISK_PERFORMANCE_PROFILE;

export default {
  name: 'DiskPerformanceOptions',

  components: {
    LabeledSelect, Checkbox, Banner
  },

  emits: ['update'],

  props: {
    // The disk row. This component reads/writes value.cache, value.io,
    // value.dedicatedIOThread and (for the "High Performance" preset) value.bus.
    value: {
      type:    Object,
      default: () => ({})
    },

    mode: {
      type:    String,
      default: 'create'
    },
  },

  data() {
    const hasPerf = !!(this.value.cache || this.value.io || this.value.dedicatedIOThread);

    return {
      DISK_PERFORMANCE_PROFILE,
      expanded: hasPerf,
      profile:  this.detectProfile(),
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    storagePerformanceEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('highPerformanceStorage');
    },

    isCdRom() {
      return this.value.type === 'cd-rom';
    },

    isCustom() {
      return this.profile === CUSTOM;
    },

    isNativeIo() {
      return this.value.io === 'native';
    },

    profileOptions() {
      return [DEFAULT, HIGH, CUSTOM].map((value) => ({
        label: this.t(`harvester.virtualMachine.volume.performance.profile.${ value }`),
        value,
      }));
    },

    cacheOptions() {
      return DISK_CACHE_MODE.map((value) => ({
        label:    this.cacheLabel(value),
        value,
        // Native AIO only works with an uncached (O_DIRECT) disk, so while it is
        // selected the only valid cache option is "none" — disable everything
        // else, including "Default", to prevent an invalid combination.
        disabled: this.isNativeIo && value !== 'none',
      }));
    },

    ioOptions() {
      return DISK_IO_MODE.map((value) => ({
        label: value === '' ? this.t('harvester.virtualMachine.volume.performance.ioMode.default') : this.t(`harvester.virtualMachine.volume.performance.ioMode.${ value }`),
        value,
      }));
    },

    showFilesystemCacheWarning() {
      return this.value.cache === 'none' && this.value.volumeMode === 'Filesystem';
    },

    showBusTip() {
      const hasPerf = !!(this.value.cache || this.value.io || this.value.dedicatedIOThread);

      return hasPerf && this.value.bus && this.value.bus !== 'virtio';
    },
  },

  watch: {
    // Keep the profile selector in sync if the row is repopulated (e.g. editing an existing VM).
    'value.cache'() {
      this.profile = this.detectProfile();
    },
    'value.io'() {
      this.profile = this.detectProfile();
    },
    'value.dedicatedIOThread'() {
      this.profile = this.detectProfile();
    },
  },

  methods: {
    detectProfile() {
      const { cache, io, dedicatedIOThread } = this.value;

      if (!cache && !io && !dedicatedIOThread) {
        return DEFAULT;
      }

      if (cache === 'none' && io === 'native' && dedicatedIOThread) {
        return HIGH;
      }

      return CUSTOM;
    },

    cacheLabel(value) {
      if (value === '') {
        return this.t('harvester.virtualMachine.volume.performance.cacheMode.default');
      }

      return this.t(`harvester.virtualMachine.volume.performance.cacheMode.${ value }`);
    },

    onProfileChange(profile) {
      this.profile = profile;

      if (profile === DEFAULT) {
        this.value.cache = '';
        this.value.io = '';
        this.value.dedicatedIOThread = false;
      } else if (profile === HIGH) {
        this.value.cache = 'none';
        this.value.io = 'native';
        this.value.dedicatedIOThread = true;
        this.value.bus = 'virtio';
      }
      // CUSTOM keeps whatever is currently set.

      this.update();
    },

    onIoChange(io) {
      this.value.io = io;
      // Native AIO requires an uncached disk; force cache to "none" to keep the
      // combo valid — including when cache is still on its "Default" ('') value,
      // which libvirt would otherwise reject at domain start.
      if (io === 'native' && this.value.cache !== 'none') {
        this.value.cache = 'none';
      }
      this.update();
    },

    update() {
      this.$emit('update');
    },
  },
};
</script>

<template>
  <div
    v-if="!isCdRom && storagePerformanceEnabled"
    class="disk-performance"
  >
    <button
      v-if="!isView"
      type="button"
      class="btn btn-sm role-link expand-toggle"
      :aria-expanded="expanded"
      :aria-label="expanded ? t('harvester.virtualMachine.volume.performance.collapse') : t('harvester.virtualMachine.volume.performance.expand')"
      @click.prevent="expanded = !expanded"
    >
      <i
        class="icon"
        :class="expanded ? 'icon-chevron-down' : 'icon-chevron-right'"
      />
      {{ t('harvester.virtualMachine.volume.performance.title') }}
    </button>

    <div
      v-if="expanded || isView"
      class="perf-body mt-10"
    >
      <div class="row mb-20">
        <div
          class="col span-6"
          data-testid="input-disk-perf-profile"
        >
          <LabeledSelect
            :value="profile"
            :label="t('harvester.virtualMachine.volume.performance.profile.label')"
            :tooltip="t('harvester.virtualMachine.volume.performance.profile.tip')"
            :options="profileOptions"
            :mode="mode"
            @update:value="onProfileChange"
          />
        </div>
      </div>

      <Banner
        v-if="profile === DISK_PERFORMANCE_PROFILE.HIGH"
        color="info"
        :label="t('harvester.virtualMachine.volume.performance.highProfileTip')"
      />

      <div
        v-if="isCustom || isView"
        class="row mb-20"
      >
        <div
          class="col span-6"
          data-testid="input-disk-cache"
        >
          <LabeledSelect
            v-model:value="value.cache"
            :label="t('harvester.virtualMachine.volume.performance.cacheMode.label')"
            :tooltip="t('harvester.virtualMachine.volume.performance.cacheMode.tip')"
            :options="cacheOptions"
            :mode="mode"
            @update:value="update"
          />
        </div>
        <div
          class="col span-6"
          data-testid="input-disk-io"
        >
          <LabeledSelect
            :value="value.io"
            :label="t('harvester.virtualMachine.volume.performance.ioMode.label')"
            :tooltip="t('harvester.virtualMachine.volume.performance.ioMode.tip')"
            :options="ioOptions"
            :mode="mode"
            @update:value="onIoChange"
          />
        </div>
      </div>

      <div
        v-if="isCustom || isView"
        class="row mb-10"
      >
        <div
          class="col span-12"
          data-testid="input-disk-dedicated-iothread"
        >
          <Checkbox
            v-model:value="value.dedicatedIOThread"
            :label="t('harvester.virtualMachine.volume.performance.dedicatedIOThread.label')"
            :tooltip="t('harvester.virtualMachine.volume.performance.dedicatedIOThread.tip')"
            :mode="mode"
            @update:value="update"
          />
        </div>
      </div>

      <Banner
        v-if="isNativeIo"
        color="info"
        :label="t('harvester.virtualMachine.volume.performance.ioMode.nativeRequiresNoCacheTip')"
      />
      <Banner
        v-if="showFilesystemCacheWarning"
        color="warning"
        :label="t('harvester.virtualMachine.volume.performance.cacheMode.filesystemWarning')"
      />
      <Banner
        v-if="showBusTip"
        color="warning"
        :label="t('harvester.virtualMachine.volume.performance.busTip')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.disk-performance {
  border-top: 1px solid var(--border);
  margin-top: 10px;
  padding-top: 10px;

  .expand-toggle {
    padding: 0;
    font-weight: 600;

    .icon {
      margin-right: 4px;
    }
  }
}
</style>
