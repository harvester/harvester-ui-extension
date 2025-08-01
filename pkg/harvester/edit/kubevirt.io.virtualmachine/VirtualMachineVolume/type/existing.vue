<script>
import UnitInput from '@shell/components/form/UnitInput';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabelValue from '@shell/components/LabelValue';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import InputOrDisplay from '@shell/components/InputOrDisplay';
import { Banner } from '@components/Banner';
import { sortBy } from '@shell/utils/sort';
import { PVC } from '@shell/config/types';
import { _CREATE } from '@shell/config/query-params';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { HCI } from '../../../../types';
import { VOLUME_TYPE, InterfaceOption } from '../../../../config/harvester-map';
import { GIBIBYTE } from '../../../../utils/unit';

export default {
  name: 'HarvesterEditExisting',

  emits: ['update'],

  components: {
    UnitInput, LabeledInput, LabeledSelect, InputOrDisplay, LabelValue, Banner
  },

  props: {
    mode: {
      type:    String,
      default: _CREATE
    },

    value: {
      type:     Object,
      required: true
    },

    isEdit: {
      type:    Boolean,
      default: false
    },

    namespace: {
      type:    String,
      default: null
    },

    idx: {
      type:    Number,
      default: 0
    },

    rows: {
      type:     Array,
      required: true
    },
  },

  data() {
    if (this.value.realName) {
      this.value.volumeName = this.value.realName;
    }

    return {
      GIBIBYTE,
      VOLUME_TYPE,
      InterfaceOption,
      loading: false,
    };
  },

  computed: {
    isDisabled() {
      return !this.value.newCreateId && this.isEdit;
    },

    allPVCs() {
      const allPVCs = this.$store.getters['harvester/all'](PVC);

      return allPVCs.filter((P) => {
        return this.namespace ? this.namespace === P.metadata.namespace : true;
      }) || [];
    },

    image() {
      const imageResource = this.$store.getters['harvester/all'](HCI.IMAGE).find((I) => I.id === this.pvcResource?.metadata?.annotations?.[HCI_ANNOTATIONS.IMAGE_ID]);

      if (!imageResource) {
        return;
      }

      return `${ imageResource.metadata.namespace }/${ imageResource.spec.displayName }`;
    },

    pvcResource() {
      return this.allPVCs.find( (P) => P.metadata.name === this.value.volumeName );
    },

    volumeOption() {
      return sortBy(
        this.allPVCs
          .filter( (pvc) => {
            let isAvailable = true;
            let isBeingUsed = false;

            this.rows.forEach( (O) => {
              if (O.volumeName === pvc.metadata.name) {
                isAvailable = false;
              }
            });

            if (this.idx === 0 && !pvc.metadata?.annotations?.[HCI_ANNOTATIONS.IMAGE_ID]) {
              return false;
            }

            if (pvc.isGoldenImageVolume) {
              return false;
            }

            if (pvc.attachVM && isAvailable && pvc.attachVM?.id === this.vm?.id && this.isEdit) {
              isBeingUsed = false;
            } else if (pvc.attachVM) {
              isBeingUsed = true;
            }

            return isAvailable && !isBeingUsed && pvc.isAvailable;
          })
          .map((pvc) => {
            return {
              label: pvc.metadata.name,
              value: pvc.metadata.name
            };
          }),
        'label'
      );
    },
  },

  watch: {
    'value.volumeName'(neu) {
      const pvcResource = this.allPVCs.find( (P) => P.metadata.name === neu);

      if (!pvcResource) {
        return;
      }

      // update this.value with existing volume spec, then update to upstream component
      this.value.accessModes = pvcResource.spec.accessModes[0];
      this.value.size = pvcResource.spec.resources.requests.storage;
      this.value.storageClassName = pvcResource.spec.storageClassName;
      this.value.volumeMode = pvcResource.spec.volumeMode;
      this.update();
    },

    'value.type'(neu) {
      if (neu === 'cd-rom') {
        this.value['bus'] = 'sata';
        this.update();
      }
    },

    pvcResource: {
      handler(pvc) {
        if (!this.value.volumeName && pvc?.metadata?.name) {
          this.value.volumeName = pvc.metadata.name;
        }
      },
      deep:      true,
      immediate: true
    },
  },

  methods: {
    update() {
      this.$emit('update');
    },
  }
};
</script>

<template>
  <div>
    <div class="row mb-20">
      <div
        data-testid="input-hee-name"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.name')"
          :value="value.name"
          :mode="mode"
        >
          <LabeledInput
            v-model:value="value.name"
            :label="t('harvester.fields.name')"
            :mode="mode"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>

      <div
        data-testid="input-hee-type"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.type')"
          :value="value.type"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.type"
            :label="t('harvester.fields.type')"
            :mode="mode"
            :options="VOLUME_TYPE"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
    </div>

    <div class="row mb-20">
      <div
        data-testid="input-hee-volumeName"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.volume')"
          :value="value.volumeName"
          :mode="mode"
        >
          <LabeledSelect
            v-model:value="value.volumeName"
            :disabled="isDisabled"
            :label="t('harvester.fields.volume')"
            :mode="mode"
            :options="volumeOption"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>

      <div
        data-testid="input-hee-size"
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
            :disabled="true"
            :suffix="GIBIBYTE"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
    </div>

    <div class="row mb-20">
      <div
        v-if="!!image"
        data-testid="input-hee-image"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.fields.image')"
          :value="image"
          :mode="mode"
        >
          <LabeledInput
            v-model:value="image"
            :label="t('harvester.fields.image')"
            :mode="mode"
            :disabled="true"
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
      <div
        data-testid="input-hee-bus"
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
            :disabled="true"
            required
            @update:value="update"
          />
        </InputOrDisplay>
      </div>
      <div
        v-if="value.volumeBackups"
        class="col span-6"
      >
        <InputOrDisplay
          :name="t('harvester.virtualMachine.volume.readyToUse')"
          :value="value.volumeBackups.readyToUse"
          :mode="mode"
        >
          <LabelValue
            :name="t('harvester.virtualMachine.volume.readyToUse')"
            :value="value.volumeBackups.readyToUse"
          />
        </InputOrDisplay>
      </div>
    </div>
    <Banner
      v-if="value.volumeBackups && value.volumeBackups.error && value.volumeBackups.error.message"
      color="error"
      class="mb-20"
      :label="value.volumeBackups.error.message"
    />
  </div>
</template>
