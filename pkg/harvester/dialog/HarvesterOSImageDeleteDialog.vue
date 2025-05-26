<script>
import { mapGetters, mapState } from 'vuex';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../types';

export default {
  name: 'HarvesterOSImageDeleteDialog',

  components: {
    AsyncButton,
    Card,
    Banner
  },

  props: {
    resources: {
      type:     Array,
      required: true
    },
  },

  data() {
    return { errors: [] };
  },

  computed: {
    ...mapState('action-menu', ['modalData']),
    ...mapGetters({ t: 'i18n/t' }),

    image() {
      return this.resources[0] || {};
    },

    imageName() {
      return this.image?.displayName || '';
    },
  },

  methods: {
    close() {
      this.$emit('close');
    },

    async deleteImage(buttonDone) {
      try {
        const url = `/v1/harvester/${ HCI.IMAGE }s/${ this.image.id }`;

        await this.$store.dispatch('harvester/request', {
          url,
          method: 'DELETE',
        });
        buttonDone(true);
        this.close();
      } catch (err) {
        const error = err?.data || err;

        this.errors = exceptionToErrorsArray(error);
        buttonDone(false);
      }
    },
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      <h4
        v-clean-html="t('harvester.modal.osImage.title')"
        class="text-default-text"
      />
    </template>
    <template #body>
      <p class="text-default-text">
        {{ t('harvester.modal.osImage.message', { name: imageName }) }}
      </p>
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        :label="err"
        color="error"
      />
    </template>
    <template #actions>
      <div class="actions">
        <button
          class="btn role-secondary mr-10"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>
        <AsyncButton
          mode="delete"
          class="btn bg-error ml-10"
          @click="deleteImage"
        />
      </div>
    </template>
  </Card>
</template>

<style lang="scss" scoped>
.actions {
  width: 100%;
   display: flex;
  justify-content: flex-end;
}

</style>
