<script>
import { mapGetters } from 'vuex';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../types';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import AppModal from '@shell/components/AppModal';

export default {
  name: 'HarvesterImageDownloaderDialog',

  emits: ['close'],

  components: {
    AsyncButton, Banner, Card, AppModal
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    return { errors: [], isOpen: false };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    downloadImageInProgress() {
      return this.$store.getters['harvester-common/isDownloadImageInProgress'];
    },

    image() {
      return this.resources[0] || {};
    },

    imageName() {
      return this.image?.name || '';
    },

    imageVirtualSize() {
      return this.image?.virtualSize || this.image?.downSize || '';
    }
  },

  methods: {
    async cancelDownload() {
      const url = this.image?.links?.downloadcancel;

      if (url) {
        await this.$store.dispatch('harvester/request', { url });
      }
    },

    async close() {
      if (this.downloadImageInProgress) {
        this.$store.commit('harvester-common/setDownloadImageCancel', true);
        this.$store.commit('harvester-common/setDownloadImageInProgress', false);
        await this.cancelDownload();
      }
      this.$emit('close');
    },

    async startDownload(buttonCb) {
      // clean the download image CRD first.
      await this.cancelDownload();
      this.$store.commit('harvester-common/setDownloadImageCancel', false);
      this.$store.commit('harvester-common/setDownloadImageInProgress', false);
      this.errors = [];

      const name = this.image?.name || '';
      const namespace = this.image?.namespace || '';

      const imageCrd = {
        apiVersion: 'harvesterhci.io/v1beta1',
        type:       HCI.VM_IMAGE_DOWNLOADER,
        kind:       'VirtualMachineImageDownloader',
        metadata:   {
          name,
          namespace
        },
        spec: { imageName: name }
      };

      const inStore = this.$store.getters['currentProduct'].inStore;
      const imageCreate = await this.$store.dispatch(`${ inStore }/create`, imageCrd);

      try {
        await imageCreate.save();
        this.$store.commit('harvester-common/setDownloadImageId', `${ namespace }/${ name }`, { root: true });
        this.$store.dispatch('harvester-common/downloadImageProgress', { root: true });
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        buttonCb(false);
      }
    }
  },
};
</script>

<template>
  <app-modal
    class="image-downloader-modal"
    name="image-download-dialog"
    height="auto"
    :width="600"
    :click-to-close="false"
    @close="close"
  >
    <Card :show-highlight-border="false">
      <template #title>
        {{ t('harvester.modal.downloadImage.title') }}
      </template>

      <template #body>
        <Banner color="info">
          {{ t('harvester.modal.downloadImage.banner', { size: imageVirtualSize }) }}
        </Banner>
        {{ t('harvester.modal.downloadImage.startMessage') }}
        <br /><br />
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
              class="btn role-secondary mr-10"
              @click="close"
            >
              {{ t('generic.cancel') }}
            </button>
            <AsyncButton
              type="submit"
              mode="download"
              :disabled="downloadImageInProgress"
              @click="startDownload"
            />
          </div>
        </div>
      </template>
    </Card>
  </app-modal>
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
