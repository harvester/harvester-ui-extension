<script>
import { mapGetters } from 'vuex';
import ActionMenu from '@shell/components/ActionMenuShell.vue';
import { Banner } from '@components/Banner';
import AsyncButton from '@shell/components/AsyncButton';
import { HCI_ALLOWED_SETTINGS, HCI_SETTING } from '../config/settings';

const CATEGORY = {
  ui: [
    'branding',
    'ui-source',
    'ui-plugin-index',
    'ui-index',
  ]
};

export default {
  name: 'SettingLists',

  components: {
    AsyncButton,
    Banner,
    ActionMenu
  },

  props: {
    settings: {
      type:     Array,
      required: true,
    },

    category: {
      type:     String,
      required: true,
    },

    searchQuery: {
      type:    String,
      default: ''
    }
  },

  data() {
    const categorySettings = this.filterCategorySettings();
    const filteredSettings = this.filterSearchSettings(categorySettings, this.searchQuery);

    return {
      HCI_SETTING,
      categorySettings,
      filteredSettings,
      originalHideMap: this.createHideMap(categorySettings)
    };
  },

  computed: { ...mapGetters({ t: 'i18n/t' }) },

  watch: {
    settings: {
      deep: true,
      handler() {
        this.categorySettings = this.filterCategorySettings();
        this.filteredSettings = this.filterSearchSettings(this.categorySettings, this.searchQuery);
      }
    },
    searchQuery: {
      immediate: true,
      handler(newQuery) {
        const filtered = this.filterSearchSettings(this.categorySettings, newQuery);

        this.filteredSettings = newQuery ? this.openJsonSettings(filtered) : filtered.map((s) => ({ ...s, hide: this.originalHideMap[s.id] ?? false }));
      }
    }
  },

  methods: {
    createHideMap(settings = []) {
      const map = settings.reduce((acc, s) => {
        acc[s.id] = s.hide ?? false;

        return acc;
      }, {} );

      return map;
    },
    filterSearchSettings(settings, searchKey) {
      if (!searchKey) {
        return this.filterCategorySettings();
      }
      const searchQuery = searchKey.toLowerCase();

      return settings.filter((setting) => {
        const id = setting.id?.toLowerCase() || '';

        // filter by id
        if (id.includes(searchQuery) ) {
          return true;
        }

        const description = this.t(setting.description, {}, true)?.toLowerCase() || '';

        // filter by description
        if (description.includes(searchQuery)) {
          return true;
        }

        // filter by customized value
        if (setting.customized === true && setting.data?.value) {
          const value = setting.data.value?.toLowerCase() || '';

          return value.includes(searchQuery);
        }

        // filter by json value
        if (setting.kind === 'json' && setting.json) {
          try {
            const json = JSON.parse(setting.json);
            const jsonString = JSON.stringify(json).toLowerCase();

            return jsonString.includes(searchQuery);
          } catch (e) {
            console.error(`${ setting.id }: wrong format`, e); // eslint-disable-line no-console

            return false;
          }
        }

        // filter by default value
        if (setting.data?.default) {
          return setting.data?.default.includes(searchQuery);
        }

        return false;
      });
    },

    filterCategorySettings() {
      return this.settings.filter((s) => {
        if (!this.getFeatureEnabled(s.featureFlag)) {
          return false;
        }

        if (this.category !== 'advanced') {
          return (CATEGORY[this.category] || []).find((item) => item === s.id);
        } else if (this.category === 'advanced') {
          const allCategory = Object.keys(CATEGORY);

          return !allCategory.some((category) => (CATEGORY[category] || []).find((item) => item === s.id));
        }
      }) || [];
    },

    getFeatureEnabled(id) {
      return id ? this.$store.getters['harvester-common/getFeatureEnabled'](id) : true;
    },

    getSettingOption(id) {
      return HCI_ALLOWED_SETTINGS.find((setting) => setting.id === id);
    },

    openJsonSettings(settings) {
      return settings.map((s) => s.hide ? { ...s, hide: false } : s);
    },

    toggleHide(s) {
      const setting = this.filteredSettings.find((setting) => setting.id === s.id);

      if (setting) {
        setting.hide = !setting.hide;
        this.originalHideMap[setting.id] = setting.hide;
      }
    },

    async testConnect(buttonDone, value) {
      try {
        const url = this.$store.getters['harvester-common/getHarvesterClusterUrl']('v1/harvester/backuptarget/healthz');

        const health = await this.$store.dispatch('harvester/request', { url });
        const settingValue = JSON.parse(value);

        if (health?._status === 200) {
          this.$store.dispatch('growl/success', {
            title:   this.t('harvester.notification.title.succeed'),
            message: this.t('harvester.backup.message.testConnect.successMessage', { endpoint: settingValue?.endpoint })
          }, { root: true });
        }
        buttonDone(true);
      } catch (err) {
        if (err?._status === 400 || err?._status === 503) {
          this.$store.dispatch('growl/error', {
            title:   this.t('harvester.notification.title.error'),
            message: err?.errors[0]
          }, { root: true });
        }
        buttonDone(false);
      }
    }
  },
};
</script>

