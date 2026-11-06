<script>
import { exceptionToErrorsArray } from '@shell/utils/error';
import { mapGetters } from 'vuex';
import { Card } from '@components/Card';
import { Banner } from '@components/Banner';
import { LabeledInput } from '@components/Form/LabeledInput';
import { RcButton } from '@components/RcButton';
import { RcHeading } from '@components/RcHeading';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { DEFAULT_FS_FREEZE_DEADLINE, getFsFreezeDeadlineOptions } from '../utils/backup';
import { BACKUP_TYPE } from '../config/types';
import { HCI } from '../types';

export default {
  name: 'HarvesterBackupModal',

  emits: ['close'],

  components: {
    Card,
    LabeledInput,
    LabeledSelect,
    Banner,
    RcButton,
    RcHeading
  },

  props: {
    resources: {
      type:     Array,
      required: true
    }
  },

  async fetch() {
    if (!this.thirdPartyBackupEnabled) {
      return;
    }

    await this.actionResource.fetchBackupTypeRequirements();

    this.backupType = this.backupTypeOptions.find((option) => !option.disabled)?.value;
  },

  data() {
    return {
      backUpName:       '',
      backupType:       BACKUP_TYPE.BACKUP,
      errors:           [],
      fsFreezeDeadline: DEFAULT_FS_FREEZE_DEADLINE,
      saving:           false
    };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    actionResource() {
      return this.resources[0];
    },

    fsFreezeDeadlineEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('fsFreezeDeadline');
    },

    fsFreezeDeadlineOptions() {
      return getFsFreezeDeadlineOptions(this.t);
    },

    thirdPartyBackupEnabled() {
      return !!this.actionResource?.thirdPartyBackupFeatureEnabled;
    },

    backupTypeOptions() {
      return this.thirdPartyBackupEnabled ? this.actionResource.backupTypeOptions : [];
    },

    isLoading() {
      return this.thirdPartyBackupEnabled && this.$fetchState.pending;
    },

    noBackupTypeAvailable() {
      return this.thirdPartyBackupEnabled && !this.isLoading && !this.backupType;
    },

    canCreate() {
      return !!this.backUpName && !this.isLoading && !this.noBackupTypeAvailable && !this.saving;
    }
  },

  methods: {
    close() {
      this.backUpName = '';
      this.fsFreezeDeadline = DEFAULT_FS_FREEZE_DEADLINE;
      this.errors = [];
      this.$emit('close');
    },

    backupCreated() {
      this.$store.dispatch(
        'growl/success',
        {
          title:   this.t('generic.notification.title.succeed'),
          message: this.t('harvester.modal.backup.success', { backUpName: this.backUpName })
        },
        { root: true }
      );

      this.close();
    },

    // No ownerReferences, like the backup action: deleting the VM must leave its backups and their remote data
    async createDataMoverBackup() {
      const backup = await this.$store.dispatch('harvester/create', {
        metadata: {
          name:      this.backUpName,
          namespace: this.actionResource.metadata.namespace,
        },
        spec: {
          fsFreezeDeadline: this.fsFreezeDeadline,
          source:           {
            apiGroup: 'kubevirt.io',
            kind:     'VirtualMachine',
            name:     this.actionResource.metadata.name
          },
          type: this.backupType
        },
        type: HCI.BACKUP
      });

      await backup.save();
    },

    async save() {
      this.saving = true;
      this.errors = [];

      try {
        if (this.backupType !== BACKUP_TYPE.BACKUP) {
          await this.createDataMoverBackup();
          this.backupCreated();

          return;
        }

        const res = await this.actionResource.doAction(
          'backup',
          { name: this.backUpName, fsFreezeDeadline: this.fsFreezeDeadline },
          {},
          false
        );

        if (res._status === 200 || res._status === 204) {
          this.backupCreated();
        } else {
          this.errors = [res?.data] || exceptionToErrorsArray(res);
        }
      } catch (err) {
        this.errors = exceptionToErrorsArray(err?.data || err);
      } finally {
        this.saving = false;
      }
    }
  }
};
</script>

<template>
  <Card :show-highlight-border="false">
    <template #title>
      <RcHeading :size="3">
        {{ t('harvester.modal.backup.addBackup') }}
      </RcHeading>
    </template>

    <template #body>
      <Banner
        v-if="noBackupTypeAvailable"
        class="mt-20"
        color="warning"
        data-testid="backup-no-type-available"
      >
        <div>
          <p class="mb-5">
            {{ t('harvester.modal.backup.noTypeAvailable') }}
          </p>
          <ul class="mb-0">
            <li
              v-for="option in backupTypeOptions"
              :key="option.value"
            >
              {{ option.label }}: {{ option.unavailableReason }}
            </li>
          </ul>
        </div>
      </Banner>
      <template v-else>
        <LabeledInput
          v-model:value="backUpName"
          class="mt-20"
          :label="t('generic.name')"
          required
        />
        <LabeledSelect
          v-if="thirdPartyBackupEnabled"
          v-model:value="backupType"
          class="mt-20"
          data-testid="backup-type-select"
          :label="t('harvester.fields.type')"
          :loading="isLoading"
          :options="backupTypeOptions"
          :searchable="false"
          required
        >
          <template #option="option">
            <div :data-testid="`backup-type-option-${ option.value }`">
              {{ option.label }}
              <div
                v-if="option.unavailableReason"
                class="backup-type-reason"
              >
                {{ option.unavailableReason }}
              </div>
            </div>
          </template>
        </LabeledSelect>
        <LabeledSelect
          v-if="fsFreezeDeadlineEnabled"
          v-model:value="fsFreezeDeadline"
          class="mt-20"
          :options="fsFreezeDeadlineOptions"
          :label="t('harvester.modal.backup.fileSystemFreezeDeadline.label')"
          required
        />
      </template>
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
          <RcButton
            class="mr-10"
            data-testid="backup-cancel"
            size="large"
            variant="secondary"
            @click="close"
          >
            {{ t('generic.cancel') }}
          </RcButton>

          <RcButton
            :aria-busy="saving"
            data-testid="backup-create"
            :disabled="!canCreate"
            size="large"
            variant="primary"
            @click="save"
          >
            {{ t('generic.create') }}
          </RcButton>
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

.backup-type-reason {
  font-size: 12px;
  white-space: normal;
}
</style>
