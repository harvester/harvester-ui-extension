<script>
import { mapGetters } from 'vuex';
import { NODE } from '@shell/config/types';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import LabeledSelect from '@shell/components/form/LabeledSelect';

export default {
  emits: ['close'],

  components: {
    AsyncButton, Banner, Card, LabeledSelect
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    try {
      if (!this.actionResource.hasAction('findMigratableNodes')) {
        return;
      }

      const res = await this.actionResource.$dispatch('resourceAction', {
        resource:   this.actionResource,
        actionName: 'findMigratableNodes',
        body:       {},
        opt:        {},
      });

      this.availableNodes = res.nodes;
    } catch (err) {
      this.actionResource.$dispatch('growl/fromError', {
        title: this.t('generic.notification.title.error'),
        err:   err.data || err,
      }, { root: true });
    }
  },

  data() {
    return {
      nodeName:       '',
      errors:         [],
      availableNodes: []
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },

    anyCpuPinning() {
      return this.resources.some((r) => r.isCpuPinning);
    },

    vmsByNode() {
      const groups = {};

      for (const r of this.resources) {
        const node = r.nodeName || '';
        const name = r.nameDisplay || r.name || r.id;

        if (!groups[node]) {
          groups[node] = [];
        }
        groups[node].push(name);
      }

      return Object.entries(groups).map(([node, vms]) => ({ node, vms })).sort((a, b) => a.node.localeCompare(b.node));
    },

    cpuPinningAlertMessage() {
      return this.t('harvester.virtualMachine.cpuPinning.migrationMessage');
    },

    allVmsOnTargetNode() {
      if (!this.nodeName) {
        return false;
      }

      return this.resources.every((r) => r.nodeName === this.nodeName);
    },

    nodeNameList() {
      const nodes = this.$store.getters['harvester/all'](NODE);

      return nodes.filter((n) => {
        const isNotWitnessNode = n.isEtcd !== 'true'; // do not allow to migrate to self node and witness node
        const matchingCpuManagerConfig = !this.anyCpuPinning || n.isCPUManagerEnabled; // If cpu-pinning is enabled, filter-out non-enabled CPU manager nodes.

        return isNotWitnessNode && matchingCpuManagerConfig;
      }).map((n) => {
        let label = n?.metadata?.name;
        const value = n?.metadata?.name;
        const custom = n?.metadata?.annotations?.[HCI_ANNOTATIONS.HOST_CUSTOM_NAME];

        if (custom) {
          label = custom;
        }

        return {
          label,
          value
        };
      });
    },
  },

  methods: {
    close() {
      this.nodeName = '';
      this.errors = [];
      this.$emit('close');
    },

    async apply(buttonDone) {
      if (!this.actionResource) {
        buttonDone(false);

        return;
      }

      if (!this.nodeName) {
        const name = this.$store.getters['i18n/t']('harvester.modal.migration.fields.nodeName.label');
        const message = this.$store.getters['i18n/t']('validation.required', { key: name });

        this['errors'] = [message];
        buttonDone(false);

        return;
      }

      try {
        // Filter out VMs already running on the selected node
        const toMigrate = this.resources.filter((r) => r.nodeName !== this.nodeName);

        // await Promise.allSettled(toMigrate.map((r) => r.doAction('migrate', { nodeName: this.nodeName }, {}, false)));
        // We want to show all migration errors if there are multiple VMs, so we use allSettled here and handle the results accordingly.
        const results = await Promise.allSettled(toMigrate.map((r) => r.doAction('migrate', { nodeName: this.nodeName }, {}, false)));

        const failedMigrations = results
          .map((result, index) => ({ resource: toMigrate[index], result }))
          .filter(({ result }) => result.status === 'rejected');

        if (failedMigrations.length) {
          this['errors'] = failedMigrations.flatMap(({ resource, result }) => {
            const vmName = resource?.nameDisplay || resource?.name || resource?.metadata?.name || this.$store.getters['i18n/t']('generic.unknown');
            const error = result.reason?.data || result.reason;
            const messages = exceptionToErrorsArray(error);

            return messages.map((message) => `${ vmName }: ${ message }`);
          });
          buttonDone(false);

          return;
        }

        buttonDone(true);
        this.close();
      } catch (err) {
        const error = err?.data || err;
        const message = exceptionToErrorsArray(error);

        this['errors'] = message;
        buttonDone(false);
      }
    },

  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      {{ t('harvester.modal.migration.vmMigrationTitle', { count: resources.length }) }}
    </template>

    <template #body>
      <Banner
        v-if="anyCpuPinning"
        color="warning"
        :label="cpuPinningAlertMessage"
      />
      <p>
        {{ t('harvester.modal.migration.selectedVMs') }}
      </p>
      <ul class="vm-list">
        <li
          v-for="group in vmsByNode"
          :key="group.node"
        >
          {{ group.node || t('harvester.modal.migration.unknownNode') }}: {{ group.vms.join(', ') }}
          <span
            v-if="nodeName && group.node === nodeName"
            class="already-on-target"
          >
            ({{ t('harvester.modal.migration.alreadyOnTarget') }})
          </span>
        </li>
      </ul>
      <LabeledSelect
        v-model:value="nodeName"
        class="mt-15"
        :label="t('harvester.modal.migration.fields.nodeName.label')"
        :placeholder="t('harvester.modal.migration.fields.nodeName.placeholder')"
        :options="nodeNameList"
      />
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
    </template>

    <template
      #actions
      class="actions"
    >
      <div class="buttons">
        <button
          class="btn role-secondary mr-10"
          @click="close"
        >
          {{ t('generic.cancel') }}
        </button>

        <AsyncButton
          mode="apply"
          :disabled="!nodeName || allVmsOnTargetNode"
          @click="apply"
        />
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

.already-on-target {
  color: var(--warning);
  font-style: italic;
}

.vm-list {
  list-style: disc;
  padding-left: 1.5em;
  margin-bottom: 10px;
  margin-top: 10px;
}
</style>
