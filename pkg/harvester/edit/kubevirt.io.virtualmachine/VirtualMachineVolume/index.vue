<script>
import { VueDraggableNext } from 'vue-draggable-next';
import InfoBox from '@shell/components/InfoBox';
import { Banner } from '@components/Banner';
import BadgeStateFormatter from '@shell/components/formatter/BadgeStateFormatter';
import UnitInput from '@shell/components/form/UnitInput';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import ModalWithCard from '@shell/components/ModalWithCard';
import { PVC, STORAGE_CLASS } from '@shell/config/types';
import { clone } from '@shell/utils/object';
import { ucFirst, randomStr } from '@shell/utils/string';
import { removeObject } from '@shell/utils/array';
import { _VIEW, _EDIT, _CREATE } from '@shell/config/query-params';
import { PLUGIN_DEVELOPER, DEV } from '@shell/store/prefs';
import { SOURCE_TYPE } from '../../../config/harvester-map';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../../config/harvester';
import { HCI } from '../../../types';
import { VOLUME_MODE } from '@pkg/harvester/config/types';
import { OFF } from '../../../models/kubevirt.io.virtualmachine';

export default {
  emits: ['update:value'],

  components: {
    Banner, BadgeStateFormatter, VueDraggableNext, InfoBox, LabeledInput, UnitInput, LabeledSelect, ModalWithCard
  },

  props: {
    vm: {
      type:    Object,
      default: () => {
        return {};
      }
    },

    mode: {
      type:    String,
      default: _CREATE
    },

    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    namespace: {
      type:    String,
      default: null
    },

    existingVolumeDisabled: {
      type:    Boolean,
      default: false
    },

    validateRequired: {
      type:    Boolean,
      default: false
    },

    customVolumeMode: {
      type:    String,
      default: VOLUME_MODE.Block
    },

    customAccessMode: {
      type:    String,
      default: 'ReadWriteMany'
    },

    resourceType: {
      type:    String,
      default: ''
    }
  },

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: PVC });
  },

  data() {
    return {
      ucFirst,
      SOURCE_TYPE,
      rows:    clone(this.value),
      nameIdx: 1,
      vol:     null,
      isOpen:  false
    };
  },

  computed: {
    dev() {
      try {
        return this.$store.getters['prefs/get'](PLUGIN_DEVELOPER);
      } catch {
        return this.$store.getters['prefs/get'](DEV);
      }
    },

    isVirtualType() {
      return this.resourceType === HCI.VM;
    },

    isView() {
      return this.mode === _VIEW;
    },

    isEdit() {
      return this.mode === _EDIT;
    },

    isCreate() {
      return this.mode === _CREATE;
    },

    defaultStorageClass() {
      const defaultStorage = this.$store.getters['harvester/all'](STORAGE_CLASS).find((sc) => sc.isDefault);

      return defaultStorage;
    },

    showVolumeTip() {
      const imageName = this.getImageDisplayName(this.rows[0]?.image);

      if (this.rows.length === 1 && this.rows[0].type === 'cd-rom' && /.iso$/i.test(imageName)) {
        return true;
      }

      return false;
    },

    pvcs() {
      return this.$store.getters['harvester/all'](PVC) || [];
    },
  },

  watch: {
    value: {
      handler(neu) {
        const rows = clone(neu).map((V) => {
          if (!this.isCreate && V.source !== SOURCE_TYPE.CONTAINER && !V.newCreateId) {
            V.to = {
              name:   `${ HARVESTER_PRODUCT }-c-cluster-resource-namespace-id`,
              params: {
                resource:  HCI.VOLUME,
                namespace: this.namespace,
                id:        V.realName
              },
              query: { mode: _EDIT }
            };

            V.pvc = this.pvcs.find((pvc) => pvc.metadata.name === V.realName);
          }

          return V;
        });

        this['rows'] = rows;
      },
      deep:      true,
      immediate: true,
    },
  },

  methods: {
    addVolume(type) {
      const name = this.generateName();
      const neu = {
        id:          randomStr(5),
        name,
        source:      type,
        size:        '10Gi',
        type:        'disk',
        accessMode:  this.customAccessMode,
        volumeMode:  this.customVolumeMode,
        volumeName:  '',
        bus:         'virtio',
        newCreateId: randomStr(10), // judge whether it is a disk that has been created
      };

      if (type === SOURCE_TYPE.NEW) {
        neu.storageClassName = this.defaultStorageClass?.metadata?.name || 'longhorn';
      }

      this.rows.push(neu);
      this.update();
    },

    generateName() {
      let name = '';
      let hasName = true;

      while (hasName) {
        name = `disk-${ this.nameIdx }`;
        hasName = this.rows.find((O) => O.name === name);
        this.nameIdx++;
      }

      return name;
    },

    removeVolume(vol) {
      this.vol = vol;
      if (!vol.newCreateId && this.isEdit && this.isVirtualType) {
        this.isOpen = true;
      } else {
        removeObject(this.rows, vol);
        this.update();
      }
    },

    unplugVolume(volume) {
      this.vm.unplugVolume(volume.name);
    },

    componentFor(type) {
      switch (type) {
      case SOURCE_TYPE.NEW:
        return require(`./type/volume.vue`).default;
      case SOURCE_TYPE.IMAGE:
        return require(`./type/vmImage.vue`).default;
      case SOURCE_TYPE.ATTACH_VOLUME:
        return require(`./type/existing.vue`).default;
      case SOURCE_TYPE.CONTAINER:
        return require(`./type/container.vue`).default;
      }
    },

    headerFor(type, hasVolBackups = false) {
      const mainHeader = {
        [SOURCE_TYPE.NEW]:           this.$store.getters['i18n/t']('harvester.virtualMachine.volume.title.volume'),
        [SOURCE_TYPE.IMAGE]:         this.$store.getters['i18n/t']('harvester.virtualMachine.volume.title.vmImage'),
        [SOURCE_TYPE.ATTACH_VOLUME]: this.$store.getters['i18n/t']('harvester.virtualMachine.volume.title.existingVolume'),
        [SOURCE_TYPE.CONTAINER]:     this.$store.getters['i18n/t']('harvester.virtualMachine.volume.title.container'),
      }[type];

      return hasVolBackups ? `${ mainHeader } and Backups` : mainHeader;
    },

    update() {
      this.$emit('update:value', this.rows);
    },

    deleteVolume() {
      removeObject(this.rows, this.vol);
      this.update();
      this.cancel();
    },

    cancel() {
      this.isOpen = false;
    },

    changeSort(idx, type) {
      // true: down, false: up
      this.rows.splice(type ? idx : idx - 1, 1, ...this.rows.splice(type ? idx + 1 : idx, 1, this.rows[type ? idx : idx - 1]));
      this.update();
    },

    getImageDisplayName(id) {
      return this.$store.getters['harvester/all'](HCI.IMAGE).find((image) => image.id === id)?.spec?.displayName;
    },

    isLonghornV2(volume) {
      return volume?.pvc?.isLonghornV2 || volume?.pvc?.storageClass?.isLonghornV2;
    },

    isResizeDisabled(volume) {
      if (this.isCreate) return false;
      if (volume.newCreateId) return false;

      const isStopped = this.vm.stateDisplay === OFF;
      const isLonghornV2 = this.isLonghornV2(volume);

      return !isStopped || isLonghornV2;
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-if="!isView"
      color="info"
      label-key="harvester.virtualMachine.volume.dragTip"
    />
    <VueDraggableNext
      :list="rows"
      :disabled="isView"
      item-key="id"
      @end="update"
    >
      <div
        v-for="(volume, i) in rows"
        :key="volume.id"
      >
        <InfoBox class="box">
          <button
            v-if="!isView"
            type="button"
            class="role-link btn btn-sm remove"
            @click="removeVolume(volume)"
          >
            <i class="icon icon-x" />
          </button>
          <button
            v-if="volume.hotpluggable && isView"
            type="button"
            class="role-link btn remove"
            @click="unplugVolume(volume)"
          >
            {{ t('harvester.virtualMachine.unplug.detachVolume') }}
          </button>
          <h3>
            <span
              v-if="volume.to && isVirtualType"
              class="title"
            >
              <router-link :to="volume.to">
                {{ t('harvester.virtualMachine.volume.edit') }} {{ headerFor(volume.source) }}
              </router-link>

              <BadgeStateFormatter
                v-if="volume.pvc"
                class="ml-10 state"
                :arbitrary="true"
                :row="volume.pvc"
                :value="volume.pvc.state"
              />
              <a
                v-if="dev && !!volume.pvc && !!volume.pvc.resourceExternalLink"
                v-clean-tooltip="t(volume.pvc.resourceExternalLink.tipsKey || 'generic.resourceExternalLinkTips')"
                class="ml-5 resource-external"
                rel="nofollow noopener noreferrer"
                target="_blank"
                :href="volume.pvc.resourceExternalLink.url"
              >
                <i class="icon icon-external-link" />
              </a>
            </span>

            <span v-else>
              {{ headerFor(volume.source, !!volume?.volumeBackups) }}
            </span>
          </h3>
          <div>
            <component
              :is="componentFor(volume.source)"
              :value="rows[i]"
              :rows="rows"
              :namespace="namespace"
              :is-create="isCreate"
              :is-edit="isEdit"
              :is-view="isView"
              :is-virtual-type="isVirtualType"
              :is-resize-disabled="isResizeDisabled(rows[i])"
              :mode="mode"
              :idx="i"
              :validate-required="validateRequired"
              @update="update"
            />
          </div>

          <div class="bootOrder">
            <div
              v-if="!isView"
              class="mr-15"
            >
              <button
                :disabled="i === 0"
                class="btn btn-sm role-primary"
                @click.prevent="changeSort(i, false)"
              >
                <i class="icon icon-lg icon-chevron-up"></i>
              </button>

              <button
                :disabled="i === rows.length -1"
                class="btn btn-sm role-primary"
                @click.prevent="changeSort(i, true)"
              >
                <i class="icon icon-lg icon-chevron-down"></i>
              </button>
            </div>

            <div class="text-muted">
              bootOrder: {{ i + 1 }}
            </div>
          </div>

          <div class="mt-15">
            <Banner
              v-if="volume.volumeStatus && !isCreate"
              class="volume-status"
              color="warning"
              :label="ucFirst(volume.volumeStatus)"
            />
            <Banner
              v-if="value.volumeBackups && value.volumeBackups.error && value.volumeBackups.error.message"
              color="error"
              :label="ucFirst(value.volumeBackups.error.message)"
            />
            <Banner
              v-if="isLonghornV2(volume) && !isView"
              color="warning"
              :label="t('harvester.volume.longhorn.disableResize')"
            />
          </div>
        </InfoBox>
      </div>
    </VueDraggableNext>
    <Banner
      v-if="showVolumeTip"
      color="warning"
      :label="t('harvester.virtualMachine.volume.volumeTip')"
    />

    <div v-if="!isView">
      <button
        type="button"
        class="btn btn-sm bg-primary mr-15 mb-10"
        :disabled="rows.length === 0"
        @click="addVolume(SOURCE_TYPE.NEW)"
      >
        {{ t('harvester.virtualMachine.volume.addVolume') }}
      </button>

      <button
        v-if="!existingVolumeDisabled"
        type="button"
        class="btn btn-sm bg-primary mr-15 mb-10"
        @click="addVolume(SOURCE_TYPE.ATTACH_VOLUME)"
      >
        {{ t('harvester.virtualMachine.volume.addExistingVolume') }}
      </button>

      <button
        type="button"
        class="btn btn-sm bg-primary mr-15 mb-10"
        @click="addVolume(SOURCE_TYPE.IMAGE)"
      >
        {{ t('harvester.virtualMachine.volume.addVmImage') }}
      </button>

      <button
        type="button"
        class="btn btn-sm bg-primary mb-10"
        @click="addVolume(SOURCE_TYPE.CONTAINER)"
      >
        {{ t('harvester.virtualMachine.volume.addContainer') }}
      </button>
    </div>

    <ModalWithCard
      v-if="isOpen"
      name="deleteTip"
      :width="400"
    >
      <template #title>
        {{ t('harvester.virtualMachine.volume.unmount.title') }}
      </template>

      <template #content>
        <span>{{ t('harvester.virtualMachine.volume.unmount.message') }}</span>
      </template>

      <template #footer>
        <div class="buttons">
          <button
            class="btn role-secondary mr-20"
            @click.prevent="cancel"
          >
            {{ t('generic.no') }}
          </button>

          <button
            class="btn bg-primary mr-20"
            @click.prevent="deleteVolume"
          >
            {{ t('generic.yes') }}
          </button>
        </div>
      </template>
    </ModalWithCard>
  </div>
</template>

<style lang='scss' scoped>
  .box {
    position: relative;
  }

  .title {
    display: flex;

    .state {
      font-size: 16px;
    }
  }

  .remove {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 0px;
  }

  .bootOrder {
    display: flex;
    align-items: center;
  }

  .buttons {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .volume-status:first-letter {
    text-transform: uppercase;
  }

  .resource-external {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .banner {
    margin: 10px 0;
  }
</style>
