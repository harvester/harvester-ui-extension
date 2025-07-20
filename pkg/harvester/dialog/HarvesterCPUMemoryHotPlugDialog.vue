<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { getVmCPUMemoryValues } from '../utils/cpuMemory';
import UnitInput from '@shell/components/form/UnitInput';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { LabeledInput } from '@components/Form/LabeledInput';
import { GIBIBYTE } from '../utils/unit';

export default {
  name: 'CPUMemoryHotplugModal',

  emits: ['close'],

  components: {
    AsyncButton, Card, LabeledInput, Banner, UnitInput
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
   const { cpu, memory } = getVmCPUMemoryValues(this.resources[0] || {});
    console.log("🚀 ~ data ~ memory:", memory)
    console.log("🚀 ~ data ~ cpu:", cpu)
    return {
      cpu,
      memory,
      errors:     [],
      GIBIBYTE
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0] || {};
    },

  },

  methods: {
    close() {
      this.cpu = '';
      this.memory = '';
      this.$emit('close');
    },

    async save(buttonCb) {
      if (this.actionResource) {
        try {
          const res = await this.actionResource.doAction('cpuAndMemoryHotplug', { sockets: this.cpu, memory: this.memory });
          if (res._status === 200 || res._status === 204) {
            this.$store.dispatch('growl/success', {
              title:   this.t('generic.notification.title.succeed'),
              message: this.t('harvester.modal.cpuMemoryHotplug.success', { vm: this.actionResource.nameDisplay })
            }, { root: true });

            this.close();
            buttonCb(true);
          } else {
            const error = [res?.data] || exceptionToErrorsArray(res);

            this['errors'] = error;
            buttonCb(false);
          }
        } catch (err) {
          const error = err?.data || err;
          const message = exceptionToErrorsArray(error);

          this['errors'] = message;
          buttonCb(false);
        }
      }
    },
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
        v-clean-html="t('harvester.modal.cpuMemoryHotplug.title')"
        class="text-default-text"
      />
    </template>

    <template #body>
      <UnitInput
        v-model:value="cpu"
        :label="t('harvester.virtualMachine.input.cpu')"
        suffix="C"
        :delay="0"
        required
        :mode="mode"
        class="mb-20"
      />

       <UnitInput
        v-model:value="memory"
        :label="t('harvester.virtualMachine.input.memory')"
        :mode="mode"
        :input-exponent="3"
        :delay="0"
        :increment="1024"
        :output-modifier="true"
        :disabled="disabled"
        :suffix="GIBIBYTE"
        class="mb-20"
        @update:value="change"
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
