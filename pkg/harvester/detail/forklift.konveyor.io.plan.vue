<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource';
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import LabelValue from '@shell/components/LabelValue';
import { Banner } from '@components/Banner';
import PercentageBar from '@shell/components/PercentageBar';
import BadgeState from '@components/BadgeState';
import { mapGetters } from 'vuex';

export default {
  name: 'ForkliftPlanDetail',

  components: {
    BadgeState,
    Banner,
    CruResource,
    LabelValue,
    PercentageBar,
    Tabbed,
    Tab,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
    mode: {
      type:     String,
      required: true,
    },
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    sourceProvider() {
      return this.value.spec?.provider?.source?.name || '-';
    },

    destProvider() {
      return this.value.spec?.provider?.destination?.name || '-';
    },

    targetNamespace() {
      return this.value.spec?.targetNamespace || '-';
    },

    networkMapName() {
      return this.value.spec?.map?.network?.name || '-';
    },

    storageMapName() {
      return this.value.spec?.map?.storage?.name || '-';
    },

    plannedVMs() {
      return this.value.spec?.vms || [];
    },

    planConditions() {
      return this.value.status?.conditions || [];
    },

    overallStatus() {
      const succeeded = this.planConditions.find((c) => c.type === 'Succeeded' && c.status === 'True');
      const executing = this.planConditions.find((c) => c.type === 'Executing' && c.status === 'True');
      const failed = this.planConditions.find((c) => c.type === 'Failed' && c.status === 'True');

      if (succeeded) {
        return { text: this.t('harvester.addons.forklift.detail.status.succeeded'), color: 'bg-success' };
      }
      if (failed) {
        return { text: this.t('harvester.addons.forklift.detail.status.failed'), color: 'bg-error' };
      }
      if (executing) {
        return { text: this.t('harvester.addons.forklift.detail.status.executing'), color: 'bg-info' };
      }

      return { text: this.t('harvester.addons.forklift.detail.status.ready'), color: 'bg-darker' };
    },

    currentMigration() {
      return this.value.status?.migration || null;
    },

    currentMigrationVMs() {
      return this.currentMigration?.vms || [];
    },

    migrationHistory() {
      return this.currentMigration?.history || [];
    },

    hasMigrationInProgress() {
      return this.currentMigration?.started && !this.currentMigration?.completed;
    },
  },

  methods: {
    vmOverallProgress(vm) {
      const steps = vm.pipeline || [];

      if (steps.length === 0) {
        return 0;
      }

      const completed = steps.filter((s) => s.phase === 'Completed').length;

      return Math.round((completed / steps.length) * 100);
    },

    stepProgress(step) {
      if (step.phase === 'Completed') {
        return 100;
      }
      if (step.phase === 'Pending') {
        return 0;
      }

      const total = step.progress?.total || 0;
      const completed = step.progress?.completed || 0;

      if (total === 0) {
        return step.phase === 'Running' ? 50 : 0;
      }

      return Math.round((completed / total) * 100);
    },

    stepBadgeColor(phase) {
      switch (phase) {
      case 'Completed':
        return 'bg-success';
      case 'Running':
        return 'bg-info';
      case 'Pending':
        return 'bg-darker';
      default:
        return 'bg-warning';
      }
    },

    formatBytes(mb) {
      if (mb >= 1024) {
        return `${ (mb / 1024).toFixed(1) } GB`;
      }

      return `${ mb } MB`;
    },

    formatDiskProgress(step) {
      const unit = step.annotations?.unit || 'MB';
      const completed = step.progress?.completed || 0;
      const total = step.progress?.total || 0;

      if (unit === 'MB') {
        return `${ this.formatBytes(completed) } / ${ this.formatBytes(total) }`;
      }

      return `${ completed } / ${ total }`;
    },

    historyStatus(entry) {
      const conditions = entry.conditions || [];
      const succeeded = conditions.find((c) => c.type === 'Succeeded');
      const executing = conditions.find((c) => c.type === 'Executing');
      const failed = conditions.find((c) => c.type === 'Failed');

      if (succeeded) {
        return { text: this.t('harvester.addons.forklift.detail.status.succeeded'), color: 'bg-success' };
      }
      if (failed) {
        return { text: this.t('harvester.addons.forklift.detail.status.failed'), color: 'bg-error' };
      }
      if (executing) {
        return { text: this.t('harvester.addons.forklift.detail.status.executing'), color: 'bg-info' };
      }

      return { text: this.t('harvester.addons.forklift.detail.status.unknown'), color: 'bg-darker' };
    },
  },
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :can-yaml="false"
  >
    <!-- Plan Overview -->
    <div class="row mb-20">
      <div class="col span-3">
        <LabelValue :name="t('harvester.addons.forklift.detail.status.label')">
          <template #value>
            <BadgeState
              :label="overallStatus.text"
              :color="overallStatus.color"
            />
          </template>
        </LabelValue>
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.fields.sourceProvider')"
          :value="sourceProvider"
        />
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.fields.destProvider')"
          :value="destProvider"
        />
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.fields.targetNamespace')"
          :value="targetNamespace"
        />
      </div>
    </div>

    <div class="row mb-20">
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.fields.networkMap')"
          :value="networkMapName"
        />
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.fields.storageMap')"
          :value="storageMapName"
        />
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.detail.vmCount')"
          :value="String(plannedVMs.length)"
        />
      </div>
    </div>

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <!-- Current Migration Tab -->
      <Tab
        name="current"
        :label="t('harvester.addons.forklift.detail.tabs.currentMigration')"
        :weight="3"
      >
        <template v-if="currentMigration">
          <div class="row mb-20">
            <div class="col span-4">
              <LabelValue
                :name="t('harvester.addons.forklift.detail.migrationName')"
                :value="currentMigration.history && currentMigration.history.length ? currentMigration.history[currentMigration.history.length - 1].migration.name : '-'"
              />
            </div>
            <div class="col span-4">
              <LabelValue
                :name="t('harvester.addons.forklift.detail.started')"
                :value="currentMigration.started || '-'"
              />
            </div>
            <div class="col span-4">
              <LabelValue
                :name="t('harvester.addons.forklift.detail.completed')"
                :value="currentMigration.completed || '-'"
              />
            </div>
          </div>

          <!-- VM Progress -->
          <div
            v-for="vm in currentMigrationVMs"
            :key="vm.id"
            class="vm-progress-card mb-20"
          >
            <div class="vm-card-header">
              <div class="vm-card-title">
                <span class="vm-name">{{ vm.name || vm.id }}</span>
                <span
                  v-if="vm.name"
                  class="text-muted ml-10"
                >({{ vm.id }})</span>
              </div>
              <BadgeState
                :label="vm.phase"
                :color="stepBadgeColor(vm.phase)"
              />
            </div>

            <div class="row mb-10">
              <div class="col span-12">
                <PercentageBar :value="vmOverallProgress(vm)" />
              </div>
            </div>

            <div class="pipeline-steps">
              <div
                v-for="(step, idx) in (vm.pipeline || [])"
                :key="idx"
                class="step-row"
              >
                <div class="step-info">
                  <span class="step-num">{{ idx + 1 }}.</span>
                  <span class="step-name">{{ step.name }}</span>
                  <span class="text-muted step-desc">{{ step.description }}</span>
                </div>
                <div class="step-status">
                  <span
                    v-if="step.annotations && step.annotations.unit"
                    class="text-muted step-data mr-10"
                  >
                    {{ formatDiskProgress(step) }}
                  </span>
                  <BadgeState
                    :label="step.phase"
                    :color="stepBadgeColor(step.phase)"
                  />
                </div>
                <PercentageBar
                  :value="stepProgress(step)"
                  class="step-bar"
                />
              </div>
            </div>

            <Banner
              v-if="vm.conditions && vm.conditions.length"
              :color="vm.conditions[0].type === 'Succeeded' ? 'success' : 'info'"
              :label="vm.conditions[0].message"
              class="mt-10"
            />
          </div>
        </template>

        <Banner
          v-else
          color="info"
          :label="t('harvester.addons.forklift.detail.noCurrentMigration')"
        />
      </Tab>

      <!-- Migration History Tab -->
      <Tab
        name="history"
        :label="t('harvester.addons.forklift.detail.tabs.history')"
        :weight="2"
      >
        <template v-if="migrationHistory.length">
          <div
            v-for="(entry, idx) in migrationHistory"
            :key="idx"
            class="history-entry mb-15"
          >
            <div class="history-header">
              <div>
                <strong>{{ entry.migration?.name || t('harvester.addons.forklift.detail.migrationRun', { idx: idx + 1 }) }}</strong>
              </div>
              <BadgeState
                :label="historyStatus(entry).text"
                :color="historyStatus(entry).color"
              />
            </div>
            <div class="history-details">
              <div class="row">
                <div class="col span-3">
                  <LabelValue
                    :name="t('harvester.addons.forklift.fields.sourceProvider')"
                    :value="entry.provider?.source?.name || '-'"
                  />
                </div>
                <div class="col span-3">
                  <LabelValue
                    :name="t('harvester.addons.forklift.fields.destProvider')"
                    :value="entry.provider?.destination?.name || '-'"
                  />
                </div>
                <div class="col span-3">
                  <LabelValue
                    :name="t('harvester.addons.forklift.fields.networkMap')"
                    :value="entry.map?.network?.name || '-'"
                  />
                </div>
                <div class="col span-3">
                  <LabelValue
                    :name="t('harvester.addons.forklift.fields.storageMap')"
                    :value="entry.map?.storage?.name || '-'"
                  />
                </div>
              </div>
              <Banner
                v-if="entry.conditions && entry.conditions.length"
                :color="entry.conditions[0].type === 'Succeeded' ? 'success' : entry.conditions[0].type === 'Failed' ? 'error' : 'info'"
                :label="entry.conditions[0].message"
                class="mt-10"
              />
            </div>
          </div>
        </template>

        <Banner
          v-else
          color="info"
          :label="t('harvester.addons.forklift.detail.noHistory')"
        />
      </Tab>

      <!-- Planned VMs Tab -->
      <Tab
        name="vms"
        :label="t('harvester.addons.forklift.titles.vms')"
        :weight="1"
      >
        <table class="sortable-table">
          <thead>
            <tr>
              <th>{{ t('harvester.addons.forklift.fields.vmId') }}</th>
              <th>{{ t('harvester.addons.forklift.fields.vmName') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(vm, idx) in plannedVMs"
              :key="idx"
            >
              <td>{{ vm.id }}</td>
              <td>{{ vm.name || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </Tab>
    </Tabbed>
  </CruResource>
</template>

<style lang="scss" scoped>
  .vm-progress-card {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 15px;
  }

  .vm-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .vm-card-title {
    font-size: 15px;
    font-weight: 600;
  }

  .pipeline-steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 15px;
  }

  .step-row {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 10px 12px;
  }

  .step-info {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 5px;
  }

  .step-num {
    color: var(--muted);
    font-weight: 600;
    min-width: 20px;
  }

  .step-name {
    font-weight: 600;
  }

  .step-desc {
    font-size: 12px;
  }

  .step-status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 5px;
  }

  .step-data {
    font-size: 12px;
  }

  .step-bar {
    margin-top: 2px;
  }

  .history-entry {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 15px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .sortable-table {
    width: 100%;
    border-collapse: collapse;

    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
  }
</style>
