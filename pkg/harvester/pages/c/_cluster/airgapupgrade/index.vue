<script>
import CruResource from '@shell/components/CruResource';
import { RadioGroup } from '@components/Form/Radio';
import { Checkbox } from '@components/Form/Checkbox';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import UpgradeInfo from '../../../../components/UpgradeInfo';
import { HCI } from '../../../../types';
import { PRODUCT_NAME as HARVESTER_PRODUCT } from '../../../../config/harvester';
import ImagePercentageBar from '@shell/components/formatter/ImagePercentageBar';
import { Banner } from '@components/Banner';
import isEmpty from 'lodash/isEmpty';

const IMAGE_METHOD = {
  NEW:    'new',
  EXIST:  'exist',
  DELETE: 'delete'
};

const DOWNLOAD = 'download';
const UPLOAD = 'upload';

export default {
  name:       'HarvesterAirgapUpgrade',
  components: {
    Checkbox, CruResource, LabeledSelect, LabeledInput, RadioGroup, UpgradeInfo, ImagePercentageBar, Banner
  },

  inheritAttrs: false,

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: HCI.IMAGE });

    const value = await this.$store.dispatch('harvester/create', {
      type:     HCI.UPGRADE,
      metadata: {
        generateName: 'hvst-upgrade-',
        namespace:    'harvester-system',
      },
      spec: { image: '' }
    });

    await this.initImageValue();
    this.value = value;
  },

  beforeUnmount() {
    if (this.uploadController) {
      this.uploadController.abort();
    }
  },

  data() {
    return {
      value:                        null,
      file:                         {},
      uploadImageId:                '',
      imageId:                      '',
      deleteImageId:                '',
      imageSource:                  IMAGE_METHOD.NEW,
      sourceType:                   UPLOAD,
      uploadController:             null,
      uploadResult:                 null,
      imageValue:                   null,
      enableLogging:                true,
      IMAGE_METHOD,
      skipSingleReplicaDetachedVol: false,
      errors:                       [],
    };
  },

  computed: {
    doneRoute() {
      return `${ HARVESTER_PRODUCT }-c-cluster-resource`;
    },

    skipSingleReplicaDetachedVolFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('skipSingleReplicaDetachedVol');
    },

    allOSImages() {
      return this.$store.getters['harvester/all'](HCI.IMAGE).filter((I) => I.isOSImage) || [];
    },

    deleteOSImageOptions() {
      return this.allOSImages.map((I) => {
        return {
          label:    I.spec.displayName,
          value:    I.id,
        };
      });
    },

    osImageOptions() {
      return this.allOSImages.map((I) => {
        return {
          label:    I.spec.displayName,
          value:    I.id,
          disabled: !I.isReady
        };
      });
    },

    createNewImage() {
      return this.imageSource === IMAGE_METHOD.NEW;
    },

    selectExistImage() {
      return this.imageSource === IMAGE_METHOD.EXIST;
    },

    deleteExistImage() {
      return this.imageSource === IMAGE_METHOD.DELETE;
    },

    fileName() {
      return this.file?.name || '';
    },

    canEnableLogging() {
      return this.$store.getters['harvester/schemaFor'](HCI.UPGRADE_LOG);
    },

    uploadProgress() {
      const image = this.$store.getters['harvester/byId'](HCI.IMAGE, this.imageValue.id);

      return image?.status?.progress;
    },

    enableUpgrade() {
      if (this.deleteExistImage) {
        return false;
      }

      if (this.sourceType === DOWNLOAD) {
        return true;
      }

      if (this.sourceType === UPLOAD) {
        return this.fileName === '' ? true : this.uploadProgress === 100;
      }

      return true;
    },

    isUploading() {
      return this.fileName !== '' && this.uploadProgress !== 100;
    },

    showProgressBar() {
      return this.createNewImage && this.sourceType === UPLOAD && this.isUploading;
    },

    showUploadSuccessBanner() {
      return this.createNewImage && this.fileName !== '' && isEmpty(this.errors) && !this.showUploadingWarningBanner && this.uploadResult?._status === 200;
    },

    showUploadingWarningBanner() {
      return this.createNewImage && this.isUploading;
    },

    showUpgradeOptions() {
      return this.createNewImage || this.selectExistImage;
    },

    disableUploadButton() {
      return this.sourceType === UPLOAD && this.isUploading;
    },
  },

  methods: {
    done() {
      if (this.uploadController) {
        this.uploadController.abort();
      }
      this.$router.push({
        name:   this.doneRoute,
        params: { resource: HCI.SETTING, product: 'harvester' }
      });
    },

    async initImageValue() {
      this.imageValue = await this.$store.dispatch('harvester/create', {
        type:     HCI.IMAGE,
        metadata: {
          name:         '',
          namespace:    'harvester-system',
          generateName: 'image-',
          annotations:  {}
        },
        spec: {
          sourceType:             UPLOAD,
          displayName:            '',
          backend:                'cdi',
          targetStorageClassName: 'longhorn-static',
          checksum:               this.imageValue?.spec?.checksum || '',
        },
      });
    },

    async save(buttonCb) {
      let res = null;

      this.file = {};
      this.errors = [];

      if (!this.imageValue.spec.displayName && this.createNewImage) {
        this.errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('generic.name') }));
        buttonCb(false);

        return;
      }

      try {
        if (this.imageSource === IMAGE_METHOD.NEW) {
          this.imageValue.metadata.annotations[HCI_ANNOTATIONS.OS_UPGRADE_IMAGE] = 'True';

          if (this.sourceType === UPLOAD && this.uploadImageId !== '') {
            this.value.spec.image = this.uploadImageId;
          } else if (this.sourceType === DOWNLOAD) {
            this.imageValue.spec.sourceType = DOWNLOAD;

            if (!this.imageValue.spec.url) {
              this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.imageUrl'));
              buttonCb(false);

              return;
            }

            res = await this.imageValue.save();
            this.value.spec.image = res.id;
          }
        } else if (this.imageSource === IMAGE_METHOD.EXIST) {
          if (!this.imageId) {
            this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.chooseFile'));
            buttonCb(false);

            return;
          }

          this.value.spec.image = this.imageId;
        }

        if (this.canEnableLogging) {
          this.value.spec.logEnabled = this.enableLogging;
        }
        if (this.skipSingleReplicaDetachedVolFeatureEnabled) {
          this.value.metadata.annotations = { [HCI_ANNOTATIONS.SKIP_SINGLE_REPLICA_DETACHED_VOL]: JSON.stringify(this.skipSingleReplicaDetachedVol) };
        }

        await this.value.save();
        this.done();
        buttonCb(true);
      } catch (e) {
        this.errors = [e?.message] || exceptionToErrorsArray(e);
        buttonCb(false);
      }
    },

    async uploadFile(file) {
      const fileName = file.name;

      if (!fileName) {
        this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.unknownImageName'));

        return;
      }
      const isDuplicatedFile = this.allOSImages.some((I) => I.spec.displayName === fileName);

      if (isDuplicatedFile) {
        this.errors.push(this.$store.getters['i18n/t']('harvester.upgradePage.upload.duplicatedFile'));
        this.file = {};

        return;
      }

      this.errors = [];
      this.imageValue.spec.sourceType = UPLOAD;
      this.imageValue.spec.displayName = fileName;
      this.imageValue.metadata.annotations[HCI_ANNOTATIONS.OS_UPGRADE_IMAGE] = 'True';
      this.imageValue.metadata.annotations[HCI_ANNOTATIONS.IMAGE_NAME] = fileName;
      this.imageValue.spec.url = '';

      try {
        const res = await this.imageValue.save();

        this.uploadImageId = res.id;
        this.uploadController = new AbortController();

        const signal = this.uploadController.signal;

        this.uploadResult = await res.uploadImage(file, { signal });
      } catch (e) {
        if (e?.code === 'ERR_NETWORK') {
          this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.networkError'));
        } else if (e?.code === 'ERR_CANCELED') {
          this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.cancelUpload'));
        } else {
          this.errors = exceptionToErrorsArray(e);
        }
        this.file = {};
        this.uploadImageId = '';
      }
    },

    handleImageDelete(imageId) {
      const image = this.allOSImages.find((I) => I.id === imageId);

      if (image) {
        this.$store.dispatch('harvester/promptModal', {
          resources:        [image],
          component:        'ConfirmRelatedToRemoveDialog',
          needConfirmation: false,
          warningMessage:   this.$store.getters['i18n/t']('harvester.modal.osImage.message', { name: image.displayName })
        });
        this.deleteImageId = '';
      }
    },

    async handleFileUpload() {
      this.uploadImageId = '';
      this.errors = [];
      this.file = this.$refs.file?.files[0];
      if (this.file) {
        await this.initImageValue();
        await this.uploadFile(this.file);
      }
    },

    selectFile() {
      this.$refs.file.value = null;
      this.$refs.file.click();
    },
  },

  watch: {
    imageSource(neu) {
      if (neu !== IMAGE_METHOD.DELETE) {
        this.deleteImageId = '';
      }
    },

    'imageValue.spec.url': {
      handler(neu) {
        const suffixName = neu?.split('/')?.pop();
        const splitName = suffixName?.split('.') || [];
        const fileSuffix = splitName?.pop()?.toLowerCase();

        if (splitName.length > 1 && fileSuffix === 'iso' && suffixName !== this.imageValue.spec.displayName) {
          this.imageValue.spec.displayName = suffixName;
        }
      },
      deep: true
    },
    file(neu) {
      // update name input if select new image
      if (neu.name && neu.name !== this.imageValue.spec.displayName) {
        this.imageValue.spec.displayName = neu.name;
      }
    }
  }
};
</script>

