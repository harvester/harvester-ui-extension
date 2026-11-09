<script>
import { mapGetters } from 'vuex';
import Banner from '@components/Banner/Banner.vue';
import { exceptionToErrorsArray } from '@shell/utils/error';

export default {
  name: 'PromptRemoveHealthIgnoreRuleDialog',

  components: { Banner },

  // the prompt binds all of its own data to this body, none of it belongs on the element
  inheritAttrs: false,

  props: {
    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    close: {
      type:     Function,
      required: true
    },
  },

  data() {
    return { errors: [] };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    // a rule's name means little, the check it is for is what the user knows
    checkNames() {
      return this.value.map((rule) => rule.spec?.checkKey).join(', ');
    },
  },

  methods: {
    // the prompt does not show the errors of a body that removes by itself
    async remove(buttonDone) {
      try {
        await Promise.all(this.value.map((rule) => rule.remove()));
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
      {{ t('harvester.dashboard.sections.componentHealth.ignore.attemptingToDelete') }} <b>{{ checkNames }}</b>. {{ t('harvester.dashboard.sections.componentHealth.ignore.reportedAgain') }}
    </div>
    <Banner
      v-for="(error, i) in errors"
      :key="i"
      color="error"
      :label="error"
    />
  </div>
</template>
