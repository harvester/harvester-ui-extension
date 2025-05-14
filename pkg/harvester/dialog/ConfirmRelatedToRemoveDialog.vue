<script>
import { mapState } from 'vuex';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { alternateLabel } from '@shell/utils/platform';
import AsyncButton from '@shell/components/AsyncButton';
import { Banner } from '@components/Banner';
import { Card } from '@components/Card';
import { escapeHtml } from '@shell/utils/string';
import CopyToClipboardText from '@shell/components/CopyToClipboardText';

/**
 * @name ConfirmRelatedToRemoveDialog
 * @description Dialog component to confirm the related resources before removing the resource.
 */
export default {
  name: 'ConfirmRelatedToRemoveDialog',

  emits: ['close'],

  components: {
    AsyncButton,
    Banner,
    Card,
    CopyToClipboardText
  },

  props: {
    /**
     * @property resources to be deleted.
     * @type {Resource[]} Array of the resource model's instance
     */
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return { errors: [], confirmName: '' };
  },

  computed: {
    ...mapState('action-menu', ['modalData']),

    title() {
      return this.modalData.title || 'dialog.promptRemove.title';
    },

    formattedType() {
      return this.type.toLowerCase();
    },

    warningMessage() {
<<<<<<< HEAD
      if (this.modalData.warningMessage) return this.modalData.warningMessage;
=======
      if (this.modalData.warningMessage) return this.t(this.modalData.warningMessage);
>>>>>>> 2584768 (refactor: the promptRemove.confirmRelatedResource message needs to be refactored (#293))

      const isPlural = this.type.endsWith('s');
      const thisOrThese = isPlural ? 'these' : 'this';
      const defaultMessage = this.t('dialog.promptRemove.warningMessage', {
        type: this.formattedType,
        thisOrThese,
      });

      return defaultMessage;
    },

    names() {
      return this.resources.map((obj) => obj.nameDisplay).slice(0, 5);
    },

    resourceNames() {
      return this.names.reduce((res, name, i) => {
        if (i >= 5) {
          return res;
        }
        res += `<b>${ escapeHtml(name) }</b>`;
        if (i === this.names.length - 1) {
          res += this.plusMore;
        } else {
          res += i === this.resources.length - 2 ? ' and ' : ', ';
        }

        return res;
      }, '');
    },

    nameToMatch() {
      return this.resources[0].nameDisplay;
    },

    needConfirmation() {
      const { needConfirmation = true } = this.modalData ;

      return needConfirmation === true;
    },

    plusMore() {
      const remaining = this.resources.length - this.names.length;

      return this.t('promptRemove.andOthers', { count: remaining });
    },

    type() {
      const types = new Set(this.resources.reduce((array, each) => {
        array.push(each.type);

        return array;
      }, []));

      if (types.size > 1) {
        return this.t('generic.resource', { count: this.resources.length });
      }

      const schema = this.resources[0]?.schema;

      if ( !schema ) {
        return `resource${ this.resources.length === 1 ? '' : 's' }`;
      }

      return this.$store.getters['type-map/labelFor'](schema, this.resources.length);
    },

    deleteDisabled() {
      if (!this.needConfirmation) {
        return false;
      }

      return this.confirmName !== this.nameToMatch;
    },

    protip() {
      return this.t('dialog.promptRemove.protip', { alternateLabel });
    },
  },

  methods: {
    escapeHtml,

    close() {
      this.confirmName = '';
      this.errors = [];
      this.$emit('close');
    },

    async remove(buttonDone) {
      try {
        for (const resource of this.resources) {
          await resource.remove();
        }
        buttonDone(true);
        this.close();
      } catch (e) {
        this.errors = exceptionToErrorsArray(e);
        buttonDone(false);
      }
    }
  }
};
</script>

<template>
  <Card
    class="prompt-related"
    :show-highlight-border="false"
  >
    <template #title>
      <h4 class="text-default-text">
        {{ t(title, { type }, true) }}
      </h4>
    </template>

    <template #body>
      <div class="pl-10 pr-10">
        <span
          v-clean-html="warningMessage"
        ></span>

<<<<<<< HEAD
        <div
          v-if="needConfirmation"
          class="mt-20"
        >
          <div class="mt-10 mb-10">
            <span
              v-clean-html="t('dialog.promptRemove.confirmName', {
                type: formattedType,
                nameToMatch: escapeHtml(nameToMatch)
              }, true)"
            ></span>
          </div>
          <div class="mb-10">
            <CopyToClipboardText :text="nameToMatch" />
          </div>
          <input
            id="confirm"
            v-model="confirmName"
            type="text"
          />
          <div class="text-info mt-20">
            {{ protip }}
          </div>
=======
        <div class="mt-10 mb-10">
          <span
            v-clean-html="t('dialog.promptRemove.confirmName', {
              type: formattedType,
              nameToMatch: escapeHtml(nameToMatch)
            }, true)"
          ></span>
        </div>
        <div class="mb-10">
          <CopyToClipboardText :text="nameToMatch" />
        </div>
        <input
          id="confirm"
          v-model="confirmName"
          type="text"
        />
        <div class="text-info mt-20">
          {{ protip }}
>>>>>>> 2584768 (refactor: the promptRemove.confirmRelatedResource message needs to be refactored (#293))
        </div>
        <Banner
          v-for="(error, i) in errors"
          :key="i"
          :label="error"
          color="error"
        />
      </div>
    </template>

    <template #actions>
      <button
        class="btn role-secondary mr-10"
        @click="close"
      >
        {{ t('generic.cancel') }}
      </button>
      <AsyncButton
        mode="delete"
        class="btn bg-error ml-10"
        :disabled="deleteDisabled"
        @click="remove"
      />
    </template>
  </Card>
</template>

<style lang='scss' scoped>
  .actions {
    text-align: right;
  }
</style>
