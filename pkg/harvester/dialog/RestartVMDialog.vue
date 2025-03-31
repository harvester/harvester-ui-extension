<script>
import { mapGetters } from 'vuex';
import AsyncButton from '@shell/components/AsyncButton';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import { exceptionToErrorsArray } from '@shell/utils/error';
import AppModal from '@shell/components/AppModal';

export default {
  emits: ['close'],

  components: {
    AppModal,
    Card,
    AsyncButton,
    Banner,
  },
  props: {
    vm: {
      type:     Object,
      required: true
    },
  },
  data() {
    return { errors: [], resolve: null };
  },
  computed: { ...mapGetters({ t: 'i18n/t' }) },
  methods:  {
    close() {
      this.resolve();
      this.$emit('close');
    },
    apply(buttonDone) {
      try {
        this.vm.doActionGrowl('restart', {});
        buttonDone(true);
        this.close();
      } catch (err) {
        console.error(err); // eslint-disable-line
        this.errors = exceptionToErrorsArray(err);
        buttonDone(false);
      }
    }
  }
};
</script>

<template>
  <app-modal
    class="restart-modal"
    name="restartDialog"
    :width="600"
    height="auto"
    :click-to-close="false"
    @close="close"
  >
    <Card
      class="prompt-restart"
      :show-highlight-border="false"
    >
      <template #title>
        <h4
          v-clean-html="t('harvester.modal.restart.title')"
          class="text-default-text"
        />
      </template>

      <template #body>
        <div
          v-clean-html="t('harvester.modal.restart.tip')"
          class="pl-10 pr-10"
        />
        <Banner
          v-for="(err, i) in errors"
          :key="i"
          color="error"
          :label="err"
        />
      </template>

      <template #actions>
        <div class="bottom">
          <div class="buttons">
            <button
              class="btn role-secondary mr-10"
              @click="close"
            >
              {{ t('harvester.modal.restart.cancel') }}
            </button>

            <AsyncButton
              mode="restart"
              @click="apply"
            />
          </div>
        </div>
      </template>
    </Card>
  </app-modal>
</template>
<style lang='scss' scoped>
  .restart-modal {
    z-index: 45;
  }
  .prompt-restart {
    margin: 0;
  }
  .bottom {
    display: flex;
    flex-direction: column;
    flex: 1;
    .banner {
      margin-top: 0
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      width: 100%;
    }
  }
</style>
