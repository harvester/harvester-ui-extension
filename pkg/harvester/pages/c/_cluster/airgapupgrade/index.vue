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

const IMAGE_METHOD = {
  NEW:   'new',
  EXIST: 'exist'
};

const DOWNLOAD = 'download';
const UPLOAD = 'upload';

export default {
  name:       'HarvesterAirgapUpgrade',
  components: {
    Checkbox, CruResource, LabeledSelect, LabeledInput, RadioGroup, UpgradeInfo
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

    const imageValue = await this.$store.dispatch('harvester/create', {
      type:     HCI.IMAGE,
      metadata: {
        name:         '',
        namespace:    'harvester-system',
        generateName: 'image-',
        annotations:  {}
      },
      spec: {
        sourceType:  UPLOAD,
        displayName: '',
        checksum:    ''
      },
    });

    this.value = value;
    this.imageValue = imageValue;
  },

  data() {
    return {
      value:         null,
      file:          {},
      imageId:       '',
      imageSource:   IMAGE_METHOD.NEW,
      sourceType:    UPLOAD,
      imageValue:    null,
      errors:        [],
      enableLogging: true,
      IMAGE_METHOD
    };
  },

  computed: {
    doneRoute() {
      return `${ HARVESTER_PRODUCT }-c-cluster-resource`;
    },

    osImageOptions() {
      return this.$store.getters['harvester/all'](HCI.IMAGE)
        .filter((I) => I.isOSImage)
        .map((I) => {
          return {
            label:    I.spec.displayName,
            value:    I.id,
            disabled: !I.isReady
          };
        });
    },

    uploadImage() {
      return this.imageSource === IMAGE_METHOD.NEW;
    },

    fileName() {
      return this.file?.name || '';
    },

    canEnableLogging() {
      return this.$store.getters['harvester/schemaFor'](HCI.UPGRADE_LOG);
    },
  },

  methods: {
    done() {
      this.$router.push({
        name:   this.doneRoute,
        params: { resource: HCI.SETTING, product: 'harvester' }
      });
    },

    async save(buttonCb) {
      let res = null;

      this.errors = [];
      if (!this.imageValue.spec.displayName && this.uploadImage) {
        this.errors.push(this.$store.getters['i18n/t']('validation.required', { key: this.t('generic.name') }));
        buttonCb(false);

        return;
      }

      try {
        if (this.imageSource === IMAGE_METHOD.NEW) {
          this.imageValue.metadata.annotations[HCI_ANNOTATIONS.OS_UPGRADE_IMAGE] = 'True';

          if (this.sourceType === UPLOAD) {
            this.imageValue.spec.sourceType = UPLOAD;
            const file = this.file;

            if (!file.name) {
              this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.selectExitImage'));
              buttonCb(false);

              return;
            }

            this.imageValue.spec.url = '';

            this.imageValue.metadata.annotations[HCI_ANNOTATIONS.IMAGE_NAME] = file.name;

            res = await this.imageValue.save();

            res.uploadImage(file);
          } else if (this.sourceType === DOWNLOAD) {
            this.imageValue.spec.sourceType = DOWNLOAD;
            if (!this.imageValue.spec.url) {
              this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.imageUrl'));
              buttonCb(false);

              return;
            }

            res = await this.imageValue.save();
          }

          this.value.spec.image = res.id;
        } else if (this.imageSource === IMAGE_METHOD.EXIST) {
          if (!this.imageId) {
            this.errors.push(this.$store.getters['i18n/t']('harvester.setting.upgrade.chooseFile'));

            return;
          }

          this.value.spec.image = this.imageId;
        }

        if (this.canEnableLogging) {
          this.value.spec.logEnabled = this.enableLogging;
        }

        await this.value.save();
        this.done();
        buttonCb(true);
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        buttonCb(false);
      }
    },

    handleFileUpload() {
      this.file = this.$refs.file.files[0];
    },

    selectFile() {
      this.$refs.file.value = null;
      this.$refs.file.click();
    },
  },

  watch: {
    'imageValue.spec.url': {
      handler(neu) {
        const suffixName = neu?.split('/')?.pop();
        const splitName = suffixName?.split('.') || [];
        const fileSuffix = splitName?.pop()?.toLowerCase();

        if (splitName.length > 1 && fileSuffix === 'iso' && !this.imageValue.spec.displayName) {
          this.imageValue.spec.displayName = suffixName;
        }
      },
      deep: true
    },

    file(neu) {
      if (!this.imageValue.spec.displayName && neu.name) {
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
      :cancel-event="true"
      @finish="save"
      @cancel="done"
    >
      <RadioGroup
        v-model:value="imageSource"
        class="image-group"
        name="image"
        :options="[
          IMAGE_METHOD.NEW,
          IMAGE_METHOD.EXIST,
        ]"
        :labels="[
          t('harvester.upgradePage.uploadNew'),
          t('harvester.upgradePage.selectExisting'),
        ]"
      />

      <UpgradeInfo />

      <div v-if="uploadImage">
        <LabeledInput
          v-model.trim="imageValue.spec.displayName"
          class="mb-20"
          label-key="harvester.fields.name"
          required
        />

        <LabeledInput
          v-model:value="imageValue.spec.checksum"
          class="mb-10"
          label-key="harvester.setting.upgrade.checksum"
        />

        <Checkbox
          v-if="canEnableLogging"
          v-model:value="enableLogging"
          class="check mb-20"
          type="checkbox"
          :label="t('harvester.upgradePage.enableLogging')"
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
          v-model.trim="imageValue.spec.url"
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
      </div>

      <LabeledSelect
        v-else
        v-model:value="imageId"
        :options="osImageOptions"
        required
        class="mb-20"
        label-key="harvester.fields.image"
      />
    </CruResource>
  </div>
</template>

<style lang="scss" scoped>
#air-gap {
  :deep() .image-group .radio-group {
    display: flex;
    .radio-container {
      margin-right: 30px;
    }
  }
  .chooseFile {
    display: flex;
    align-items: center;
  }
}
</style>
