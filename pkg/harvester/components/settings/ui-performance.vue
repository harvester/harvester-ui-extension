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
      // Only this option changes, but all of them have to be saved: the shell's resource-fetch mixin reads the value without merging the defaults
      const value = JSON.stringify(this.perfSetting);

      // Stay empty while it matches the defaults, so that it keeps following them
      this.value['value'] = value === JSON.stringify(DEFAULT_PERF_SETTING) ? '' : value;
    },

    // The form empties the whole value before calling this, so put back the other options
    useDefault() {
      this.perfSetting.disableWebsocketNotification = DEFAULT_PERF_SETTING.disableWebsocketNotification;
      this.update();
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
    data-testid="disable-websocket-notification"
    @update:value="update"
  />
</template>