<template>
  <div
    v-if="value"
    id="air-gap"
  >
    <h3 class="mb-20">
      {{ t('harvester.upgradePage.osUpgrade') }}
    </h3>
    <CruResource
      :done-route="doneRoute"
      :resource="value"
      mode="create"
      :errors="errors"
      :can-yaml="false"
      finish-button-mode="upgrade"
      :validation-passed="enableUpgrade"
      :cancel-event="true"
      @finish="save"
      @cancel="done"
      @error="e=>errors=e"
    >
      <RadioGroup
        v-model:value="imageSource"
        class="image-group"
        name="image"
        :options="[
          IMAGE_METHOD.NEW,
          IMAGE_METHOD.EXIST,
          IMAGE_METHOD.DELETE,
        ]"
        :labels="[
          t('harvester.upgradePage.uploadNew'),
          t('harvester.upgradePage.selectExisting'),
          t('harvester.upgradePage.deleteExisting'),
        ]"
      />

      <UpgradeInfo v-if="createNewImage || selectExistImage" />

      <Banner
        v-if="showUploadSuccessBanner"
        color="success"
        class="mt-0 mb-30"
        :label="t('harvester.setting.upgrade.uploadSuccess', { name: file.name })"
      />
      <Banner
        v-if="showUploadingWarningBanner"
        color="warning"
        class="mt-0 mb-30"
        :label="t('harvester.image.warning.osUpgrade.uploading', { name: file.name })"
      />

      <div
        v-if="showUpgradeOptions"
        class="mt-10 mb-10"
      >
        <Checkbox
          v-if="canEnableLogging"
          v-model:value="enableLogging"
          class="check mb-20"
          type="checkbox"
          :label="t('harvester.upgradePage.enableLogging')"
        />
        <div
          v-if="skipSingleReplicaDetachedVolFeatureEnabled"
          class="mb-20"
        >
          <Checkbox
            v-model:value="skipSingleReplicaDetachedVol"
            class="check"
            type="checkbox"
            :label="t('harvester.upgradePage.skipSingleReplicaDetachedVol')"
          />
        </div>
      </div>

      <div v-if="createNewImage">
        <LabeledInput
          v-model:value.trim="imageValue.spec.displayName"
          class="mb-20"
          label-key="harvester.fields.name"
          required
        />

        <LabeledInput
          v-model:value="imageValue.spec.checksum"
          class="mb-10"
          label-key="harvester.setting.upgrade.checksum"
        />

        <RadioGroup
          v-model:value="sourceType"
          class="mb-20 image-group"
          name="sourceType"
          :options="[
            'upload',
            'download',
          ]"
          :labels="[
            t('harvester.image.sourceType.upload'),
            t('harvester.image.sourceType.download')
          ]"
        />

        <LabeledInput
          v-if="sourceType === 'download'"
          v-model:value.trim="imageValue.spec.url"
          class="labeled-input--tooltip"
          required
          label-key="harvester.image.url"
        />

        <div
          v-else
          class="chooseFile"
        >
          <button
            type="button"
            class="btn role-primary"
            :disabled="disableUploadButton"
            @click="selectFile"
          >
            {{ t('harvester.image.uploadFile') }}
            <input
              v-show="false"
              id="file"
              ref="file"
              type="file"
              accept=".iso"
              @change="handleFileUpload()"
            />
          </button>

          <span
            :class="{ 'text-muted': !fileName }"
            class="ml-20"
          >
            {{ fileName ? fileName : t('harvester.generic.noFileChosen') }}
          </span>
        </div>
        <ImagePercentageBar
          v-if="showProgressBar"
          class="mt-20"
          :value="uploadProgress"
        />
      </div>
      <LabeledSelect
        v-if="selectExistImage"
        v-model:value="imageId"
        :options="osImageOptions"
        required
        class="mb-20"
        label-key="harvester.fields.image"
      />

      <div
        v-if="deleteExistImage"
        class="mt-20"
      >
        <Banner
          color="info"
          class="mt-10 mb-30"
          :label="t('harvester.upgradePage.deleteHeader')"
        />
        <LabeledSelect
          v-model:value="deleteImageId"
          :options="deleteOSImageOptions"
          required
          class="mb-20"
          label-key="harvester.fields.image"
          @update:value="handleImageDelete"
        />
      </div>
    </CruResource>
  </div>
</template>

<style lang="scss" scoped>
#air-gap {
  padding: 20px;

  :deep() .image-group .radio-group {
    display: flex;
    .radio-container {
      margin-right: 30px;
    }
  }
  .parent {
    grid-template-columns:auto 40px;
  }
  .chooseFile {
    display: flex;
    align-items: center;
  }
}
</style>
