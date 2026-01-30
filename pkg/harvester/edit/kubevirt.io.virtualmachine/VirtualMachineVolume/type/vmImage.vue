<script>
import { findBy } from '@shell/utils/array';
import UnitInput from '@shell/components/form/UnitInput';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import InputOrDisplay from '@shell/components/InputOrDisplay';
import { Banner } from '@components/Banner';
import { PVC } from '@shell/config/types';
import { formatSi, parseSi } from '@shell/utils/units';
import { HCI } from '../../../../types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { VOLUME_TYPE, InterfaceOption } from '../../../../config/harvester-map';
import { _VIEW } from '@shell/config/query-params';
import LabelValue from '@shell/components/LabelValue';
import { ucFirst } from '@shell/utils/string';
import { GIBIBYTE } from '../../../../utils/unit';
import { EMPTY_IMAGE } from '../../../../utils/vm';

export default {
  name: 'HarvesterEditVMImage',

  emits: ['update'],

  components: {
    UnitInput, LabeledInput, LabeledSelect, InputOrDisplay, LabelValue, Banner
  },

  props: {
    value: {
      type:    Object,
      default: () => {
        return {};
      }
    },

    namespace: {
      type:    String,
      default: null
    },

    mode: {
      type:    String,
      default: 'create'
    },

    idx: {
      type:     Number,
      required: true
    },

    isCreate: {
      type:    Boolean,
      default: true
    },
    isEdit: {
      type:    Boolean,
      default: false
    },

    validateRequired: {
      type:     Boolean,
      required: true
    },

    isVirtualType: {
      type:    Boolean,
      default: true
    },

    isResizeDisabled: {
      type:    Boolean,
      default: false
    },
  },

  data() {
    return {
      GIBIBYTE,
      VOLUME_TYPE,
      HCI_ANNOTATIONS,
      InterfaceOption,
      loading: false,
      images:  [],
    };
  },

  fetch() {
    this.images = this.$store.getters['harvester/all'](HCI.IMAGE);
  },

  computed: {
    encryptionValue() {
      return ucFirst(String(this.value.isEncrypted));
    },

    isView() {
      return this.mode === _VIEW;
    },

    isExistingCdrom() {
      return this.value.type === 'cd-rom' && !this.value.newCreateId;
    },

    isEmptyImage() {
      return this.value.image === EMPTY_IMAGE;
    },

    imagesOption() {
      const images = this.images
        .filter((image) => {
          if (!image.isReady) return false;

          // exclude internal images created during upgrade
          const isInternalCreatedImage =
            image.namespace === 'harvester-system' &&
            image.labels?.[HCI_ANNOTATIONS.UPGRADE];

          return !isInternalCreatedImage;
        })
        .sort((a, b) => (a.creationTimestamp > b.creationTimestamp ? -1 : 1))
        .map((image) => ({
          label:    this.imageOptionLabel(image),
          value:    image.id,
          disabled: image.isImportedImage
        }));

      return [
        {
          label:    this.t('harvester.virtualMachine.volume.emptyImage'),
          value:    EMPTY_IMAGE,
          disabled: false
        },
        ...images
      ];
    },

    imageName() {
      const image = this.imagesOption.find((I) => I.value === this.value.image);

      return image ? image.label : '-';
    },

    readyToUse() {
      const val = String(this.value.volumeBackups?.readyToUse || false);

      return ucFirst(val);
    },

    pvcsResource() {
      const allPVCs = this.$store.getters['harvester/all'](PVC) || [];

      return allPVCs.find((P) => {
        return this.namespace ? P.id === `${ this.namespace }/${ this.value.volumeName }` : true;
      });
    },

    thirdPartyStorageEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('thirdPartyStorage');
    },

    selectedImage() {
      return this.$store.getters['harvester/all'](HCI.IMAGE)?.find( (I) => this.value.image === I.id);
    },

    imageVirtualSize() {
      if (this.selectedImage?.virtualSize) {
        return this.selectedImage.virtualSize.replace(' ', '');
      }

      return '0';
    },

    diskSize() {
      const size = this.value?.size || '0';

      return size;
    },

    imageVirtualSizeInByte() {
      return Math.max(this.selectedImage?.status?.size, this.selectedImage?.status?.virtualSize);
    },

    diskSizeInByte() {
      return parseSi(this.value?.size || '0');
    },

    showDiskTooSmallError() {
      if (!this.thirdPartyStorageEnabled ) {
        return false;
      }

      return this.imageVirtualSizeInByte > this.diskSizeInByte;
    }
  },

  watch: {
    'value.type'(neu) {
      if (neu === 'cd-rom') {
        this.value['bus'] = 'sata';
        this.updateHotpluggable();
        this.update();
      }
    },

    'value.image'(neu) {
      this.checkImageExists(neu);
    },

    imagesOption() {
      this.checkImageExists(this.value.image);
    },

    pvcsResource: {
      handler(pvc) {
        if (pvc?.spec?.resources?.requests?.storage && this.isVirtualType) {
          const parseValue = parseSi(pvc.spec.resources.requests.storage);

          const formatSize = formatSi(parseValue, {
            increment:   1024,
            addSuffix:   false,
            maxExponent: 3,
            minExponent: 3,
          });

          this.value.size = `${ formatSize }${ GIBIBYTE }`;
        }
      },
      deep:      true,
      immediate: true
    },
  },

  methods: {
    imageOptionLabel(image) {
      let label = `${ image.metadata.namespace }/${ image.spec.displayName }`;

      if (this.thirdPartyStorageEnabled) {
        label += ` (${ image.imageStorageClass } / ${ image.virtualSize })`;
      }

      return label;
    },

    update() {
      this.value.hasDiskError = this.showDiskTooSmallError;
      this.$emit('update');
    },

    updateHotpluggable() {
      if (this.value.type !== 'cd-rom') {
        this.value['hotpluggable'] = false;
      } else {
        this.value['hotpluggable'] = (this.value.bus === 'sata');
      }
    },

    onTypeChange() {
      if (this.value.image === EMPTY_IMAGE && this.value.type !== 'cd-rom') {
        this.value['image'] = '';
      }

      this.updateHotpluggable();
      this.update();
    },

    onBusChange() {
      if (this.value.image === EMPTY_IMAGE && this.value.bus !== 'sata') {
        this.value['image'] = '';
      }

      this.updateHotpluggable();
      this.update();
    },

    onImageChange() {
      if (this.value.image === EMPTY_IMAGE) {
        this.value['type'] = 'cd-rom';
        this.value['bus'] = 'sata';
        this.value['size'] = `0${ GIBIBYTE }`;
        this.update();

        return;
      }

      const imageResource = this.$store.getters['harvester/all'](HCI.IMAGE)?.find( (I) => this.value.image === I.id);
      const isIsoImage = /iso$/i.test(imageResource?.imageSuffix);
      const imageSize = Math.max(imageResource?.status?.size, imageResource?.status?.virtualSize);

      if (isIsoImage) {
        this.value['type'] = 'cd-rom';
        this.value['bus'] = 'sata';
        this.updateHotpluggable();
      } else {
        this.value['type'] = 'disk';
        this.value['bus'] = 'virtio';
      }

      if (imageSize) {
        let imageSizeGiB = Math.ceil(imageSize / 1024 / 1024 / 1024);

        if (!isIsoImage) {
          imageSizeGiB = Math.max(imageSizeGiB, 10);
        }
        this.value['size'] = `${ imageSizeGiB }${ GIBIBYTE }`;
      }

      this.update();
    },

    onOpen() {
      this.images = this.$store.getters['harvester/all'](HCI.IMAGE);
    },

    checkImageExists(imageId) {
      if (imageId === EMPTY_IMAGE) {
        return;
      }

      if (!!imageId && this.imagesOption.length > 0 && !findBy(this.imagesOption, 'value', imageId)) {
        this.$store.dispatch('growl/error', {
          title:   this.$store.getters['i18n/t']('harvester.vmTemplate.tips.notExistImage.title', { name: imageId }),
          message: this.$store.getters['i18n/t']('harvester.vmTemplate.tips.notExistImage.message')
        }, { root: true });

        this.value['image'] = '';
      }
    }
  }
};
</script>

