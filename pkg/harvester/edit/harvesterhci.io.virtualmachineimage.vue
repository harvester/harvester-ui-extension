<script>
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import { LabeledInput } from '@components/Form/LabeledInput';
import KeyValue from '@shell/components/form/KeyValue';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import { RadioGroup } from '@components/Form/Radio';
import Select from '@shell/components/form/Select';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { allHash } from '@shell/utils/promise';
import { STORAGE_CLASS } from '@shell/config/types';
import { VM_IMAGE_FILE_FORMAT } from '../validators/vm-image';
import { OS } from '../mixins/harvester-vm';
import { HCI } from '../types';
import { LVM_DRIVER } from '../models/harvester/storage.k8s.io.storageclass';
import { isInternalStorageClass } from '../utils/storage-class';

const ENCRYPT = 'encrypt';
const DECRYPT = 'decrypt';
const CLONE = 'clone';
const DOWNLOAD = 'download';
const UPLOAD = 'upload';
const rawORqcow2 = 'raw_qcow2';
const LONGHORN = 'longhorn';

export default {
  name: 'EditImage',

  inheritAttrs: false,

  emits: ['update:value'],

  components: {
    Tab,
    Tabbed,
    KeyValue,
    Select,
    CruResource,
    LabeledInput,
    NameNsDescription,
    RadioGroup,
    LabeledSelect,
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      images:         this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IMAGE }),
      storageClasses: this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }),
    });

    this['storageClassName'] = this.storageClassName || this.defaultStorageClassName();
    this.images = this.$store.getters[`${ inStore }/all`](HCI.IMAGE);

    this.storages = this.$store.getters[`${ inStore }/all`](STORAGE_CLASS);

    const { securityParameters } = this.value.spec;

    // edit and view mode should show the source image
    if (securityParameters) {
      // image ns/name = image.id
      const sourceImage = `${ securityParameters.sourceImageNamespace }/${ securityParameters.sourceImageName }`;

      this.selectedImage = this.images.find((image) => image.id === sourceImage);
    }
  },

  data() {
    // pass from Encrypt Image / Decrypt Image actions
    const { image, sourceType, cryptoOperation } = this.$route.query || {};

    if ( !this.value.spec ) {
      this.value['spec'] = { sourceType: sourceType || DOWNLOAD };
    }

    if (image && cryptoOperation) {
      const imageObject = JSON.parse(image);

      this.value.spec.securityParameters = {
        cryptoOperation,
        sourceImageName:      imageObject.metadata.name,
        sourceImageNamespace: imageObject.metadata.namespace
      };
    }

    if (!this.value.metadata.name) {
      this.value.metadata.generateName = 'image-';
    }

    return {
      selectedImage:  null,
      storageClasses: [],
      images:         [],
      url:            this.value.spec.url,
      files:          [],
      resource:       '',
      headers:        {},
      fileUrl:        '',
      file:           '',
      HCI_ANNOTATIONS,
    };
  },

  computed: {
    uploadFileName() {
      return this.file?.name || '';
    },

    imageName() {
      return this.value?.metadata?.annotations?.[HCI_ANNOTATIONS.IMAGE_NAME] || '-';
    },

    isCreateEdit() {
      return this.isCreate || this.isEdit;
    },

    showEditAsYaml() {
      return this.value.spec.sourceType === DOWNLOAD || this.value.spec.sourceType === CLONE;
    },

    radioGroupOptions() {
      if (this.value.volumeEncryptionFeatureEnabled) {
        return [
          DOWNLOAD,
          UPLOAD,
          ENCRYPT,
          DECRYPT
        ];
      }

      return [
        DOWNLOAD,
        UPLOAD
      ];
    },

    encryptedStorageClasses() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const storages = this.$store.getters[`${ inStore }/all`](STORAGE_CLASS);

      return storages.filter((s) => s.isEncrypted);
    },

    nonEncryptedStorageClasses() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const storages = this.$store.getters[`${ inStore }/all`](STORAGE_CLASS);

      return storages.filter((s) => !s.isEncrypted);
    },

    storageClassOptions() {
      const storages = this.value.spec?.securityParameters?.cryptoOperation === ENCRYPT ? this.encryptedStorageClasses : this.nonEncryptedStorageClasses;
      const filteredStorages = this.value.thirdPartyStorageFeatureEnabled ? storages.filter((s) => !s.parameters?.backingImage) : storages
        .filter((s) => !s.parameters?.backingImage && s.provisioner !== LVM_DRIVER) ;

      return filteredStorages
        .map((s) => {
          let label = s.isDefault ? `${ s.name } (${ this.t('generic.default') })` : s.name;
          let disabled = false;

          if (isInternalStorageClass(s.name)) {
            label += ` (${ this.t('harvester.storage.internal.label') })`;
            disabled = true;
          }

          return {
            label,
            value: s.name,
            disabled
          };
        }) || [];
    },

    storageClassName: {
      get() {
        return this.value.metadata.annotations[HCI_ANNOTATIONS.STORAGE_CLASS];
      },

      set(nue) {
        this.value.metadata.annotations[HCI_ANNOTATIONS.STORAGE_CLASS] = nue;
        if (this.value.thirdPartyStorageFeatureEnabled) {
          this.value.spec.targetStorageClassName = nue;
        }
      }
    },
    sourceImageOptions() {
      let options = [];

      if (this.value.spec.sourceType !== CLONE) {
        return options;
      }
      if (this.value.spec.securityParameters.cryptoOperation === ENCRYPT) {
        options = this.images.filter((image) => !image.isEncrypted);
      } else {
        options = this.images.filter((image) => image.isEncrypted);
      }

      return options.map((image) => image.displayNameWithNamespace);
    },
    sourceImage: {
      get() {
        if (this.selectedImage) {
          return this.selectedImage.displayNameWithNamespace;
        }

        return '';
      },
      set(neu) {
        this.selectedImage = this.images.find((i) => i.displayNameWithNamespace === neu);
        // sourceImageName should bring the name of the image
        this.value.spec.securityParameters.sourceImageName = this.selectedImage?.metadata.name || '';
        this.value.spec.securityParameters.sourceImageNamespace = this.selectedImage?.metadata.namespace || '';
      }
    },
    sourceType: {
      get() {
        if (this.value.spec.sourceType === CLONE) {
          return this.value.spec?.securityParameters?.cryptoOperation;
        } else {
          return this.value.spec.sourceType;
        }
      },

      set(neu) {
        if (neu === DECRYPT || neu === ENCRYPT) {
          this.value.spec.sourceType = CLONE;
          this.value.spec['securityParameters'] = {
            cryptoOperation:      neu,
            sourceImageName:      '',
            sourceImageNamespace: this.value.metadata.namespace
          };
          this.selectedImage = null;
        } else {
          delete this.value.spec['securityParameters'];
          this.value.spec.sourceType = neu;
        }
      }
    }
  },

  watch: {
    'value.spec.url'(neu) {
      const url = neu.trim();

      this.setImageLabels(url);
    },

    'value.spec.sourceType'() {
      this['file'] = null;
      this.url = '';

      if (this.$refs?.file?.value) {
        this.$refs.file.value = null;
      }
    },
    'value.spec.securityParameters.cryptoOperation'() {
      if (this.value.spec?.securityParameters?.cryptoOperation === ENCRYPT) {
        this.storageClassName = this.encryptedStorageClasses[0]?.name || '';
      } else { // URL / FILE / DECRYPT should use default storage class
        this.storageClassName = this.defaultStorageClassName();
      }
    },
    'storageClassName'(neu) {
      const storageClass = this.storages.find((s) => s.id === neu);

      if (storageClass && this.value.thirdPartyStorageFeatureEnabled) {
        this.value.spec.backend = storageClass.isLonghornV1 ? 'backingimage' : 'cdi';
      }
    }
  },

  methods: {
    async saveImage(buttonCb) {
      this.value.spec.displayName = (this.value.spec.displayName || '').trim();

      if (this.isEdit) return await this.handleEditImage(buttonCb);

      if (this.value.spec.sourceType === UPLOAD && this.isCreate) {
        try {
          this.value.spec.url = '';

          const file = this.file;

          this.value.metadata.annotations[HCI_ANNOTATIONS.IMAGE_NAME] = file?.name;

          const res = await this.value.save();

          res.uploadImage(file);

          buttonCb(true);
          this.done();
        } catch (e) {
          this.errors = exceptionToErrorsArray(e);
          buttonCb(false);
        }
      } else {
        this.value.spec.url = this.value.spec.url?.trim() || '';
        this.save(buttonCb);
      }
    },

    async handleEditImage(buttonCb) {
      try {
        const data = [{
          op: 'replace', path: '/metadata/labels', value: this.value.metadata.labels
        }, {
          op: 'replace', path: '/metadata/annotations', value: this.value.metadata.annotations
        }];

        await this.value.patch(data);
        buttonCb(true);
        this.done();
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        buttonCb(false);
      }
    },

    setImageLabels(str) {
      const suffixName = str?.split('/')?.pop() || str;

      const fileSuffix = suffixName?.split('.')?.pop()?.toLowerCase();

      if (VM_IMAGE_FILE_FORMAT.includes(fileSuffix)) {
        const labelValue = fileSuffix === 'iso' ? fileSuffix : rawORqcow2;

        this.addLabel(HCI_ANNOTATIONS.IMAGE_SUFFIX, labelValue);

        if (!this.value.spec.displayName) {
          this.$refs.nd.changeNameAndNamespace({
            text:     suffixName,
            selected: this.value.metadata.namespace,
          });
        }
      }

      const os = this.getOSType(str);

      if (os) {
        this.addLabel(HCI_ANNOTATIONS.OS_TYPE, os.value);
      }
    },

    addLabel(labelKey, value) {
      const rows = this.$refs.labels.rows;

      rows.map((label, idx) => {
        if (label.key === labelKey) {
          this.$refs.labels.remove(idx);
        }
      });
      this.$refs.labels.add(labelKey, value);
    },

    handleFileUpload() {
      const file = this.$refs.file.files[0];

      this.file = file;

      this.setImageLabels(file?.name);

      if (!this.value.spec.displayName) {
        this.$refs.nd.changeNameAndNamespace({
          text:     file?.name,
          selected: this.value.metadata.namespace,
        });
      }

      this.setImageLabels();
    },

    selectFile() {
      // Clear the value so the user can reselect the same file again
      this.$refs.file.value = null;
      this.$refs.file.click();
    },

    internalAnnotations(option) {
      const optionKeys = [HCI_ANNOTATIONS.OS_TYPE, HCI_ANNOTATIONS.IMAGE_SUFFIX];

      return optionKeys.find((O) => O === option.key);
    },

    calculateOptions(keyName) {
      if (keyName === HCI_ANNOTATIONS.OS_TYPE) {
        return OS;
      } else if (keyName === HCI_ANNOTATIONS.IMAGE_SUFFIX) {
        return [{
          label: 'ISO',
          value: 'iso'
        }, {
          label: 'raw/qcow2',
          value: rawORqcow2
        }];
      }

      return [];
    },

    focusKey() {
      this.$refs.key.focus();
    },

    getOSType(str) {
      if (!str) {
        return;
      }

      return OS.find( (os) => {
        if (os.match) {
          return os.match.find((matchValue) => str.toLowerCase().includes(matchValue)) ? os.value : false;
        } else {
          return str.toLowerCase().includes(os.value.toLowerCase()) ? os.value : false;
        }
      });
    },

    defaultStorageClassName() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const defaultStorage = this.$store.getters[`${ inStore }/all`](STORAGE_CLASS).find((s) => s.isDefault);

      if (!defaultStorage) {
        return LONGHORN;
      }

      // if default sc is encrypted, use longhorn as default
      return defaultStorage.isEncrypted ? LONGHORN : defaultStorage?.metadata?.name;
    }
  },
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :can-yaml="showEditAsYaml ? true : false"
    :apply-hooks="applyHooks"
    @finish="saveImage"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      :label="t('generic.name')"
      name-key="spec.displayName"
      @update:value="$emit('update:value', $event)"
    />

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="basic"
        :label="t('harvester.image.tabs.basics')"
        :weight="99"
        class="bordered-table"
      >
        <RadioGroup
          v-if="isCreate"
          v-model:value="sourceType"
          name="model"
          :options="radioGroupOptions"
          :labels="[
            t('harvester.image.sourceType.download'),
            t('harvester.image.sourceType.upload'),
            t('harvester.image.sourceType.encrypt'),
            t('harvester.image.sourceType.decrypt'),
          ]"
          :mode="mode"
        />
        <div class="row mb-20 mt-20">
          <div class="col span-12">
            <LabeledInput
              v-if="!isCreate"
              v-model:value="value.spec.sourceType"
              :mode="mode"
              class="mb-20"
              :disabled="isEdit"
              label-key="harvester.image.source"
            />

            <LabeledInput
              v-if="value.spec.sourceType === 'download'"
              v-model:value="value.spec.url"
              :mode="mode"
              :disabled="isEdit"
              class="mb-20 labeled-input--tooltip"
              required
              label-key="harvester.image.url"
              :tooltip="t('harvester.image.urlTip', {}, true)"
            />

            <div v-else-if="value.spec.sourceType === 'upload'">
              <LabeledInput
                v-if="isView"
                v-model:value="imageName"
                :mode="mode"
                class="mt-20"
                label-key="harvester.image.fileName"
              />

              <button
                v-if="isCreate"
                type="button"
                class="btn role-primary"
                @click="selectFile"
              >
                <span>
                  {{ t('harvester.image.uploadFile') }}
                </span>
                <input
                  v-show="false"
                  id="file"
                  ref="file"
                  type="file"
                  accept=".qcow, .qcow2, .raw, .img, .iso"
                  @change="handleFileUpload()"
                />
              </button>

              <div
                v-if="uploadFileName"
                class="fileName mt-5"
              >
                <span class="icon icon-file" />
                {{ uploadFileName }}
              </div>
            </div>

            <LabeledInput
              v-if="value.spec.sourceType === 'download'"
              v-model:value="value.spec.checksum"
              :mode="mode"
              :disabled="isEdit"
              label-key="harvester.image.checksum"
              :tooltip="t('harvester.image.checksumTip')"
            />

            <LabeledSelect
              v-if="value.spec.sourceType === 'clone'"
              v-model:value="sourceImage"
              :options="sourceImageOptions"
              :label="t('harvester.image.sourceImage')"
              :mode="mode"
              :disabled="isEdit"
              class="mb-20"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="storage"
        :label="t('harvester.storage.label')"
        :weight="89"
        class="bordered-table"
      >
        <div class="row">
          <div class="col span-6">
            <LabeledSelect
              v-model:value="storageClassName"
              :options="storageClassOptions"
              :label="t('harvester.storage.storageClass.label')"
              :mode="mode"
              :disabled="isEdit"
              class="mb-20"
            />
          </div>
        </div>
      </Tab>

      <Tab
        name="labels"
        :label="t('labels.labels.title')"
        :weight="2"
        class="bordered-table"
      >
        <KeyValue
          key="labels"
          ref="labels"
          :value="value.labels"
          :add-label="t('labels.addLabel')"
          :mode="mode"
          :pad-left="false"
          :read-allowed="false"
          :value-can-be-empty="true"
          :toggle-filter="true"
          :protected-keys="[HCI_ANNOTATIONS.IMAGE_DISPLAY_NAME]"
          @focusKey="focusKey"
          @update:value="value.setLabels($event)"
        >
          <template #value="{row, keyName, valueName, queueUpdate}">
            <Select
              v-if="internalAnnotations(row)"
              v-model:value="row[valueName]"
              :mode="mode"
              :searchable="true"
              :clearable="false"
              :options="calculateOptions(row[keyName])"
              @update:value="queueUpdate"
            />
            <input
              v-else
              v-model="row[valueName]"
              :disabled="isView || row[keyName] === HCI_ANNOTATIONS.IMAGE_DISPLAY_NAME"
              :type="'text'"
              :placeholder="t('keyValue.valuePlaceholder')"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              @input="queueUpdate"
            />
          </template>
        </KeyValue>
      </Tab>
    </Tabbed>
  </CruResource>
</template>

<style lang="scss" scoped>
.kv-item.value > .unlabeled-select {
  height: 40px;
  line-height: 1;
}
</style>