<template>
  <div>
    <div
      v-for="(setting, i) in filteredSettings"
      :key="i"
      class="advanced-setting mb-20"
    >
      <div class="header">
        <div class="title">
          <h1>
            {{ setting.id }}
            <span
              v-if="setting.customized"
              class="modified"
            >
              Modified
            </span>
            <span
              v-if="setting.experimental"
              v-clean-tooltip="t('advancedSettings.experimental')"
              class="experimental"
            >
              Experimental
            </span>
          </h1>
          <h2 v-clean-html="t(setting.description, {}, true)">
          </h2>
        </div>
        <div
          v-if="setting.hasActions"
          :id="setting.id"
          class="action"
        >
          <action-menu
            :resource="setting.data"
            :button-aria-label="t('advancedSettings.edit.label')"
            data-testid="action-button"
            button-role="tertiary"
          />
        </div>
      </div>
      <div value>
        <div
          v-if="!setting.hide"
          class="settings-value"
        >
          <pre v-if="setting.kind === 'json'">{{ setting.json }}</pre>
          <pre v-else-if="setting.kind === 'multiline'">{{ setting.data.value || setting.data.default }}</pre>
          <pre v-else-if="setting.kind === 'enum'">{{ t(setting.enum) }}</pre>
          <pre v-else-if="setting.kind === 'custom' && setting.custom">{{ setting.custom }}</pre>
          <pre v-else-if="setting.data.value || setting.data.default">{{ setting.data.value || setting.data.default }}</pre>
          <pre
            v-else
            class="text-muted"
          >&lt;{{ t('advancedSettings.none') }}&gt;</pre>
        </div>

        <div class="mt-5">
          <button
            v-if="setting.hide"
            class="btn btn-sm role-primary"
            @click="toggleHide(setting)"
          >
            {{ t('advancedSettings.show') }} {{ setting.id }}
          </button>

          <button
            v-if="setting.canHide && !setting.hide"
            class="btn btn-sm role-primary"
            @click="toggleHide(setting)"
          >
            {{ t('advancedSettings.hide') }} {{ setting.id }}
          </button>

          <AsyncButton
            v-if="setting.id === HCI_SETTING.BACKUP_TARGET"
            class="backupButton ml-5"
            mode="apply"
            size="sm"
            :delay="0"
            :action-label="t('harvester.backup.message.testConnect.actionLabel')"
            :waiting-label="t('harvester.backup.message.testConnect.waitingLabel')"
            :success-label="t('harvester.backup.message.testConnect.successLabel')"
            @click="(buttonCb) => testConnect(buttonCb, setting.data.value)"
          />
        </div>
      </div>
      <Banner
        v-if="setting.data.errMessage"
        color="error mt-5"
        class="settings-banner"
      >
        {{ setting.data.errMessage }}
      </Banner>
    </div>
    <div
      v-if="filteredSettings.length === 0"
      class="advanced-setting mb-20 no-search-match"
    >
      <p> {{ t('harvester.setting.noSearchMatch') }} </p>
    </div>
  </div>
</template>

<style lang='scss' scoped>
.settings-banner {
  margin-top: 0;
}
.advanced-setting {
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

.settings-value pre {
  margin: 0;
}

.header {
  display: flex;
  margin-bottom: 20px;
}

.title {
  flex: 1;
}

.modified {
  margin-left: 10px;
  border: 1px solid var(--primary);
  border-radius: 5px;
  padding: 2px 10px;
  font-size: 12px;
}

.experimental {
  margin-left: 10px;
  border: 1px solid var(--error);
  border-radius: 5px;
  padding: 2px 10px;
  font-size: 12px;
}

.no-search-match {
  text-align: center;
}
</style>
