<script>
import { RadioGroup } from '@components/Form/Radio';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { NAMESPACE } from '@shell/config/types';
import CreateEditView from '@shell/mixins/create-edit-view';

export default {
  name: 'HarvesterClusterPodSecurityStandard',

  components: {
    RadioGroup,
    LabeledSelect,
  },

  mixins: [CreateEditView],

  props: {
    value: {
      type:    Object,
      default: () => ({}),
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await this.$store.dispatch(`${ inStore }/findAll`, { type: NAMESPACE });
  },

  data() {
    let enabled = false;
    let whitelistedNamespaces = [];
    let privilegedNamespaces = [];
    let restrictedNamespaces = [];

    try {
      const parsed = JSON.parse(this.value.value || this.value.default || '{}');

      enabled = !!parsed.enabled;
      whitelistedNamespaces = parsed.whitelistedNamespacesList ? parsed.whitelistedNamespacesList.split(',') : [];
      privilegedNamespaces = parsed.privilegedNamespacesList ? parsed.privilegedNamespacesList.split(',') : [];
      restrictedNamespaces = parsed.restrictedNamespacesList ? parsed.restrictedNamespacesList.split(',') : [];
    } catch (e) {}

    return {
      enabled,
      whitelistedNamespaces,
      privilegedNamespaces,
      restrictedNamespaces,
    };
  },

  computed: {
    enabledOptions() {
      return [
        { label: this.t('generic.enabled'), value: true },
        { label: this.t('generic.disabled'), value: false },
      ];
    },

    allNamespaces() {
      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](NAMESPACE).map((ns) => ns.id);
    },

    whitelistedOptions() {
      const excluded = new Set([...this.privilegedNamespaces, ...this.restrictedNamespaces]);

      return this.allNamespaces.filter((ns) => !excluded.has(ns));
    },

    privilegedOptions() {
      const excluded = new Set([...this.whitelistedNamespaces, ...this.restrictedNamespaces]);

      return this.allNamespaces.filter((ns) => !excluded.has(ns));
    },

    restrictedOptions() {
      const excluded = new Set([...this.whitelistedNamespaces, ...this.privilegedNamespaces]);

      return this.allNamespaces.filter((ns) => !excluded.has(ns));
    },
  },

  methods: {
    useDefault() {
      try {
        const parsed = JSON.parse(this.value.default || '{}');

        this.enabled = !!parsed.enabled;
        this.whitelistedNamespaces = parsed.whitelistedNamespacesList ? parsed.whitelistedNamespacesList.split(',') : [];
        this.privilegedNamespaces = parsed.privilegedNamespacesList ? parsed.privilegedNamespacesList.split(',') : [];
        this.restrictedNamespaces = parsed.restrictedNamespacesList ? parsed.restrictedNamespacesList.split(',') : [];
      } catch (e) {
        this.enabled = false;
        this.whitelistedNamespaces = [];
        this.privilegedNamespaces = [];
        this.restrictedNamespaces = [];
      }
      this.save();
    },

    onUpdateEnabled() {
      if (!this.enabled) {
        this.whitelistedNamespaces = [];
        this.privilegedNamespaces = [];
        this.restrictedNamespaces = [];
      }
      this.save();
    },

    updateWhitelisted(selected) {
      this.whitelistedNamespaces = selected;
      this.save();
    },

    updatePrivileged(selected) {
      this.privilegedNamespaces = selected;
      this.save();
    },

    updateRestricted(selected) {
      this.restrictedNamespaces = selected;
      this.save();
    },

    save() {
      this.value.value = JSON.stringify({
        enabled:                   this.enabled,
        whitelistedNamespacesList: this.whitelistedNamespaces.join(','),
        privilegedNamespacesList:  this.privilegedNamespaces.join(','),
        restrictedNamespacesList:  this.restrictedNamespaces.join(','),
      });
    },
  },
};
</script>

<template>
  <div>
    <div class="row mb-20">
      <div class="col span-6">
        <RadioGroup
          v-model:value="enabled"
          name="enabled"
          :options="enabledOptions"
          @update:value="onUpdateEnabled"
        />
      </div>
    </div>
    <template v-if="enabled">
      <div class="row mb-20">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="whitelistedNamespaces"
            :label="t('harvester.setting.clusterPodSecurityStandard.whitelistedNamespaces.label')"
            :options="whitelistedOptions"
            :multiple="true"
            :mode="mode"
            @update:value="updateWhitelisted"
          />
        </div>
      </div>
      <div class="row mb-20">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="privilegedNamespaces"
            :label="t('harvester.setting.clusterPodSecurityStandard.privilegedNamespaces.label')"
            :options="privilegedOptions"
            :multiple="true"
            :mode="mode"
            @update:value="updatePrivileged"
          />
        </div>
      </div>
      <div class="row mb-20">
        <div class="col span-12">
          <LabeledSelect
            v-model:value="restrictedNamespaces"
            :label="t('harvester.setting.clusterPodSecurityStandard.restrictedNamespaces.label')"
            :options="restrictedOptions"
            :multiple="true"
            :mode="mode"
            @update:value="updateRestricted"
          />
        </div>
      </div>
    </template>
  </div>
</template>
