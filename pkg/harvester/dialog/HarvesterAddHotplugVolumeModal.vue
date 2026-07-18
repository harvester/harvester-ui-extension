<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { sortBy } from '@shell/utils/sort';
import { mapGetters } from 'vuex';
import { PVC, STORAGE_CLASS, LONGHORN_DRIVER } from '@shell/config/types';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { VOLUME_MODE } from '@pkg/harvester/config/types';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Checkbox } from '@components/Form/Checkbox';

export default {
  name: 'HotplugVolumeModal',

  emits: ['close'],

  components: {
    AsyncButton, Card, LabeledInput, LabeledSelect, Banner, Checkbox
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    this.allPVCs = await this.$store.dispatch('harvester/findAll', { type: PVC });
    this.allStorageClasses = await this.$store.dispatch('harvester/findAll', { type: STORAGE_CLASS });
  },

  data() {
    return {
      diskName:          '',
      volumeName:        '',
      shareable:         false,
      errors:            [],
      allPVCs:           [],
      allStorageClasses: [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    PVCs() {
      return this.allPVCs.filter((P) => this.actionResource.metadata.namespace === P.metadata.namespace) || [];
    },

    actionResource() {
      return this.resources[0];
    },

    volumeOption() {
      return sortBy(
        this.PVCs
          .filter( (pvc) => {
            if (!!pvc.metadata?.annotations?.[HCI_ANNOTATIONS.IMAGE_ID]) {
              return false;
            }
            // we won't show golden image volume in the hot plug volume modal
            if (pvc.isGoldenImageVolume) {
              return false;
            }

            return true;
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

    selectedPVC() {
      return this.PVCs.find((P) => P.metadata.name === this.volumeName);
    },

    isShareableCapable() {
      const pvcSpec = this.selectedPVC?.spec;

      if (!pvcSpec) {
        return false;
      }

      const isRWX = (pvcSpec.accessModes || []).includes('ReadWriteMany');
      const isBlock = pvcSpec.volumeMode === VOLUME_MODE.BLOCK;
      const storageClass = this.allStorageClasses.find((sc) => sc.name === pvcSpec.storageClassName);

      // fail closed: without a resolved StorageClass the provisioner
      // requirement cannot be evaluated
      if (!storageClass) {
        return false;
      }

      return isRWX && isBlock && storageClass.provisioner !== LONGHORN_DRIVER;
    },
  },

  watch: {
    isShareableCapable(neu) {
      if (!neu) {
        this.shareable = false;
      }
    },
  },

  methods: {
    close() {
      this.diskName = '';
      this.volumeName = '';
      this.shareable = false;
      this.$emit('close');
    },

    async save(buttonCb) {
      if (this.actionResource) {
        try {
          const input = { volumeSourceName: this.volumeName, diskName: this.diskName };

          if (this.isShareableCapable && this.shareable) {
            input.shareable = true;
          }

          const res = await this.actionResource.doAction('addVolume', input, {}, false);

          if (res._status === 200 || res._status === 204) {
            this.$store.dispatch('growl/success', {
              title:   this.t('generic.notification.title.succeed'),
              message: this.t('harvester.modal.hotplugVolume.success', { diskName: this.diskName, vm: this.actionResource.nameDisplay })
            }, { root: true });

            this.close();
            buttonCb(true);
          } else {
            const error = [res?.data] || exceptionToErrorsArray(res);

            this['errors'] = error;
            buttonCb(false);
          }
        } catch (err) {
          const error = err?.data || err;
          const message = exceptionToErrorsArray(error);

          this['errors'] = message;
          buttonCb(false);
        }
      }
    },
  }
};
</script>

<template>
  <Card
    ref="modal"
    name="modal"
    :show-highlight-border="false"
  >
    <template #title>
      <h4
        v-clean-html="t('harvester.modal.hotplugVolume.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <LabeledInput
        v-model:value="diskName"
        :label="t('generic.name')"
        required
      />

      <LabeledSelect
        v-model:value="volumeName"
        :label="t('harvester.fields.volume')"
        :options="volumeOption"
        class="mt-20"
        required
      />
      <Checkbox
        v-if="isShareableCapable"
        v-model:value="shareable"
        class="mt-20"
        type="checkbox"
        label-key="harvester.virtualMachine.volume.shareable.label"
        tooltip-key="harvester.virtualMachine.volume.shareable.tip"
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        :label="err"
        color="error"
      />
    </template>

    <template #actions>
      <div class="actions">
        <div class="buttons">
          <button
            type="button"
            class="btn role-secondary mr-10"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </button>

          <AsyncButton
            mode="apply"
            :disabled="!diskName || !volumeName"
            @click="save"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style lang="scss" scoped>
.actions {
  width: 100%;
}

.buttons {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
