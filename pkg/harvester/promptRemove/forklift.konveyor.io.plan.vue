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

        const migrations = existing[HCI.FORKLIFT_MIGRATION]
          .filter((resource) => this.ownedByPlan(resource, plan))
          .map((resource) => ({
            name:      resource?.metadata?.name,
            namespace: resource?.metadata?.namespace || namespace,
          }));

        const matchedNetworkMap = existing[HCI.FORKLIFT_NETWORK_MAP].find((resource) => this.ownedByPlan(resource, plan));
        const matchedStorageMap = existing[HCI.FORKLIFT_STORAGE_MAP].find((resource) => this.ownedByPlan(resource, plan));

        return {
          planName,
          namespace,
          migrations,
          networkMap: matchedNetworkMap ? {
            namespace: matchedNetworkMap?.metadata?.namespace || namespace,
            name:      matchedNetworkMap?.metadata?.name,
          } : null,
          storageMap: matchedStorageMap ? {
            namespace: matchedStorageMap?.metadata?.namespace || namespace,
            name:      matchedStorageMap?.metadata?.name,
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

    /**
     * Determine whether a related resource (migration / network map / storage map)
     * is owned by the given plan by inspecting its `metadata.ownerReferences`.
     * Matches on `kind: Plan` and the plan name; when both sides expose a uid it
     * must match too, to disambiguate same-named plans.
     */
    ownedByPlan(resource, plan) {
      const planName = plan?.metadata?.name;
      const planUid = plan?.metadata?.uid;
      const owners = resource?.metadata?.ownerReferences || [];

      if (!planName) {
        return false;
      }

      return owners.some((owner) => owner?.kind === 'Plan' &&
        owner?.name === planName &&
        (!planUid || !owner?.uid || owner.uid === planUid));
    },

    buildDeleteTargets() {
      const existing = this.existingRelatedResources;
      const targets = new Map();

      const addTarget = (type, resource) => {
        const name = resource?.metadata?.name;
        const ns = resource?.metadata?.namespace;

        if (!name) {
          return;
        }

        const key = `${ type }|${ ns }|${ name }`;

        targets.set(key, {
          type, name, namespace: ns
        });
      };

      for (const plan of this.value || []) {
        existing[HCI.FORKLIFT_NETWORK_MAP]
          .filter((resource) => this.ownedByPlan(resource, plan))
          .forEach((resource) => addTarget(HCI.FORKLIFT_NETWORK_MAP, resource));

        existing[HCI.FORKLIFT_STORAGE_MAP]
          .filter((resource) => this.ownedByPlan(resource, plan))
          .forEach((resource) => addTarget(HCI.FORKLIFT_STORAGE_MAP, resource));

        existing[HCI.FORKLIFT_MIGRATION]
          .filter((resource) => this.ownedByPlan(resource, plan))
          .forEach((resource) => addTarget(HCI.FORKLIFT_MIGRATION, resource));
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
