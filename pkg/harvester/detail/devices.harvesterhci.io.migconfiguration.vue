<script>
import LabelValue from '@shell/components/LabelValue';
import CreateEditView from '@shell/mixins/create-edit-view';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';

export default {

  components: {
    ResourceTabs,
    Tab,
    LabelValue
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:    Object,
      default: () => {
        return {};
      }
    }
  },

  data() {
    const { profileStatus } = this.value.status;

    return { profileStatus: profileStatus || [] };
  },

  methods: {
    vGPUIDList(profile) {
      return profile.vGPUID?.join(', ') || '';
    }
  }
};
</script>

<template>
  <ResourceTabs
    :value="value"
    :need-events="false"
    :need-related="false"
    :mode="mode"
  >
    <Tab
      name="Profile Status"
      :label="t('harvester.migconfiguration.profileStatus')"
    >
      <div
        v-for="(profile, index) in profileStatus"
        :key="index"
      >
        <h4>{{ profile.name }}</h4>
        <div class="row">
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.migconfiguration.total')"
              :value="profile.total"
              class="mb-20"
            />
          </div>
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.migconfiguration.available')"
              :value="profile.available"
              class="mb-20"
            />
          </div>
          <div class="col span-3">
            <LabelValue
              :name="t('harvester.migconfiguration.vGPUID')"
              :value="vGPUIDList(profile)"
              class="mb-20"
            />
          </div>
        </div>
      </div>
    </Tab>
  </ResourceTabs>
</template>
