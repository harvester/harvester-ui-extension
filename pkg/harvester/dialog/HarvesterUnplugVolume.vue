<script>
import { mapState, mapGetters } from 'vuex';

import { exceptionToErrorsArray } from '@shell/utils/error';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';

export default {
  name: 'HarvesterHotUnplugModal',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    Banner
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return { errors: [] };
  },

  computed: {
    ...mapState('action-menu', ['modalData']),
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },
    diskName() {
      return this.modalData.diskName;
    }
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async save(buttonCb) {
      try {
        const res = await this.actionResource.doAction('removeVolume', { diskName: this.diskName });

        if (res._status === 200 || res._status === 204) {
          this.$store.dispatch(
            'growl/success',
            {
              title:   this.t('generic.notification.title.succeed'),
              message: this.t('harvester.modal.hotunplug.success', { name: this.diskName })
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
  <Card
    ref="modal"
    name="modal"
    :show-highlight-border="false"
  >
    <template #title>
      <h4
        v-clean-html="t('harvester.virtualMachine.unplug.title', { name: diskName })"
        class="text-default-text"
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
            type="button"
            class="btn role-secondary mr-10"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </button>

          <AsyncButton
            mode="apply"
            :action-label="t('harvester.virtualMachine.unplug.actionLabel')"
            :waiting-label="t('harvester.virtualMachine.unplug.actionLabel')"
            :success-label="t('harvester.virtualMachine.unplug.actionLabel')"
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
