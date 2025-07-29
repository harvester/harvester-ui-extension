<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { runStrategies as runStrategyOptions } from '../config/harvester-map';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import { Checkbox } from '@components/Form/Checkbox';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  name: 'CloneVMModal',

  emits: ['close'],

  components: {
    AsyncButton, Banner, Checkbox, Card, LabeledInput, LabeledSelect
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return {
      name:        '',
      cloneData:   true,
      errors:      [],
      runStrategy: runStrategyOptions[1],
      runStrategyOptions
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },
    vmCloneRunStrategyEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('vmCloneRunStrategy');
    },
  },

  methods: {
    close() {
      this.name = '';
      this.$emit('close');
    },

    async create(buttonCb) {
      // shadow clone
      if (!this.cloneData) {
        this.resources[0].goToClone();
        buttonCb(false);
        this.close();

        return;
      }

      // deep clone
      try {
        const payload = this.vmCloneRunStrategyEnabled ? { targetVm: this.name, runStrategy: this.runStrategy } : { targetVm: this.name };
        const res = await this.actionResource.doAction('clone', payload, {}, false);

        if (res._status === 200 || res._status === 204) {
          this.$store.dispatch('growl/success', {
            title:   this.t('harvester.notification.title.succeed'),
            message: this.t('harvester.modal.cloneVM.message.success', { name: this.name })
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
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      {{ t('harvester.modal.cloneVM.title') }}
    </template>

    <template #body>
      <Checkbox
        v-model:value="cloneData"
        class="mb-10"
        label-key="harvester.modal.cloneVM.type"
      />

      <LabeledInput
        v-show="cloneData"
        v-model:value="name"
        class="mb-20"
        :label="t('harvester.modal.cloneVM.name')"
        required
      />
      <LabeledSelect
        v-if="vmCloneRunStrategyEnabled"
        v-model:value="runStrategy"
        label-key="harvester.virtualMachine.runStrategy"
        :options="runStrategyOptions"
        :mode="mode"
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
          mode="create"
          :action-label="cloneData ? t('harvester.modal.cloneVM.action.create') : t('harvester.modal.cloneVM.action.clone')"
          :disabled="cloneData && !name"
          @click="create"
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
