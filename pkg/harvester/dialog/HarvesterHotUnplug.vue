<script>
import { mapState, mapGetters } from 'vuex';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';

export default {
  name: 'HarvesterHotUnplug',

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

    name() {
      return this.modalData.name;
    },

    isVolume() {
      return this.modalData.type === 'volume';
    },

    titleKey() {
      return this.isVolume ? 'harvester.virtualMachine.hotUnplug.detachVolume.title' : 'harvester.virtualMachine.hotUnplug.detachNIC.title';
    },

    actionLabelKey() {
      return this.isVolume ? 'harvester.virtualMachine.hotUnplug.detachVolume.actionLabel' : 'harvester.virtualMachine.hotUnplug.detachNIC.actionLabel';
    },

    successMessageKey() {
      return this.isVolume ? 'harvester.virtualMachine.hotUnplug.detachVolume.success' : 'harvester.virtualMachine.hotUnplug.detachNIC.success';
    }
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async save(buttonCb) {
      try {
        let res;

        if (this.isVolume) {
          res = await this.actionResource.doAction('removeVolume', { diskName: this.name });
        } else {
          res = await this.actionResource.doAction('removeNic', { interfaceName: this.name });
        }

        if (res._status === 200 || res._status === 204) {
          this.$store.dispatch(
            'growl/success',
            {
              title:   this.t('generic.notification.title.succeed'),
              message: this.t(this.successMessageKey, { name: this.name })
            },
            { root: true }
          );

          this.close();
          buttonCb(true);
        } else {
          const error = [res?.data] || exceptionToErrorsArray(res);

          this.errors = error;
          buttonCb(false);
        }
      } catch (err) {
        const error = err?.data || err;
        const message = exceptionToErrorsArray(error);

        this.errors = message;
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
        v-clean-html="t(titleKey, { name })"
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
            :action-label="t(actionLabelKey)"
            :waiting-label="t(actionLabelKey)"
            :success-label="t(actionLabelKey)"
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

::v-deep(.card-title) {
  display: block;
}
</style>
