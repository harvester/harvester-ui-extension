<script>
import { mapGetters } from 'vuex';

import { PVC } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { sortBy } from '@shell/utils/sort';
import { HCI } from '../types';
import { parseVolumeClaimTemplates } from '@pkg/harvester/utils/vm';

import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  name: 'HarvesterStorageMigrationDialog',

  emits: ['close'],

  components: {
    AsyncButton, Banner, Card, LabeledSelect
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    this.allPVCs = await this.$store.dispatch('harvester/findAll', { type: PVC });
  },

  data() {
    return {
      sourceVolume: '',
      targetVolume: '',
      errors:       [],
      allPVCs:      [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },

    sourceVolumeOptions() {
      const volumes = this.actionResource.spec?.template?.spec?.volumes || [];

      return sortBy(
        volumes
          .map((v) => v.persistentVolumeClaim?.claimName || v.dataVolume?.name)
          .filter((name) => !!name)
          .map((name) => ({
            label: name,
            value: name
          })),
        'label'
      );
    },

    namespacePVCs() {
      return this.allPVCs.filter((pvc) => pvc.metadata.namespace === this.actionResource.metadata.namespace);
    },

    vmUsedVolumeNames() {
      const allVMs = this.$store.getters['harvester/all'](HCI.VM) || [];
      const names = new Set();

      allVMs.forEach((vm) => {
        // Collect volume names from spec.template.spec.volumes (both PVC and DataVolume references)
        const volumes = vm.spec?.template?.spec?.volumes || [];

        volumes.forEach((v) => {
          const name = v.persistentVolumeClaim?.claimName || v.dataVolume?.name;

          if (name) {
            names.add(`${ vm.metadata.namespace }/${ name }`);
          }
        });

        // Collect volume names from volumeClaimTemplates annotation
        const templates = parseVolumeClaimTemplates(vm);

        templates.forEach((t) => {
          if (t.metadata?.name) {
            names.add(`${ vm.metadata.namespace }/${ t.metadata.name }`);
          }
        });
      });

      return names;
    },

    targetVolumeOptions() {
      return sortBy(
        this.namespacePVCs
          .filter((pvc) => {
            // Exclude volumes used by any VM (via spec.volumes or volumeClaimTemplates)
            if (this.vmUsedVolumeNames.has(`${ pvc.metadata.namespace }/${ pvc.metadata.name }`)) {
              return false;
            }

            return true;
          })
          .map((pvc) => ({
            label: pvc.metadata.name,
            value: pvc.metadata.name
          })),
        'label'
      );
    },

    disableSave() {
      return !this.sourceVolume || !this.targetVolume;
    },
  },

  methods: {
    close() {
      this.sourceVolume = '';
      this.targetVolume = '';
      this.errors = [];
      this.$emit('close');
    },

    async apply(buttonDone) {
      if (!this.actionResource) {
        buttonDone(false);

        return;
      }

      if (!this.sourceVolume) {
        const name = this.t('harvester.modal.storageMigration.fields.sourceVolume.label');

        this['errors'] = [this.t('validation.required', { key: name })];
        buttonDone(false);

        return;
      }

      if (!this.targetVolume) {
        const name = this.t('harvester.modal.storageMigration.fields.targetVolume.label');

        this['errors'] = [this.t('validation.required', { key: name })];
        buttonDone(false);

        return;
      }

      try {
        await this.actionResource.doAction('storageMigration', {
          sourceVolume: this.sourceVolume,
          targetVolume: this.targetVolume
        }, {}, false);

        buttonDone(true);
        this.close();
      } catch (err) {
        const error = err?.data || err;

        this['errors'] = exceptionToErrorsArray(error);
        buttonDone(false);
      }
    },
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      {{ t('harvester.modal.storageMigration.title') }}
    </template>

    <template #body>
      <LabeledSelect
        v-model:value="sourceVolume"
        :label="t('harvester.modal.storageMigration.fields.sourceVolume.label')"
        :placeholder="t('harvester.modal.storageMigration.fields.sourceVolume.placeholder')"
        :options="sourceVolumeOptions"
        class="mb-20"
        required
      />

      <LabeledSelect
        v-model:value="targetVolume"
        :label="t('harvester.modal.storageMigration.fields.targetVolume.label')"
        :placeholder="t('harvester.modal.storageMigration.fields.targetVolume.placeholder')"
        :options="targetVolumeOptions"
        required
      />

      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </template>

    <template
      #actions
      class="actions"
    >
      <div class="buttons">
        <button
          class="btn role-secondary mr-10"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>

        <AsyncButton
          mode="apply"
          :disabled="disableSave"
          @click="apply"
        />
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
