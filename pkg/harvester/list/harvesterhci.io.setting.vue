<script>
import { mapGetters } from 'vuex';
import { Banner } from '@components/Banner';
import Loading from '@shell/components/Loading';
import { MANAGEMENT } from '@shell/config/types';
import { allHash } from '@shell/utils/promise';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import Settings from '@pkg/harvester/components/SettingList.vue';
import { HCI_SETTING } from '../config/settings';
import { HCI } from '../types';

export default {
  components: {
    Banner,
    Loading,
    Tabbed,
    Tab,
    Settings,
  },

  async fetch() {
    const isSingleProduct = !!this.$store.getters['isSingleProduct'];
    const inStore = this.$store.getters['currentProduct'].inStore;

    const hash = { harvesterSettings: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SETTING }) };

    if (isSingleProduct) {
      hash.settings = this.$store.dispatch('management/findAll', { type: MANAGEMENT.SETTING });
    }

    await allHash(hash);

    const initSettings = this.$store.getters[`${ inStore }/visibleSettings`].map(({ id, config, data }) => {
      const s = {
        ...config,
        id: config.alias || id,
        data,
      };

      s.hide = s.canHide = (s.kind === 'json' || s.kind === 'multiline' || s.customFormatter === 'json' || s.data.customFormatter === 'json');
      s.hasActions = s.id === HCI_SETTING.SERVER_VERSION ? true : !s.readOnly;

      return s;
    });

    this.initSettings = initSettings.sort((a, b) => {
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }

      return 0;
    });
  },

  data() {
    return { initSettings: [], searchQuery: '' };
  },

  computed: {
    ...mapGetters({ t: 'i18n/t' }),

    settings() {
      return this.initSettings.map((setting) => {
        const s = setting;

        const isHarvester = s.data?.type?.includes('harvesterhci');

        if (s.kind === 'json') {
          try {
            s.json = JSON.stringify(JSON.parse(s.data.value || s.data.default || '{}'), null, 2);
          } catch (e) {
            console.error(`${ s.data.id }: wrong format`); // eslint-disable-line no-console
            s.json = {};
          }
        } else if (s.kind === 'enum') {
          const v = s.data.value || s.data.default;

          s.enum = isHarvester ? `advancedSettings.enum.harv-${ s.id }.${ v }` : `advancedSettings.enum.${ s.id }.${ v }`;
        } else if (s.kind === 'custom') {
          s.custom = s.data.customValue;
        }

        return {
          ...s,
          description: s.descriptionKey || (isHarvester ? `advancedSettings.descriptions.harv-${ s.id }` : `advancedSettings.descriptions.${ s.id }`),
          customized:  (!s.readOnly && s.data.value && (
            s.kind === 'json' ? (() => {
              try {
                return JSON.stringify(JSON.parse(s.data.value)) !== JSON.stringify(JSON.parse(s.data.default));
              } catch {
                return s.data.value !== s.data.default;
              }
            })() : s.data.value !== s.data.default
          )) || s.data.hasCustomized
        };
      });
    }
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <div v-else>
    <Banner
      color="warning"
      class="settings-banner"
    >
      <div>
        {{ t('harvester.setting.modifiedMessage') }}
      </div>
    </Banner>
    <div class="fixed-header-actions harvester-settings-search">
      <div class="search row">
        <input
          v-model="searchQuery"
          type="search"
          class="input-sm search-box"
          :aria-label="t('sortableTable.searchLabel')"
          :placeholder="t('sortableTable.search')"
        >
      </div>
    </div>
    <Tabbed
      class="mt-15"
    >
      <Tab
        name="advanced"
        :label="t('harvester.setting.tabs.advanced')"
        :weight="99"
      >
        <Settings
          :settings="settings"
          :search-query="searchQuery"
          category="advanced"
        />
      </Tab>
      <Tab
        name="ui"
        :label="t('harvester.setting.tabs.ui')"
        :weight="89"
      >
        <Settings
          :settings="settings"
          :search-query="searchQuery"
          category="ui"
        />
      </Tab>
    </Tabbed>
  </div>
</template>

<style lang='scss' scoped>
.settings-banner {
  margin-top: 0;
}

.harvester-settings-search {
  padding: 0;
}

.search {
  display: flex;
  justify-content: flex-end;
}

.search-box {
  height: 40px;
  margin-left: 10px;
  min-width: 180px;
}

</style>
