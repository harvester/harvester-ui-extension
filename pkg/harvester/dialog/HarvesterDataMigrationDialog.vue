<script>
import { mapGetters } from 'vuex';

import { STORAGE_CLASS } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { sortBy } from '@shell/utils/sort';
import { isInternalStorageClass } from '../utils/storage-class';

import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import { LabeledInput } from '@components/Form/LabeledInput';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  name: 'HarvesterDataMigrationDialog',

  emits: ['close'],

  components: {
    AsyncButton, Banner, Card, LabeledInput, LabeledSelect
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    this.storageClasses = await this.$store.dispatch('harvester/findAll', { type: STORAGE_CLASS });
  },

  data() {
    return {
      targetVolumeName:       '',
      targetStorageClassName: '',
      errors:                 [],
      storageClasses:         [],
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },

    storageClassOptions() {
      return sortBy(
        this.storageClasses
          .filter((sc) => !isInternalStorageClass(sc.metadata?.name))
          .map((sc) => ({
            label: sc.metadata?.name,
            value: sc.metadata?.name
          })),
        'label'
      );
    },

    disableSave() {
      return !this.targetVolumeName || !this.targetStorageClassName;
    },
  },

  methods: {
    close() {
      this.targetVolumeName = '';
      this.targetStorageClassName = '';
      this.errors = [];
      this.$emit('close');
    },

    async apply(buttonDone) {
      if (!this.actionResource) {
        buttonDone(false);

        return;
      }

      if (!this.targetVolumeName) {
        const name = this.t('harvester.modal.dataMigration.fields.targetVolumeName.label');

        this['errors'] = [this.t('validation.required', { key: name })];
        buttonDone(false);

        return;
      }

      if (!this.targetStorageClassName) {
        const name = this.t('harvester.modal.dataMigration.fields.targetStorageClassName.label');

        this['errors'] = [this.t('validation.required', { key: name })];
        buttonDone(false);

        return;
      }

      try {
        await this.actionResource.doAction('dataMigration', {
          targetVolumeName:       this.targetVolumeName,
          targetStorageClassName: this.targetStorageClassName
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
      {{ t('harvester.modal.dataMigration.title') }}
    </template>

    <template #body>
      <LabeledInput
        v-model:value="targetVolumeName"
        :label="t('harvester.modal.dataMigration.fields.targetVolumeName.label')"
        :placeholder="t('harvester.modal.dataMigration.fields.targetVolumeName.placeholder')"
        class="mb-20"
        required
      />

      <LabeledSelect
        v-model:value="targetStorageClassName"
        :label="t('harvester.modal.dataMigration.fields.targetStorageClassName.label')"
        :placeholder="t('harvester.modal.dataMigration.fields.targetStorageClassName.placeholder')"
        :options="storageClassOptions"
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
