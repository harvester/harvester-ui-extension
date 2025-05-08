<script>
import { mapState } from 'vuex';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { alternateLabel } from '@shell/utils/platform';
import AsyncButton from '@shell/components/AsyncButton';
import { Banner } from '@components/Banner';
import { Card } from '@components/Card';
import { escapeHtml } from '@shell/utils/string';

/**
 * @name ConfirmExecutionDialog
 * @description Dialog component to confirm the related resources before executing the action.
 */
export default {
  name: 'ConfirmExecutionDialog',

  emits: ['close'],

  components: {
    AsyncButton,
    Banner,
    Card,
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
    return { errors: [] };
  },

  computed: {
    ...mapState('action-menu', ['modalData']),

    warningMessageKey() {
      return this.modalData.warningMessageKey;
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

    plusMore() {
      const remaining = this.resources.length - this.names.length;

      return this.t('dialog.confirmExecution.andOthers', { count: remaining }, true);
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

    protip() {
      return this.t('dialog.confirmExecution.protip', { alternateLabel });
    },
  },

  methods: {
    escapeHtml,

    close() {
      this.errors = [];
      this.$emit('close');
    },

    async apply(buttonDone) {
      try {
        for (const resource of this.resources) {
          await resource.doActionGrowl(this.modalData.action, {});
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
  <Card :show-highlight-border="false">
    <template #title>
      <h4 class="text-default-text">
        {{ t('dialog.confirmExecution.title') }}
      </h4>
    </template>

    <template #body>
      <div class="pl-10 pr-10">
        <span
          v-clean-html="t(warningMessageKey, { type, names: resourceNames }, true)"
        ></span>
        <div class="text-info mt-20">
          {{ protip }}
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
      <div class="actions">
        <button
          class="btn role-secondary"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>
        <AsyncButton
          mode="apply"
          class="btn bg-primary ml-10"
          :disabled="applyDisabled"
          @click="apply"
        />
      </div>
    </template>
  </Card>
</template>

<style lang='scss' scoped>
  .modal-container {
    max-width: 400px;
  }

  .actions {
    width: 100%;
    text-align: right;
  }
</style>
