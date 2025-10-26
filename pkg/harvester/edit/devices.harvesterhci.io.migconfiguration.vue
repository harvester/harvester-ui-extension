<script>
import Tabbed from '@shell/components/Tabbed';
import Tab from '@shell/components/Tabbed/Tab';
import CruResource from '@shell/components/CruResource';
import { LabeledInput } from '@components/Form/LabeledInput';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import LabelValue from '@shell/components/LabelValue';
import CreateEditView from '@shell/mixins/create-edit-view';

export default {
  name: 'HarvesterEditMIGConfiguration',

  // emits: ['update:value'],

  components: {
    Tab,
    Tabbed,
    CruResource,
    LabeledInput,
    NameNsDescription,
    LabelValue
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    }
  },

  data() {
    const { profileSpec } = this.value.spec;

    return { profileSpec: profileSpec || [] };
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  methods: {
    updateBeforeSave() {
      // MIGConfiguration CRD don't have any namespace field,
      // so we need to remove the namespace field before saving
      delete this.value.metadata.namespace;
      // enable the MIGConfiguration when saving
      this.value.spec.enabled = true;
    },

    labelTitle(profile) {
      return `${ profile.name }`;
    },

    available(profile) {
      const count = this.value.status?.profileStatus?.find((p) => p.id === profile.id)?.available;

      return count || 0;
    },

    updateRequested(neu, profile) {
      if (neu === null || neu === '') return;
      const newValue = Number(neu);

      const maxValue = Math.max(this.available(profile), profile.requested)
      if (newValue < 0) {
        profile.requested = 0;
      } else if (newValue > maxValue) {
        profile.requested = maxValue;
      } else {
        profile.requested = newValue;
      }
    }
  },
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    finish-button-mode="enable"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
    />
    <Tabbed
      v-bind="$attrs"
      class="mt-15"
      :side-tabs="true"
    >
      <Tab
        name="Profile Spec"
        :label="t('harvester.migconfiguration.profileSpec')"
        :weight="1"
        class="bordered-table"
      >
        <div
          v-for="(profile, index) in profileSpec"
          :key="index"
        >
          <LabelValue
            :value="labelTitle(profile)"
            class="mb-10"
          />
          <LabeledInput
            v-model:value="profile.requested"
            :min="0"
            :max="available(profile)"
            type="number"
            class="mb-20"
            :label="`${t('harvester.migconfiguration.requested')} (available : ${available(profile)})`"
            @update:value="updateRequested($event, profile)"
          />
        </div>
      </Tab>
    </Tabbed>
  </CruResource>
</template>
