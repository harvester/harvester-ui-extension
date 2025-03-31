<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';

export default {
  name: 'HarvesterBackupModal',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    LabeledInput,
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
      backUpName: '',
      errors:     []
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
      this.$emit('close');
    },

    async save(buttonCb) {
      if (this.actionResource) {
        try {
          const res = await this.actionResource.doAction(
            'backup',
            { name: this.backUpName },
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
        :label="t('generic.name')"
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
