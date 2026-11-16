<script>
import ActionMenu from '@shell/components/ActionMenuShell';
import Loading from '@shell/components/Loading';
import MessageLink from '@shell/components/MessageLink';
import { Banner } from '@components/Banner';
import { allHash } from '@shell/utils/promise';
import { _EDIT } from '@shell/config/query-params';
import { exceptionToErrorsArray } from '@shell/utils/error';
import { HCI } from '../../../../types';
import { ADD_ONS } from '../../../../config/harvester-map';
import { PRODUCT_NAME } from '../../../../config/harvester';
import { KUBEOVN_CONFIGURATION_ID } from '../../../../models/kubeovn.io.configuration';

// Cluster-wide Kube-OVN settings, shown like Advanced > Settings: one card per setting, edited on its own page
export default {
  name: 'HarvesterOverlayNetworkSettings',

  components: {
    ActionMenu,
    Banner,
    Loading,
    MessageLink,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = await allHash({ addons: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.ADD_ONS }) });

    this.addonEnabled = hash.addons.find((addon) => addon.name === ADD_ONS.KUBEOVN_OPERATOR)?.spec?.enabled === true;

    if (!this.addonEnabled || !this.bgpFeatureEnabled) {
      return;
    }

    try {
      this.configuration = await this.$store.dispatch(`${ inStore }/find`, { type: HCI.KUBEOVN_CONFIG, id: KUBEOVN_CONFIGURATION_ID });
    } catch (e) {
      this.errors = exceptionToErrorsArray(e);
    }
  },

  data() {
    return {
      addonEnabled:  false,
      configuration: null,
      errors:        [],
    };
  },

  computed: {
    bgpFeatureEnabled() {
      return this.$store.getters['harvester-common/getFeatureEnabled']('kubeovnBgp');
    },

    addonLocation() {
      return {
        name:   `${ PRODUCT_NAME }-c-cluster-resource-namespace-id`,
        params: {
          resource: HCI.ADD_ONS, namespace: 'kube-system', id: ADD_ONS.KUBEOVN_OPERATOR
        },
        query: { mode: _EDIT },
      };
    },

    bgpActions() {
      return [{
        action:  'edit',
        label:   this.t(this.configuration?.canUpdate ? 'harvester.overlayNetworkSettings.edit' : 'harvester.overlayNetworkSettings.view'),
        icon:    'icon icon-edit',
        enabled: true,
      }];
    },

    // What the card shows: "Disabled", or one line per value that is set
    bgpSummary() {
      const config = this.configuration;

      if (!config?.bgpSpeakerHosts.length) {
        return [];
      }

      const bgp = config.bgp;
      const t = (key, args) => this.t(`harvester.bgp.summary.${ key }`, args, true);
      const nextHops = config.bgpNextHops;

      return [
        t('hosts', { hosts: config.bgpSpeakerHosts.join(', ') }),
        t('clusterAS', { as: bgp.clusterAS }),
        config.bgpNeighbors.length ? t('neighbors', { neighbors: config.bgpNeighbors.join(', '), as: bgp.neighborAS }) : null,
        bgp.routerID ? t('routerID', { id: bgp.routerID }) : null,
        nextHops.length ? t('nextHops', { hops: nextHops.join(', ') }) : null,
      ].filter(Boolean);
    },
  },

  methods: {
    editBgp() {
      this.$router.push({ name: `${ PRODUCT_NAME }-c-cluster-overlay-network-settings-bgp` });
    },
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <h1 class="mb-20">
      {{ t('harvester.overlayNetworkSettings.title') }}
    </h1>
    <Banner
      v-if="!addonEnabled"
      color="warning"
    >
      <MessageLink
        :to="addonLocation"
        prefix-label="harvester.overlayNetworkSettings.noAddonEnabled.prefix"
        middle-label="harvester.overlayNetworkSettings.noAddonEnabled.middle"
        suffix-label="harvester.overlayNetworkSettings.noAddonEnabled.suffix"
      />
    </Banner>
    <template v-else>
      <Banner
        v-for="(err, i) in errors"
        :key="i"
        color="error"
        :label="err"
      />
      <div
        class="setting mb-20"
        data-testid="overlay-setting-bgp"
      >
        <div class="header">
          <div class="title">
            <h1>{{ t('harvester.bgp.label') }}</h1>
            <h2>{{ t('harvester.bgp.settingDescription') }}</h2>
          </div>
          <div
            v-if="configuration"
            class="action"
          >
            <ActionMenu
              :custom-actions="bgpActions"
              :button-aria-label="t('harvester.overlayNetworkSettings.edit')"
              data-testid="bgp-action-button"
              button-role="tertiary"
              @action-invoked="editBgp"
            />
          </div>
        </div>
        <div class="settings-value">
          <pre
            v-if="!bgpFeatureEnabled"
            class="text-muted"
          >{{ t('harvester.bgp.unsupported') }}</pre>
          <pre
            v-else-if="!configuration"
            class="text-muted"
          >{{ t('generic.unknown') }}</pre>
          <pre
            v-else-if="!bgpSummary.length"
            class="text-muted"
          >{{ t('generic.disabled') }}</pre>
          <pre v-else>{{ bgpSummary.join('\n') }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
// Same card as Advanced > Settings
.setting {
  border: 1px solid var(--border);
  padding: 20px;
  border-radius: var(--border-radius);

  h1 {
    font-size: 14px;
  }

  h2 {
    font-size: 12px;
    margin-bottom: 0;
    opacity: 0.8;
  }
}

.header {
  display: flex;
  margin-bottom: 20px;
}

.title {
  flex: 1;
}

.settings-value pre {
  margin: 0;
}
</style>
