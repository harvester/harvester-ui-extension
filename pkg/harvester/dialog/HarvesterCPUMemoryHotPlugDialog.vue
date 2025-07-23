<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { getVmCPUMemoryValues } from '../utils/cpuMemory';
import UnitInput from '@shell/components/form/UnitInput';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { GIBIBYTE } from '../utils/unit';

export default {
  name: 'CPUMemoryHotplugModal',

  emits: ['close'],

  components: {
    AsyncButton, Card, Banner, UnitInput
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  data() {
    const { cpu, memory } = getVmCPUMemoryValues(this.resources[0] || {});

    return {
      cpu,
      memory,
      errors: [],
      GIBIBYTE
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0] || {};
    },
    maxResourcesMessage() {
      const { maxCpu, maxMemory } = getVmCPUMemoryValues(this.actionResource);

      if (maxCpu && maxMemory) {
        return this.t('harvester.modal.cpuMemoryHotplug.maxResourcesMessage', { maxCpu, maxMemory });
      }

      return '';
    }
  },

  methods: {
    close() {
      this.cpu = '';
      this.memory = '';
      this.$emit('close');
    },

    change() {
      if (parseInt(this.memory, 10) < 1 ) {
        this.memory = '1Gi';
      }
      if (this.cpu < 1) {
        this.cpu = 1;
      }
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
      <Banner
        v-if="maxResourcesMessage"
        :label="maxResourcesMessage"
        color="info"
      />
      <UnitInput
        v-model:value="cpu"
        :label="t('harvester.virtualMachine.input.cpu')"
        :delay="0"
        required
        suffix="C"
        class="mb-20"
        :mode="mode"
        :min="1"
        @update:value="change"
      />
      <UnitInput
        v-model:value="memory"
        :label="t('harvester.virtualMachine.input.memory')"
        :mode="mode"
        :input-exponent="3"
        :delay="0"
        :min="1"
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