<template>
  <div>
    <div class="row mb-20">
      <div
        data-testid="input-hevi-name"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.name')"
          :value="value.name"
          :mode="mode"
        >
          <LabeledInput
            v-model:value="value.name"
            :disabled="!isCreate && isExistingCdrom"
            :label="t('harvester.fields.name')"
            required
            :mode="mode"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>

      <div
        data-testid="input-hevi-type"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.type')"
          :value="value.type"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.type"
            :disabled="!isCreate && isExistingCdrom"
            :label="t('harvester.fields.type')"
            :options="VOLUME_TYPE"
            :mode="mode"
            @update:value="onTypeChange"
          />
        </InputOrDisplay>
      </div>
    </div>

    <div class="row mb-20">
      <div
        data-testid="input-hevi-image"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.image')"
          :value="imageName"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.image"
            :disabled="(idx === 0 || isExistingCdrom) && (!isCreate && !value.newCreateId && isVirtualType)"
            :label="t('harvester.fields.image')"
            :options="imagesOption"
            :mode="mode"
            :searchable="true"
            :required="validateRequired"
            @update:value="onImageChange"
          />
        </InputOrDisplay>
      </div>

      <div
        data-testid="input-hevi-size"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.size')"
          :value="value.size"
          :mode="mode"
        >
          <UnitInput
            v-model:value="value.size"
            :output-modifier="true"
            :increment="1024"
            :input-exponent="3"
            :label="t('harvester.fields.size')"
            :mode="mode"
            :required="validateRequired"
            :disabled="isResizeDisabled || isEmptyImage || (!isCreate && isExistingCdrom)"
            :suffix="GIBIBYTE"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
    </div>

    <div class="row mb-20">
      <div
        data-testid="input-hevi-bus"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.virtualMachine.volume.bus')"
          :value="value.bus"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.bus"
            :label="t('harvester.virtualMachine.volume.bus')"
            :mode="mode"
            :options="InterfaceOption"
            :disabled="!isCreate && isExistingCdrom"
            @update:value="onBusChange"
          />
        </InputOrDisplay>
      </div>
      <div
        v-if="value.volumeEncryptionFeatureEnabled && isView"
        class="col span-3"
      >
        <LabelValue
          :name="t('harvester.virtualMachine.volume.encryption')"
          :value="encryptionValue"
        />
      </div>
    </div>
    <div class="row mb-20">
      <div
        v-if="value.volumeBackups && isView"
        class="col span-3"
      >
        <LabelValue
          :name="t('harvester.virtualMachine.volume.readyToUse')"
          :value="readyToUse"
        />
      </div>
    </div>
    <Banner
      v-if="value.volumeBackups && value.volumeBackups.error && value.volumeBackups.error.message"
      color="error"
      class="mb-20"
      :label="value.volumeBackups.error.message"
    />
    <Banner
      v-if="!isView && showDiskTooSmallError"
      color="error"
      :label="t('harvester.virtualMachine.volume.vmImageVolumeTip', {diskSize: diskSize, imageVirtualSize: imageVirtualSize})"
    />
  </div>
</template>
