<script>
import { defineComponent } from 'vue';
import { mapState, mapGetters } from 'vuex';
import { resourceNames } from '@shell/utils/string';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../types';

export default defineComponent({
  name: 'PromptRemoveForkliftPlanDialog',

  emits: ['errors'],

  props: {
    value: {
      type:    Array,
      default: () => []
    },

    names: {
      type:    Array,
      default: () => []
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
    return {
      errors:        [],
      removing:      false,
      deletedCounts: {
        migration:  0,
        networkMap: 0,
        storageMap: 0,
      },
    };
  },

  computed: {
    ...mapState('action-menu', ['toRemove']),
    ...mapGetters({ t: 'i18n/t' }),

    resourceType() {
      return this.t('typeLabel."forklift.konveyor.io.plan"', { count: this.names?.length || 1 });
    },

    relatedSummary() {
      return (this.value || []).map((plan) => {
        const planName = plan?.metadata?.name || '-';
        const namespace = plan?.metadata?.namespace || '';
        const networkMap = plan?.spec?.map?.network;
        const storageMap = plan?.spec?.map?.storage;
        const history = plan?.status?.migration?.history || [];

        const migrationsMap = new Map();

        history
          .map((entry) => ({
            name:      entry?.migration?.name,
            namespace: entry?.migration?.namespace || namespace,
          }))
          .filter((entry) => !!entry.name)
          .forEach((entry) => {
            migrationsMap.set(`${ entry.namespace }/${ entry.name }`, entry);
          });

        return {
          planName,
          migrations: [...migrationsMap.values()],
          networkMap: networkMap?.name ? {
            namespace: networkMap.namespace || namespace,
            name:      networkMap.name,
          } : null,
          storageMap: storageMap?.name ? {
            namespace: storageMap.namespace || namespace,
            name:      storageMap.name,
          } : null,
        };
      });
    },
  },

  methods: {
    resourceNames,

    buildDeleteTargets() {
      const targets = new Map();

      for (const plan of this.value || []) {
        const namespace = plan?.metadata?.namespace || '';
        const networkMap = plan?.spec?.map?.network;
        const storageMap = plan?.spec?.map?.storage;
        const history = plan?.status?.migration?.history || [];

        if (networkMap?.name) {
          const ns = networkMap.namespace || namespace;
          const key = `${ HCI.FORKLIFT_NETWORK_MAP }|${ ns }|${ networkMap.name }`;

          targets.set(key, {
            type:      HCI.FORKLIFT_NETWORK_MAP,
            name:      networkMap.name,
            namespace: ns,
          });
        }

        if (storageMap?.name) {
          const ns = storageMap.namespace || namespace;
          const key = `${ HCI.FORKLIFT_STORAGE_MAP }|${ ns }|${ storageMap.name }`;

          targets.set(key, {
            type:      HCI.FORKLIFT_STORAGE_MAP,
            name:      storageMap.name,
            namespace: ns,
          });
        }

        for (const entry of history) {
          const migrationName = entry?.migration?.name;

          if (!migrationName) {
            continue;
          }

          const migrationNs = entry?.migration?.namespace || namespace;
          const key = `${ HCI.FORKLIFT_MIGRATION }|${ migrationNs }|${ migrationName }`;

          targets.set(key, {
            type:      HCI.FORKLIFT_MIGRATION,
            name:      migrationName,
            namespace: migrationNs,
          });
        }
      }

      return [...targets.values()];
    },

    async deleteRelatedResources() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const targets = this.buildDeleteTargets();

      if (!targets.length) {
        return;
      }

      const cache = {
        [HCI.FORKLIFT_MIGRATION]:   await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_MIGRATION }),
        [HCI.FORKLIFT_NETWORK_MAP]: await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP }),
        [HCI.FORKLIFT_STORAGE_MAP]: await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP }),
      };

      for (const target of targets) {
        const matched = (cache[target.type] || []).find((resource) => resource?.metadata?.name === target.name && resource?.metadata?.namespace === target.namespace
        );

        if (!matched) {
          continue;
        }

        try {
          await matched.remove({ params: { propagationPolicy: 'Background' } });

          if (target.type === HCI.FORKLIFT_MIGRATION) {
            this.deletedCounts.migration += 1;
          } else if (target.type === HCI.FORKLIFT_NETWORK_MAP) {
            this.deletedCounts.networkMap += 1;
          } else if (target.type === HCI.FORKLIFT_STORAGE_MAP) {
            this.deletedCounts.storageMap += 1;
          }
        } catch (err) {
          // Continue deleting remaining resources and let final plan deletion fail if needed.
        }
      }
    },

    async remove(buttonDone) {
      this.errors = [];
      this.removing = true;

      try {
        await Promise.all((this.value || []).map((resource) => resource.remove({ params: { propagationPolicy: 'Background' } })));
        await this.deleteRelatedResources();
        this.close(buttonDone);
      } catch (err) {
        this.errors = exceptionToErrorsArray(err);
        this.$emit('errors', err);
        if (buttonDone) {
          buttonDone(false);
        }
      } finally {
        this.removing = false;
      }
    },
  }
});
</script>

<template>
  <div class="mt-10">
    <div class="mb-10">
      {{ t('promptRemove.attemptingToRemove', { type: resourceType }) }}
      <span v-clean-html="resourceNames(names, null, t)" />
    </div>

    <hr class="mb-10">

    <div class="mb-10 text-warning">
      <i class="icon icon-warning icon-lg mr-5" />
      {{ t('harvester.addons.vmMigration.deleteDialog.warning') }}
    </div>

    <div
      v-for="summary in relatedSummary"
      :key="summary.planName"
      class="mb-10"
    >
      <div>• {{ t('harvester.addons.vmMigration.labels.migration') }}:</div>
      <template v-if="summary.migrations.length">
        <div
          v-for="migration in summary.migrations"
          :key="`${ migration.namespace }/${ migration.name }`"
        >
          <div class="ml-20">
            - {{ migration.name }}
          </div>
        </div>
      </template>
      <div
        v-else
        class="ml-20"
      >
        - -
      </div>

      <div>• {{ t('harvester.addons.vmMigration.labels.networkMap') }}:</div>
      <template v-if="summary.networkMap">
        <div class="ml-20">
          - {{ summary.networkMap.name }}
        </div>
      </template>
      <div
        v-else
        class="ml-20"
      >
        - -
      </div>

      <div>• {{ t('harvester.addons.vmMigration.labels.storageMap') }}:</div>
      <template v-if="summary.storageMap">
        <div class="ml-20">
          - {{ summary.storageMap.name }}
        </div>
      </template>
      <div
        v-else
        class="ml-20"
      >
        - -
      </div>
    </div>

    <Banner
      v-for="(error, i) in errors"
      :key="i"
      color="error"
      :label="error"
    />
  </div>
</template>
