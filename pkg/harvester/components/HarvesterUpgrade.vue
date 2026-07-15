<script>
import { mapGetters } from 'vuex';
import { allHash } from '@shell/utils/promise';
import { Checkbox } from '@components/Form/Checkbox';
import ModalWithCard from '@shell/components/ModalWithCard';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { Banner } from '@components/Banner';
import { HCI as HCI_ANNOTATIONS } from '@pkg/harvester/config/labels-annotations';
import { HCI } from '../types';
import UpgradeInfo from './UpgradeInfo';

export default {
  name: 'HarvesterUpgrade',

  components: {
    Checkbox, ModalWithCard, LabeledSelect, Banner, UpgradeInfo
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    const res = await allHash({
      upgradeVersion: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SETTING }),
      versions:       this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VERSION }),
      upgrade:        this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.UPGRADE }),
    });

    this.upgrade = res.upgrade;
  },

  data() {
    return {
      upgrade:                      [],
      upgradeMessage:               [],
      errors:                       '',
      selectMode:                   true,
      version:                      '',
      enableLogging:                true,
      skipSingleReplicaDetachedVol: false,
      readyReleaseNote:             false,
      isOpen:                       false
    };
  },

  computed: {
    ...mapGetters(['currentCluster']),

    latestUpgrade() {
      return this.upgrade?.find((u) => u.isLatestUpgrade);
    },

    isUpgradeInProgress() {
      return this.latestUpgrade &&
        !this.latestUpgrade.isUpgradeSucceeded &&
        !this.latestUpgrade.isUpgradeFailed;
    },

    canUpgrade() {
      return this.versionOptions.length > 0 && !this.isUpgradeInProgress;
    },

    versionOptions() {
      const versions = this.$store.getters['harvester/all'](HCI.VERSION) || [];

      return versions.map((V) => V.metadata.name);
    },

    currentVersion() {
      const serverVersion = this.$store.getters['harvester/byId'](HCI.SETTING, 'server-version');

      return serverVersion.currentVersion || '';
    },

    canEnableLogging() {
      return this.$store.getters['harvester/schemaFor'](HCI.UPGRADE_LOG);
    },

    skipSingleReplicaDetachedVolFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('skipSingleReplicaDetachedVol');
    },

    releaseLink() {
      return `https://github.com/harvester/harvester/releases/tag/${ this.version }`;
    }
  },

  watch: {
    upgrade: {
      handler(neu) {
        let upgradeMessage = [];
        const list = neu || [];

        const currentResource = list.find( (O) => !!O.isLatestUpgrade);

        upgradeMessage = currentResource ? currentResource.upgradeMessage : [];

        this['upgradeMessage'] = upgradeMessage;
      },
      deep: true
    },

    version() {
      this.readyReleaseNote = false;
    }
  },

  methods: {
    async handleUpgrade() {
      const upgradeValue = {
        type:     HCI.UPGRADE,
        metadata: {
          generateName: 'hvst-upgrade-',
          namespace:    'harvester-system'
        },
        spec: { version: this.version }
      };

      if (this.skipSingleReplicaDetachedVolFeatureEnabled && this.skipSingleReplicaDetachedVol) {
        upgradeValue.metadata.annotations =
          { [HCI_ANNOTATIONS.SKIP_SINGLE_REPLICA_DETACHED_VOL]: JSON.stringify(this.skipSingleReplicaDetachedVol) };
      }

      if (this.canEnableLogging) {
        upgradeValue.spec.logEnabled = this.enableLogging;
      }

      const proxyResource = await this.$store.dispatch('harvester/create', upgradeValue);

      try {
        await proxyResource.save();

        this.cancel();
      } catch (err) {
        if (err?.message !== '') {
          this.errors = err.message;
        }
      }
    },

    cancel() {
      this.isOpen = false;
      this.errors = '';
    },

    open() {
      this.isOpen = true;
    },
  }
};
</script>

<template>
  <div v-if="currentCluster">
    <header class="header-layout header mb-0">
      <h1>
        <t
          k="harvester.dashboard.header"
          :cluster="currentCluster.nameDisplay"
        />
      </h1>
      <span
        v-clean-tooltip="{
          content: canUpgrade ? t('harvester.upgradePage.upgradeAvailable') : t('harvester.upgradePage.upgradeUnavailable'),
          triggers: ['hover', 'focus', 'touch'],
        }"
        class="upgrade-btn-wrap"
        :tabindex="canUpgrade ? -1 : 0"
      >
        <button
          :disabled="!canUpgrade"
          type="button"
          class="btn bg-warning btn-sm"
          @click="open"
        >
          <t k="harvester.upgradePage.upgrade" />
        </button>
      </span>
    </header>

    <ModalWithCard
      v-if="isOpen"
      name="deleteTip"
      :width="850"
    >
      <template #title>
        <t k="harvester.upgradePage.upgradeApp" />
      </template>

      <template #content>
        <UpgradeInfo :version="version" />

        <div class="currentVersion mb-15">
          <span> <t k="harvester.upgradePage.currentVersion" /> </span>
          <span class="version">{{ currentVersion }}</span>
        </div>

        <div>
          <LabeledSelect
            v-model:value="version"
            class="mb-10"
            :label="t('harvester.upgradePage.versionLabel')"
            :options="versionOptions"
            :clearable="true"
          />

          <div
            v-if="canEnableLogging"
            class="mb-5"
          >
            <Checkbox
              v-model:value="enableLogging"
              class="check"
              type="checkbox"
              :label="t('harvester.upgradePage.enableLogging')"
            />
          </div>

          <div
            v-if="skipSingleReplicaDetachedVolFeatureEnabled"
            class="mb-5"
          >
            <Checkbox
              v-model:value="skipSingleReplicaDetachedVol"
              class="check"
              type="checkbox"
              :label="t('harvester.upgradePage.skipSingleReplicaDetachedVol')"
            />
          </div>
          <hr
            v-if="version"
            class="divider"
          />
          <div v-if="version">
            <p
              v-clean-html="t('harvester.upgradePage.releaseTip', {url: releaseLink}, true)"
              class="mb-10"
            ></p>

            <Checkbox
              v-model:value="readyReleaseNote"
              class="check"
              type="checkbox"
              label-key="harvester.upgradePage.checkReady"
            />
          </div>

          <Banner
            v-if="errors.length"
            color="error"
          >
            {{ errors }}
          </Banner>
        </div>
      </template>

      <template #footer>
        <div class="footer">
          <button
            class="btn role-secondary mr-20"
            @click.prevent="cancel"
          >
            <t k="generic.close" />
          </button>
          <button
            :disabled="!readyReleaseNote"
            class="btn role-tertiary bg-primary"
            @click.prevent="handleUpgrade"
          >
            <t k="harvester.upgradePage.upgrade" />
          </button>
        </div>
      </template>
    </ModalWithCard>
  </div>
</template>

<style lang="scss" scoped>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .footer {
    width: 100%;
    display: flex;
    justify-content: flex-end;
  }

  .banner-icon {
    display: flex;
    align-items: center;
  }

  .banner-content {
    display: flex;
  }

  .banner-message {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 15px;
  }

  .icon {
    font-size: 20px;
    width: 20px;
    line-height: 23px;
  }

  .upgrade-btn-wrap {
    display: inline-flex;

    button {
      color: #000 !important;
    }

    button:hover {
      color: #000 !important;
    }
  }

  .currentVersion {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    .version {
      font-size: 16px;
      font-weight: bold;
    }
  }
</style>
