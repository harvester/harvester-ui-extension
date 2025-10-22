<script>
import Tab from '@shell/components/Tabbed/Tab';
import SortableTable from '@shell/components/SortableTable';
import CruResource from '@shell/components/CruResource';
import UnitInput from '@shell/components/form/UnitInput';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import Conditions from '@shell/components/form/Conditions';
import { Banner } from '@components/Banner';
import { allHash } from '@shell/utils/promise';
import { get } from '@shell/utils/object';
import { STORAGE_CLASS, LONGHORN, PV } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { saferDump } from '@shell/utils/create-yaml';
import { _CREATE, _EDIT } from '@shell/config/query-params';
import CreateEditView from '@shell/mixins/create-edit-view';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { STATE, NAME, AGE, NAMESPACE } from '@shell/config/table-headers';
import { InterfaceOption, VOLUME_DATA_SOURCE_KIND } from '../config/harvester-map';
import { HCI, VOLUME_SNAPSHOT } from '../types';
import { LVM_DRIVER } from '../models/harvester/storage.k8s.io.storageclass';
import { DATA_ENGINE_V2 } from '../models/harvester/persistentvolumeclaim';
import { GIBIBYTE } from '../utils/unit';
import { VOLUME_MODE } from '@pkg/harvester/config/types';
import { isInternalStorageClass } from '../utils/storage-class';

