<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  name: 'HarvesterBackupModal',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    LabeledInput,
    LabeledSelect,
    Banner
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {
      backUpName:              '',
      errors:                  [],
      fsFreezeDeadline:        '10s',
      fsFreezeDeadlineOptions: [
        {
          label: this.t('generic.duration.infinite'),
          value: '0s'
        },
        {
          label: this.t('generic.duration.5s'),
          value: '5s'
        },
        {
          label: this.t('generic.duration.10s'),
          value: '10s'
        },
        {
          label: this.t('generic.duration.30s'),
          value: '30s'
        },
        {
          label: this.t('generic.duration.1m'),
          value: '1m'
        },
        {
          label: this.t('generic.duration.3m'),
          value: '3m'
        },
        {
          label: this.t('generic.duration.5m'),
          value: '5m'
        }
      ]
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    }
  },

  methods: {
    close() {
      this.backUpName = '';
      this.fsFreezeDeadline = '';
      this.$emit('close');
    },

    async save(buttonCb) {
      if (this.actionResource) {
        try {
          const res = await this.actionResource.doAction(
            'backup',
            { name: this.backUpName, fsFreezeDeadline: this.fsFreezeDeadline },
            {},
            false
          );

          if (res._status === 200 || res._status === 204) {
            this.$store.dispatch(
              'growl/success',
              {
                title:   this.t('generic.notification.title.succeed'),
                message: this.t('harvester.modal.backup.success', { backUpName: this.backUpName })
              },
              { root: true }
            );

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
    }
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      <h4
        v-clean-html="t('harvester.modal.backup.addBackup')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <LabeledInput
        v-model:value="backUpName"
        class="mt-20"
        :label="t('generic.name')"
        required
      />
      <LabeledSelect
        v-model:value="fsFreezeDeadline"
        class="mt-20"
        :options="fsFreezeDeadlineOptions"
        :label="t('harvester.modal.backup.fsFreezeDeadline')"
        required
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </template>

    <template #actions>
      <div class="actions">
        <div class="buttons">
          <button
            class="btn role-secondary mr-10"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </button>

          <AsyncButton
            mode="create"
            :disabled="!backUpName"
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
