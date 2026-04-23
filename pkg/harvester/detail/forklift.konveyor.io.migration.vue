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
  name: 'ForkliftMigrationDetail',

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

    planName() {
      return this.value.spec?.plan?.name || '-';
    },

    planNamespace() {
      return this.value.spec?.plan?.namespace || '-';
    },

    migrationStarted() {
      return this.value.status?.started || '-';
    },

    migrationCompleted() {
      return this.value.status?.completed || '-';
    },

    migrationConditions() {
      return this.value.status?.conditions || [];
    },

    overallStatus() {
      const succeeded = this.migrationConditions.find((c) => c.type === 'Succeeded' && c.status === 'True');
      const running = this.migrationConditions.find((c) => c.type === 'Running' && c.status === 'True');
      const failed = this.migrationConditions.find((c) => c.type === 'Failed' && c.status === 'True');

      if (succeeded) {
        return { text: this.t('harvester.addons.forklift.detail.status.succeeded'), color: 'bg-success' };
      }
      if (failed) {
        return { text: this.t('harvester.addons.forklift.detail.status.failed'), color: 'bg-error' };
      }
      if (running) {
        return { text: this.t('harvester.addons.forklift.detail.status.running'), color: 'bg-info' };
      }

      return { text: this.t('harvester.addons.forklift.detail.status.pending'), color: 'bg-darker' };
    },

    vms() {
      return this.value.status?.vms || [];
    },
  },

  methods: {
    pipelineSteps(vm) {
      return vm.pipeline || [];
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

    vmOverallProgress(vm) {
      const steps = vm.pipeline || [];

      if (steps.length === 0) {
        return 0;
      }

      const completed = steps.filter((s) => s.phase === 'Completed').length;

      return Math.round((completed / steps.length) * 100);
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
    <div class="row mb-20">
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.detail.plan')"
          :value="planName"
        />
      </div>
      <div class="col span-3">
        <LabelValue
          :name="t('harvester.addons.forklift.detail.planNamespace')"
          :value="planNamespace"
        />
      </div>
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
          :name="t('harvester.addons.forklift.detail.started')"
          :value="migrationStarted"
        />
      </div>
    </div>

    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        v-for="(vm, vmIdx) in vms"
        :key="vm.id"
        :name="'vm-' + vmIdx"
        :label="vm.name || vm.id"
        :weight="100 - vmIdx"
      >
        <div class="row mb-20">
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.addons.forklift.detail.vmId')"
              :value="vm.id"
            />
          </div>
          <div class="col span-3">
            <LabelValue :name="t('harvester.addons.forklift.detail.vmPhase')">
              <template #value>
                <BadgeState
                  :label="vm.phase"
                  :color="stepBadgeColor(vm.phase)"
                />
              </template>
            </LabelValue>
          </div>
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.addons.forklift.detail.vmStarted')"
              :value="vm.started || '-'"
            />
          </div>
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.addons.forklift.detail.vmCompleted')"
              :value="vm.completed || '-'"
            />
          </div>
        </div>

        <div class="row mb-20">
          <div class="col span-12">
            <LabelValue :name="t('harvester.addons.forklift.detail.overallProgress')">
              <template #value>
                <PercentageBar :value="vmOverallProgress(vm)" />
              </template>
            </LabelValue>
          </div>
        </div>

        <h3 class="mb-10">
          {{ t('harvester.addons.forklift.detail.pipelineSteps') }}
        </h3>

        <div class="pipeline">
          <div
            v-for="(step, stepIdx) in pipelineSteps(vm)"
            :key="stepIdx"
            class="pipeline-step"
          >
            <div class="step-header">
              <div class="step-name">
                <span class="step-index">{{ stepIdx + 1 }}.</span>
                {{ step.name }}
              </div>
              <BadgeState
                :label="step.phase"
                :color="stepBadgeColor(step.phase)"
              />
            </div>
            <p class="text-muted step-description">
              {{ step.description }}
            </p>

            <PercentageBar
              :value="stepProgress(step)"
              class="mb-5"
            />

            <div
              v-if="step.annotations && step.annotations.unit"
              class="step-disk-progress text-muted"
            >
              {{ formatDiskProgress(step) }}
            </div>

            <div
              v-if="step.tasks && step.tasks.length"
              class="step-tasks mt-10"
            >
              <div
                v-for="(task, taskIdx) in step.tasks"
                :key="taskIdx"
                class="task-row"
              >
                <span class="task-name text-muted">{{ task.name }}</span>
                <span
                  v-if="task.progress"
                  class="task-progress text-muted"
                >
                  {{ formatBytes(task.progress.completed || 0) }} / {{ formatBytes(task.progress.total || 0) }}
                </span>
                <BadgeState
                  v-if="task.phase"
                  :label="task.phase"
                  :color="stepBadgeColor(task.phase)"
                />
              </div>
            </div>
          </div>
        </div>

        <Banner
          v-if="vm.conditions && vm.conditions.length"
          :color="vm.conditions[0].type === 'Succeeded' ? 'success' : 'info'"
          :label="vm.conditions[0].message"
          class="mt-20"
        />
      </Tab>
    </Tabbed>
  </CruResource>
</template>

<style lang="scss" scoped>
  .pipeline {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .pipeline-step {
    border: 1px solid var(--border);
    border-radius: var(--border-radius);
    padding: 15px;
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  }

  .step-name {
    font-weight: 600;
  }

  .step-index {
    color: var(--muted);
    margin-right: 5px;
  }

  .step-description {
    font-size: 13px;
    margin-bottom: 10px;
  }

  .step-disk-progress {
    font-size: 12px;
    text-align: right;
  }

  .step-tasks {
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }

  .task-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 0;
    font-size: 12px;

    .task-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .task-progress {
      white-space: nowrap;
    }
  }
</style>
