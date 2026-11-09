<script>
import { STEVE } from '@shell/config/types';
import { stringify } from '@shell/utils/error';
import Banner from '@components/Banner/Banner.vue';
import { RcButton } from '@components/RcButton';
import { RcIcon } from '@components/RcIcon';
import { RcModal } from '@components/RcModal';
import RcTag from '@components/Pill/RcTag';
import { LabeledInput } from '@components/Form/LabeledInput';
import NovncKeyRecorder from './NovncKeyRecorder';
import { readShortcuts, shortcutId, shortcutLabels, writeShortcuts } from './shortcuts';

export default {
  name: 'NovncConsoleCustomKeys',

  components: {
    Banner, RcButton, RcIcon, RcModal, RcTag, LabeledInput, NovncKeyRecorder
  },

  props: {
    show: {
      type:    Boolean,
      default: false,
    },
  },

  emits: ['close'],

  data() {
    return {
      keys:   [],
      name:   '',
      saving: false,
      error:  '',
    };
  },

  computed: {
    preference() {
      return this.$store.getters['management/all'](STEVE.PREFERENCE)?.[0];
    },

    shortcuts() {
      return readShortcuts(this.preference).map((shortcut) => ({ ...shortcut, labels: shortcutLabels(shortcut) }));
    },

    isDuplicate() {
      const id = shortcutId({ keys: this.keys });

      return !!this.keys.length && this.shortcuts.some((shortcut) => shortcutId(shortcut) === id);
    },

    canAdd() {
      return !!this.keys.length && !this.isDuplicate;
    },
  },

  watch: {
    show(show) {
      if (!show) {
        this.error = '';
      }
    },
  },

  methods: {
    clear() {
      this.keys = [];
      this.name = '';
    },

    // The buttons stay enabled while a change saves: disabling the one that was pressed would drop the
    // keyboard's focus to the page.
    async add() {
      if (!this.canAdd || this.saving) {
        return;
      }

      const added = await this.save([...this.shortcuts, { name: this.name.trim(), keys: this.keys }]);

      // Add shortcut turns disabled with the form empty, so the recorder takes the focus for the next one.
      if (added) {
        this.clear();
        this.$nextTick(() => this.$refs.recorder?.$el?.focus());
      }
    },

    async remove(index) {
      if (this.saving) {
        return;
      }

      const removed = await this.save(this.shortcuts.filter((_, i) => i !== index));

      // The row may be gone with the button that had the focus: the delete button now in its place, or
      // the last one, takes it, and the recorder once the list is empty.
      if (removed) {
        this.$nextTick(() => {
          const buttons = this.$refs.list?.querySelectorAll('button') || [];

          (buttons[index] || buttons[buttons.length - 1] || this.$refs.recorder?.$el)?.focus();
        });
      }
    },

    // Every change is saved straight away, so closing the modal can never lose one.
    async save(shortcuts) {
      this.saving = true;
      this.error = '';

      try {
        await writeShortcuts(this.preference, shortcuts.map(({ name, keys }) => ({ name, keys })));

        return true;
      } catch (err) {
        // The console page has no growls, so the dialog says it itself.
        const title = this.t('harvester.virtualMachine.detail.console.customKeys.saveError');
        const reason = stringify(err);

        this.error = reason ? `${ title }: ${ reason }` : title;

        return false;
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <RcModal
    :show="show"
    size="medium"
    :title="t('harvester.virtualMachine.detail.console.customKeys.title')"
    data-testid="vnc-custom-keys-modal"
    @close="$emit('close')"
  >
    <Banner
      v-if="error"
      color="error"
      role="alert"
      data-testid="vnc-custom-keys-error"
    >
      {{ error }}
    </Banner>

    <p class="custom-keys__intro">
      {{ t('harvester.virtualMachine.detail.console.customKeys.description') }}
    </p>

    <section class="custom-keys__new">
      <h3 class="custom-keys__heading">
        {{ t('harvester.virtualMachine.detail.console.customKeys.new') }}
      </h3>

      <div class="custom-keys__field">
        <span
          id="vnc-key-combination-label"
          class="custom-keys__label"
        >{{ t('harvester.virtualMachine.detail.console.customKeys.combination') }}</span>
        <NovncKeyRecorder
          ref="recorder"
          v-model:value="keys"
          aria-labelledby="vnc-key-combination-label"
        />
        <p
          v-if="isDuplicate"
          class="custom-keys__error"
          role="alert"
        >
          {{ t('harvester.virtualMachine.detail.console.customKeys.duplicate') }}
        </p>
        <p class="custom-keys__help">
          {{ t('harvester.virtualMachine.detail.console.customKeys.reserved') }}
        </p>
      </div>

      <LabeledInput
        v-model:value="name"
        :label="t('harvester.virtualMachine.detail.console.customKeys.name')"
        data-testid="vnc-shortcut-name"
        @keyup.enter="add"
      />

      <div class="custom-keys__new-actions">
        <RcButton
          variant="secondary"
          :disabled="!keys.length && !name"
          @click="clear"
        >
          {{ t('harvester.virtualMachine.detail.console.customKeys.clear') }}
        </RcButton>
        <RcButton
          variant="primary"
          data-testid="vnc-add-shortcut"
          :disabled="!canAdd"
          @click="add"
        >
          {{ t('harvester.virtualMachine.detail.console.customKeys.add') }}
        </RcButton>
      </div>
    </section>

    <section v-if="shortcuts.length">
      <h3 class="custom-keys__heading">
        {{ t('harvester.virtualMachine.detail.console.customKeys.saved', { count: shortcuts.length }) }}
      </h3>
      <ul
        ref="list"
        class="custom-keys__list"
      >
        <li
          v-for="(shortcut, index) in shortcuts"
          :key="index"
          class="custom-keys__item"
          data-testid="vnc-custom-shortcut"
        >
          <span class="custom-keys__item-name">{{ shortcut.name || shortcut.labels.join('+') }}</span>
          <span class="custom-keys__item-keys">
            <RcTag
              v-for="(label, i) in shortcut.labels"
              :key="i"
              type="active"
            >
              {{ label }}
            </RcTag>
          </span>
          <RcButton
            variant="tertiary"
            :aria-label="t('harvester.virtualMachine.detail.console.customKeys.delete', { name: shortcut.name || shortcut.labels.join('+') }, true)"
            @click="remove(index)"
          >
            <RcIcon
              type="trash"
              size="inherit"
            />
          </RcButton>
        </li>
      </ul>
    </section>

    <template #actions="{ close }">
      <RcButton
        variant="primary"
        size="large"
        data-testid="vnc-custom-keys-done"
        @click="close"
      >
        {{ t('harvester.virtualMachine.detail.console.customKeys.done') }}
      </RcButton>
    </template>
  </RcModal>
</template>

<style lang="scss" scoped>
  .custom-keys {
    &__intro {
      margin: 0;
    }

    &__new {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 20px 20px;
      border: 1px solid var(--border);
      border-radius: 8px;
    }

    &__heading {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 700;
      line-height: 21px;

      .custom-keys__new & {
        margin: 0;
      }
    }

    &__field {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    &__label {
      color: var(--input-label);
      font-size: 14px;
      line-height: 21px;
    }

    &__help,
    &__error {
      margin: 0;
      font-size: 12px;
      line-height: 18px;
    }

    &__help {
      color: var(--muted);
    }

    &__error {
      color: var(--error);
    }

    &__new-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    &__item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 8px 12px 20px;
      border: 1px solid var(--border);
      border-radius: 8px;
    }

    &__item-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__item-keys {
      display: flex;
      gap: 6px;
    }
  }
</style>
