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
    };
  },

  computed: {
    ...mapState('action-menu', ['toRemove']),
    ...mapGetters({ t: 'i18n/t' }),

    existingRelatedResources() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return {
        [HCI.FORKLIFT_MIGRATION]:   this.$store.getters[`${ inStore }/all`](HCI.FORKLIFT_MIGRATION) || [],
        [HCI.FORKLIFT_NETWORK_MAP]: this.$store.getters[`${ inStore }/all`](HCI.FORKLIFT_NETWORK_MAP) || [],
        [HCI.FORKLIFT_STORAGE_MAP]: this.$store.getters[`${ inStore }/all`](HCI.FORKLIFT_STORAGE_MAP) || [],
      };
    },

    resourceType() {
      return this.t('typeLabel."forklift.konveyor.io.plan"', { count: this.names?.length || 1 });
    },

    relatedSummary() {
      const existing = this.existingRelatedResources;

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
            const matched = existing[HCI.FORKLIFT_MIGRATION].find((resource) => resource?.metadata?.name === entry.name && resource?.metadata?.namespace === entry.namespace);

            if (matched) {
              migrationsMap.set(`${ entry.namespace }/${ entry.name }`, entry);
            }
          });

        const matchedNetworkMap = networkMap?.name && existing[HCI.FORKLIFT_NETWORK_MAP].find((resource) => resource?.metadata?.name === networkMap.name && resource?.metadata?.namespace === (networkMap.namespace || namespace));
        const matchedStorageMap = storageMap?.name && existing[HCI.FORKLIFT_STORAGE_MAP].find((resource) => resource?.metadata?.name === storageMap.name && resource?.metadata?.namespace === (storageMap.namespace || namespace));

        return {
          planName,
          namespace,
          migrations: [...migrationsMap.values()],
          networkMap: matchedNetworkMap ? {
            namespace: networkMap.namespace || namespace,
            name:      networkMap.name,
          } : null,
          storageMap: matchedStorageMap ? {
            namespace: storageMap.namespace || namespace,
            name:      storageMap.name,
          } : null,
        };
      });
    },
  },

  async mounted() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    try {
      await Promise.all([
        this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_MIGRATION }),
        this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP }),
        this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP }),
      ]);
    } catch {
      // Best-effort: the dialog can still function without this prefetch.
    }
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
      let cache = {};

      try {
        cache = {
          [HCI.FORKLIFT_MIGRATION]:   await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_MIGRATION }),
          [HCI.FORKLIFT_NETWORK_MAP]: await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_NETWORK_MAP }),
          [HCI.FORKLIFT_STORAGE_MAP]: await this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.FORKLIFT_STORAGE_MAP }),
        };
      } catch (err) {
        // Best-effort cleanup; don't block closing the dialog if listing related resources fails.
        return;
      }

      for (const target of targets) {
        const matched = (cache[target.type] || []).find((resource) => resource?.metadata?.name === target.name && resource?.metadata?.namespace === target.namespace
        );

        if (!matched) {
          continue;
        }

        try {
          await matched.remove({ params: { propagationPolicy: 'Background' } });
        } catch (err) {
          // Continue deleting remaining resources and let final plan deletion fail if needed.
        }
      }
    },

    async remove(buttonDone) {
      this.errors = [];
      this.removing = true;

      try {
        const results = await Promise.allSettled((this.value || []).map((resource) => resource.remove({ params: { propagationPolicy: 'Background' } })));

        await this.deleteRelatedResources();
        const rejected = results.filter((r) => r.status === 'rejected');

        if (rejected.length) {
          throw rejected[0].reason;
        }

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
      :key="`${ summary.namespace }/${ summary.planName }`"
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
