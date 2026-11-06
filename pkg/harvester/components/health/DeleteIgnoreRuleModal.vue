<script setup>
import { ref } from 'vue';
import { useStore } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { RcButton } from '@components/RcButton';
import { RcModal } from '@components/RcModal';
import { useI18n } from '@shell/composables/useI18n';
import { exceptionToErrorsArray } from '@shell/utils/error';

const props = defineProps({
  row: {
    type:     Object,
    required: true,
  },
  rule: {
    type:     Object,
    required: true,
  },
  // `show` and the `close` handler, from whoever owns this modal's visibility
  modal: {
    type:     Object,
    required: true,
  },
});

const store = useStore();
const { t } = useI18n(store);

const errors = ref([]);
const removing = ref(false);

function close() {
  // stays open while the rule is deleted, so a failure can still be shown
  if (!removing.value) {
    props.modal.onClose();
  }
}

async function remove() {
  errors.value = [];
  removing.value = true;

  try {
    await props.rule.remove();

    store.dispatch('growl/success', {
      title:   t('generic.notification.title.succeed'),
      message: t('harvester.dashboard.sections.componentHealth.ignore.deleted', { name: props.row.checkName }),
    }, { root: true });

    removing.value = false;
    close();
  } catch (err) {
    errors.value = exceptionToErrorsArray(err?.data || err);
    removing.value = false;
  }
}
</script>

<template>
  <!-- Not v-bind="modal": closing goes through close(), which refuses while the rule is deleted -->
  <RcModal
    :show="modal.show"
    :title="t('promptRemove.title')"
    size="small"
    class="delete-ignore-rule"
    data-testid="component-health-delete-rule-modal"
    @close="close"
    @primary-action="remove"
  >
    <p>
      {{ t('harvester.dashboard.sections.componentHealth.ignore.attemptingToDelete') }} <b>{{ row.checkName }}</b>. {{ t('harvester.dashboard.sections.componentHealth.ignore.reportedAgain') }}
    </p>
    <Banner
      v-for="(err, i) in errors"
      :key="i"
      class="m-0"
      color="error"
      :label="err"
    />

    <template #primary-action="{ primaryAction }">
      <RcButton
        variant="primary"
        size="large"
        class="delete-ignore-rule__confirm"
        :disabled="removing"
        :aria-busy="removing"
        data-testid="component-health-delete-rule-confirm"
        @click="primaryAction"
      >
        {{ t('generic.delete') }}
      </RcButton>
    </template>
  </RcModal>
</template>

<style lang="scss" scoped>
  .delete-ignore-rule {
    &__confirm.rc-button.variant-primary:not(:disabled) {
      background-color: var(--error);
      color: var(--error-text);

      &:hover, &:focus {
        background-color: var(--error-hover-bg);
        color: var(--error-hover-text);
      }
    }
  }
</style>
