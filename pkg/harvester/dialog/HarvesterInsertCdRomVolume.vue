<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapState, mapGetters } from 'vuex';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { HCI } from '../types';

export default {
  name: 'HarvesterInsertCdRomVolume',

  emits: ['close'],

  components: {
    AsyncButton,
    Card,
    LabeledInput,
    LabeledSelect,
    Banner
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    try {
      this.images = await this.$store.dispatch('harvester/findAll', { type: HCI.IMAGE });
    } catch (err) {
      this.errors = exceptionToErrorsArray(err);
      this.images = [];
    }
  },

  data() {
    return {
      imageName: '',
      images:    [],
      errors:    [],
    };
  },

  computed: {
    ...mapState('action-menu', ['modalData']),
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources?.[0];
    },

    isFormValid() {
      return this.imageName !== '';
    },

    deviceName() {
      return this.modalData.name;
    },

    imagesOption() {
      return this.images
        .filter((image) => {
          const labels = image.metadata?.labels || {};
          const type = labels[HCI_ANNOTATIONS.IMAGE_SUFFIX];

          return type === 'iso';
        })
        .map((image) => {
          return ({
            label:    this.imageOptionLabel(image),
            value:    image.id,
            disabled: image.isImportedImage
          });
        });
    }
  },

  methods: {
    close() {
      this.imageName = '';
      this.errors = [];
      this.$emit('close');
    },

    imageOptionLabel(image) {
      return `${ image.metadata.namespace }/${ image.spec.displayName }`;
    },

    async save(buttonCb) {
      if (!this.actionResource) {
        buttonCb(false);

        return;
      }

      const payload = {
        deviceName: this.deviceName,
        imageName:  this.imageName
      };

      try {
        const res = await this.actionResource.doAction('insertCdRomVolume', payload);

        if ([200, 204].includes(res?._status)) {
          this.$store.dispatch('growl/success', {
            title:   this.t('generic.notification.title.succeed'),
            message: this.t('harvester.modal.insertCdRomVolume.success', {
              deviceName: this.deviceName,
              imageName:  this.imageName,
            })
          }, { root: true });

          this.close();
          buttonCb(true);
        } else {
          this.errors = exceptionToErrorsArray(res);
          buttonCb(false);
        }
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
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
        v-clean-html="t('harvester.modal.insertCdRomVolume.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <LabeledInput
        v-model:value="deviceName"
        :label="t('generic.name')"
        disabled
      />
      <LabeledSelect
        v-model:value="imageName"
        class="mt-20"
        :label="t('harvester.modal.insertCdRomVolume.image')"
        :options="imagesOption"
        required
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        :label="err"
        color="error"
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
            :disabled="!isFormValid"
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
</style>
