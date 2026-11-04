<script>
import { Checkbox } from '@components/Form/Checkbox';
import { DEFAULT_PERF_SETTING } from '@shell/config/settings';
import CreateEditView from '@shell/mixins/create-edit-view';

export default {
  name: 'HarvesterUIPerformance',

  components: { Checkbox },

  mixins: [CreateEditView],

  data() {
    let perfSetting = {};

    try {
      perfSetting = JSON.parse(this.value.value || '{}');
    } catch (error) {
      console.warn('ui-performance setting contains invalid data'); // eslint-disable-line no-console
    }

    return { perfSetting: { ...DEFAULT_PERF_SETTING, ...perfSetting } };
  },

  methods: {
    update() {
      const value = JSON.stringify(this.perfSetting);

      // Stay empty while it matches the defaults, so that the settings list doesn't tag it as modified
      this.value['value'] = value === JSON.stringify(DEFAULT_PERF_SETTING) ? '' : value;
    },

    useDefault() {
      this.perfSetting = { ...DEFAULT_PERF_SETTING };
    },
  },
};
</script>

<template>
  <Checkbox
    v-model:value="perfSetting.disableWebsocketNotification"
    :mode="mode"
    :label="t('performance.websocketNotification.checkboxLabel')"
    :primary="true"
    data-testid="disable-websocket-notifications"
    @update:value="update"
  />
</template>
