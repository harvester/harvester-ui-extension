<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';

import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import { Checkbox } from '@components/Form/Checkbox';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';

export default {
  name: 'HarvesterCloneTemplateModal',

  emits: ['close'],

  components: {
    AsyncButton,
    Banner,
    Card,
    Checkbox,
    LabeledInput
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {
      templateName: '',
      description:  '',
      withData:     false,
      errors:       []
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
      this.templateName = '';
      this.description = '';
      this.$emit('close');
    },

    async save(buttonCb) {
      try {
        const res = await this.actionResource.doAction(
          'createTemplate',
          {
            name: this.templateName, description: this.description, withData: this.withData
          },
          {},
          false
        );

        if (res._status === 200 || res._status === 204) {
          this.$store.dispatch(
            'growl/success',
            {
              title:   this.t('generic.notification.title.succeed'),
              message: this.t(
                'harvester.modal.createTemplate.message.success',
                { templateName: this.templateName }
              )
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
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      {{ t('harvester.modal.createTemplate.title') }}
    </template>

    <template #body>
      <Checkbox
        v-model:value="withData"
        class="mb-10"
        label="With Data"
      />

      <LabeledInput
        v-model:value="templateName"
        class="mb-20"
        :label="t('harvester.modal.createTemplate.name')"
        required
      />

      <LabeledInput
        v-model:value="description"
        :label="t('harvester.modal.createTemplate.description')"
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
            :disabled="!templateName"
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