export default {
  name: 'HarvesterVolume',

  emits: ['update:value'],

  components: {
    Banner,
    Tab,
    UnitInput,
    CruResource,
    SortableTable,
    ResourceTabs,
    LabeledSelect,
    LabeledInput,
    NameNsDescription,
    Conditions
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const _hash = {
      images:    this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IMAGE }),
      snapshots: this.$store.dispatch(`${ inStore }/findAll`, { type: VOLUME_SNAPSHOT }),
      storages:  this.$store.dispatch(`${ inStore }/findAll`, { type: STORAGE_CLASS }),
      pvs:       this.$store.dispatch(`${ inStore }/findAll`, { type: PV }),
    };

    if (this.$store.getters[`${ inStore }/schemaFor`](LONGHORN.VOLUMES)) {
      _hash.longhornVolumes = this.$store.dispatch(`${ inStore }/findAll`, { type: LONGHORN.VOLUMES });
    }

    if (this.$store.getters[`${ inStore }/schemaFor`](LONGHORN.ENGINES)) {
      _hash.longhornEngines = this.$store.dispatch(`${ inStore }/findAll`, { type: LONGHORN.ENGINES });
    }

    const hash = await allHash(_hash);

    this.snapshots = hash.snapshots;
    this.images = hash.images;

    const defaultStorage = this.$store.getters[`harvester/all`](STORAGE_CLASS).find( (O) => O.isDefault);

    this.value.spec['storageClassName'] = this.value?.spec?.storageClassName || defaultStorage?.metadata?.name || 'longhorn';
  },

  data() {
    if (this.mode === _CREATE) {
      // default volumeMode to Block
      this.value.spec.volumeMode = VOLUME_MODE.BLOCK;
      this.value.spec.accessModes = ['ReadWriteMany'];
    }

    const storage = this.value?.spec?.resources?.requests?.storage || null;
    const imageId = get(this.value, `metadata.annotations."${ HCI_ANNOTATIONS.IMAGE_ID }"`);
    const source = !imageId ? 'blank' : 'url';

    return {
      source,
      storage,
      imageId,
      snapshots: [],
      images:    [],
      GIBIBYTE
    };
  },

  created() {
    this.registerBeforeHook(this.willSave, 'willSave');
  },

  computed: {
    isBlank() {
      return this.source === 'blank';
    },

    isEdit() {
      return this.mode === _EDIT;
    },

    isVMImage() {
      return this.source === 'url';
    },

    longhornV2LVMSupport() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('longhornV2LVMSupport');
    },

    sourceOption() {
      return [{
        value: 'blank',
        label: this.t('harvester.volume.sourceOptions.new')
      }, {
        value: 'url',
        label: this.t('harvester.volume.sourceOptions.vmImage')
      }];
    },

    interfaceOption() {
      return InterfaceOption;
    },

    volumeModeOptions() {
      return Object.values(VOLUME_MODE);
    },

    imageOption() {
      return sortBy(
        this.images
          .filter((obj) => obj.isReady)
          .map((obj) => {
            return {
              label: `${ obj.metadata.namespace }/${ obj.spec.displayName }`,
              value: obj.id
            };
          }),
        'label'
      );
    },

    snapshotHeaders() {
      return [
        STATE,
        NAME,
        NAMESPACE,
        {
          name:          'size',
          labelKey:      'tableHeaders.size',
          value:         'status.restoreSize',
          sort:          'size',
          formatter:     'Si',
          formatterOpts: {
            opts: {
              increment: 1024, addSuffix: true, maxExponent: 3, minExponent: 3, suffix: 'i',
            },
            needParseSi: true
          },
        },
        {
          name:      'readyToUse',
          labelKey:  'tableHeaders.readyToUse',
          value:     'status.readyToUse',
          align:     'left',
          formatter: 'Checked',
        },
        AGE
      ];
    },

    dataSourceKind() {
      return VOLUME_DATA_SOURCE_KIND[this.value.spec?.dataSource?.kind];
    },

    storageClasses() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](STORAGE_CLASS);
    },

    isLonghornStorageClass() {
      const selectedSC = this.storageClasses.find((sc) => sc.name === this.value?.spec?.storageClassName) || {};

      return selectedSC && selectedSC.isLonghorn;
    },

    showVolumeMode() {
      // we won't let user choose volumeMode if source = vmimage
      if (!this.value.thirdPartyStorageFeatureEnabled || this.isVMImage || !!this.value?.spec?.storageClassName === false) {
        return false;
      }

      if (this.isLonghornStorageClass) {
        return false;
      }

      return true;
    },

    storageClassOptions() {
      return this.storageClasses.filter((s) => !s.parameters?.backingImage).map((s) => {
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

    frontend() {
      return this.value.longhornVolume?.spec?.frontend;
    },

    frontendDisplay() {
      const format = ['blockdev'];

      if (format.includes(this.frontend)) {
        return this.t(`harvester.volume.${ this.frontend }`);
      }

      return this.frontend;
    },

    attachedNode() {
      return this.value.longhornVolume?.spec?.nodeID;
    },

    endpoint() {
      return this.value.longhornEngine?.status?.endpoint;
    },

    diskTags() {
      return this.value.longhornVolume?.spec?.diskSelector;
    },

    nodeTags() {
      return this.value.longhornVolume?.spec?.nodeSelector;
    },

    replicasNumber() {
      return this.value.longhornVolume?.spec?.numberOfReplicas;
    },

    lastBackup() {
      return this.value.longhornVolume?.status?.lastBackup;
    },

    lastBackupAt() {
      return this.value.longhornVolume?.status?.lastBackupAt;
    },

    rebuildStatus() {
      return this.value.longhornEngine?.status?.rebuildStatus;
    },

    isLHV2VolExpansionFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('lhV2VolExpansion');
    },

    isResizeDisabled() {
      return (
        !this.isLHV2VolExpansionFeatureEnabled &&
      this.value?.isLonghornV2 &&
      this.isEdit
      );
    },
  },

  watch: {
    'source'(neu) {
      if (neu === 'url') {
        this.setBlockVolumeMode();
        this.deleteVolumeForVmAnnotation();
      }
    },
    'value.spec.storageClassName'() {
      if (this.isLonghornStorageClass) {
        this.setBlockVolumeMode();
        this.deleteVolumeForVmAnnotation();
      }
    },
    'value.spec.volumeMode'(neu) {
      if (neu === VOLUME_MODE.FILE_SYSTEM) {
        this.setVolumeForVmAnnotation();
      } else if (neu === VOLUME_MODE.BLOCK ) {
        this.deleteVolumeForVmAnnotation();
      }
    }
  },

  methods: {
    setBlockVolumeMode() {
      this.value.spec.volumeMode = VOLUME_MODE.BLOCK;
    },

    setVolumeForVmAnnotation() {
      this.value.setAnnotation(HCI_ANNOTATIONS.VOLUME_FOR_VM, 'true');
    },

    deleteVolumeForVmAnnotation() {
      if (this.value?.metadata?.annotations?.[HCI_ANNOTATIONS.VOLUME_FOR_VM]) {
        delete this.value.metadata.annotations[HCI_ANNOTATIONS.VOLUME_FOR_VM];
      }
    },

    getAccessMode() {
      if (!this.longhornV2LVMSupport) {
        return ['ReadWriteMany'];
      }

      if (this.value?.spec?.accessModes && this.value?.spec?.accessModes?.length > 0) {
        return this.value.spec.accessModes;
      }

      const storageClassName = this.value.spec.storageClassName;
      const storageClass = this.storageClasses.find((sc) => sc.name === storageClassName);

      let readWriteOnce = this.value.isLvm || (!this.value.thirdPartyStorageFeatureEnabled && this.value.isLonghornV2);

      if (storageClass) {
        readWriteOnce = storageClass.provisioner === LVM_DRIVER || (!this.value.thirdPartyStorageFeatureEnabled && storageClass.parameters?.dataEngine === DATA_ENGINE_V2);
      }

      return readWriteOnce ? ['ReadWriteOnce'] : ['ReadWriteMany'];
    },
    willSave() {
      this.update();
    },
    update() {
      let imageAnnotations = '';
      let storageClassName = this.value.spec.storageClassName;

      if (this.isVMImage && this.imageId) {
        const images = this.$store.getters['harvester/all'](HCI.IMAGE);

        imageAnnotations = {
          ...this.value.metadata.annotations,
          [HCI_ANNOTATIONS.IMAGE_ID]: this.imageId
        };
        storageClassName = images?.find((image) => this.imageId === image.id)?.storageClassName;
      } else {
        imageAnnotations = { ...this.value.metadata.annotations };
      }

      const spec = {
        ...this.value.spec,
        resources:   { requests: { storage: this.storage } },
        storageClassName,
        accessModes: this.getAccessMode(),
      };

      this.value.setAnnotations(imageAnnotations);

      this.value['spec'] = spec;
    },
    updateImage() {
      if (this.isVMImage && this.imageId) {
        const imageResource = this.images?.find((image) => this.imageId === image.id);
        const imageSize = Math.max(imageResource?.status?.size, imageResource?.status?.virtualSize);

        if (imageSize) {
          this.storage = `${ Math.ceil(imageSize / 1024 / 1024 / 1024) }${ GIBIBYTE }`;
        }
      }
      this.update();
    },
    generateYaml() {
      const out = saferDump(this.value);

      return out;
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :generate-yaml="generateYaml"
    :apply-hooks="applyHooks"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :namespaced="true"
      :name-required="false"
      :mode="mode"
      @update:value="$emit('update:value', $event)"
    />

    <ResourceTabs
      v-model:value="value"
      class="mt-15"
      :need-conditions="false"
      :need-related="false"
      :side-tabs="true"
      :mode="mode"
    >
      <Tab
        name="basic"
        :label="t('harvester.volume.tabs.basics')"
        :weight="3"
        class="bordered-table"
      >
        <LabeledSelect
          v-model:value="source"
          :label="t('harvester.volume.source')"
          :options="sourceOption"
          :disabled="!isCreate"
          required
          :mode="mode"
          class="mb-20"
          @update:value="update"
        />

        <LabeledSelect
          v-if="isVMImage"
          v-model:value="imageId"
          :label="t('harvester.volume.image')"
          :options="imageOption"
          :disabled="!isCreate"
          required
          :mode="mode"
          class="mb-20"
          @update:value="updateImage"
        />

        <LabeledSelect
          v-if="isBlank"
          v-model:value="value.spec.storageClassName"
          :options="storageClassOptions"
          :label="t('harvester.storage.storageClass.label')"
          :mode="mode"
          class="mb-20"
          :disabled="!isCreate"
          @update:value="update"
        />

        <LabeledSelect
          v-if="showVolumeMode"
          v-model:value="value.spec.volumeMode"
          :label="t('harvester.volume.volumeMode')"
          :options="volumeModeOptions"
          required
          :disabled="!isCreate"
          :mode="mode"
          class="mb-20"
          @update:value="update"
        />

        <UnitInput
          v-model:value="storage"
          :label="t('harvester.volume.size')"
          :input-exponent="3"
          :output-modifier="true"
          :increment="1024"
          :mode="mode"
          :disabled="isResizeDisabled"
          required
          class="mb-20"
          :suffix="GIBIBYTE"
          @update:value="update"
        />

        <Banner
          v-if="isResizeDisabled"
          color="warning"
        >
          <span>{{ t('harvester.volume.longhorn.disableResize') }}</span>
        </Banner>
      </Tab>
      <Tab
        v-if="!isCreate"
        name="details"
        :label="t('harvester.volume.tabs.details')"
        :weight="2.5"
        class="bordered-table"
      >
        <LabeledInput
          v-model:value="frontendDisplay"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.frontend')"
        />
        <LabeledInput
          v-model:value="attachedNode"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.attachedNode')"
        />
        <LabeledInput
          v-model:value="endpoint"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.endpoint')"
        />
        <LabeledSelect
          v-model:value="diskTags"
          :multiple="true"
          :label="t('harvester.volume.diskTags')"
          :options="[]"
          :disabled="true"
          :mode="mode"
          class="mb-20"
        />
        <LabeledSelect
          v-model:value="nodeTags"
          :multiple="true"
          :label="t('harvester.volume.nodeTags')"
          :options="[]"
          :disabled="true"
          :mode="mode"
          class="mb-20"
        />
        <LabeledInput
          v-model:value="lastBackup"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.lastBackup')"
        />
        <LabeledInput
          v-model:value="lastBackupAt"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.lastBackupAt')"
        />
        <LabeledInput
          v-model:value="replicasNumber"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.replicasNumber')"
        />
      </Tab>
      <Tab
        v-if="!isCreate"
        name="instances"
        :label="t('harvester.volume.tabs.snapshots')"
        :weight="2"
        class="bordered-table"
      >
        <SortableTable
          v-bind="$attrs"
          :headers="snapshotHeaders"
          default-sort-by="age"
          :rows="value.relatedVolumeSnapshotCounts"
          key-field="_key"
        />
      </Tab>
      <Tab
        v-if="!isCreate && value.spec.dataSource"
        name="datasource"
        :label="t('harvester.volume.tabs.datasource')"
        :weight="1"
        class="bordered-table"
      >
        <LabeledInput
          v-model:value="dataSourceKind"
          class="mb-20"
          :mode="mode"
          :disabled="true"
          :label="t('harvester.volume.kind')"
        />
        <LabeledInput
          v-model:value="value.spec.dataSource.name"
          :mode="mode"
          :disabled="true"
          :label="t('nameNsDescription.name.label')"
        />
      </Tab>
      <Tab
        v-if="!isCreate"
        name="conditions"
        :label="t('harvester.volume.tabs.conditions')"
        class="bordered-table"
        :mode="mode"
      >
        <Conditions :value="value" />
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
