<script>
import { resourceNames } from '@shell/utils/string';
import { mapGetters, mapState } from 'vuex';
import { BACKUP_TYPE } from '@pkg/harvester/config/types';
import { HCI } from '../types';
import { exceptionToErrorsArray } from '@shell/utils/error';

export default {
  name: 'PromptRemoveVMBackupDialog',

  emits: ['errors'],

  props: {
    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    names: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    type: {
      type:     String,
      required: true
    },

    close: {
      type:     Function,
      required: true
    },

    doneLocation: {
      type:    Object,
      default: () => {}
    }
  },

  data() {
    return { errors: [] };
  },

  computed: {
    ...mapState('action-menu', ['toRemove']),
    ...mapGetters({ t: 'i18n/t' }),
    resourceType() {
      const isSnapshot = this.value?.[0]?.spec?.type === BACKUP_TYPE.SNAPSHOT;
      const count = this.names?.length || 1;

      if (isSnapshot) {
        return this.t(`typeLabel."${ HCI.VM_SNAPSHOT }"`, { count });
      }

      return this.t(`typeLabel."${ HCI.BACKUP }"`, { count });
    },
  },
  methods: {
    resourceNames,
    async remove(buttonDone) {
      try {
        await Promise.all(this.value.map((resource) => resource.remove()));
        this.close(buttonDone);
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        buttonDone(false);
      }
    }
  }
};
</script>

<template>
  <div class="mt-10">
    <div class="mb-5">
      {{ t('promptRemove.attemptingToRemove', { type: resourceType }) }} <span
        v-clean-html="resourceNames(names, null, t)"
      />
    </div>
    <Banner
      v-for="(error, i) in errors"
      :key="i"
      class=""
      color="error"
      :label="error"
    />
  </div>
</template>
