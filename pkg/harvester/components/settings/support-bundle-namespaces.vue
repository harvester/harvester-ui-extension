<script>
import { NAMESPACE } from '@shell/config/types';
import CreateEditView from '@shell/mixins/create-edit-view';
import LabeledSelect from '@shell/components/form/LabeledSelect';

const SELECT_ALL = 'select_all';
const UNSELECT_ALL = 'unselect_all';

export default {
  name: 'HarvesterBundleNamespaces',

  components: { LabeledSelect },

  mixins: [CreateEditView],

  async fetch() {
    this.loading = true;

    await this.$store.dispatch('harvester/findAll', { type: NAMESPACE });

    try {
      const url = this.$store.getters['harvester-common/getHarvesterClusterUrl']('v1/harvester/namespaces?link=supportbundle');
      const response = await this.$store.dispatch('harvester/request', { url });

      this.defaultNamespaces = response.data || [];
    } catch (error) {
      this.defaultNamespaces = [];
    } finally {
      this.loading = false;
    }
  },

  data() {
    const namespacesStr = this.value?.value || this.value?.default || '';
    const namespaces = namespacesStr ? namespacesStr.split(',') : [];

    return {
      namespaces,
      defaultNamespaces: [],
      loading:           true
    };
  },

  computed: {
    allNamespaces() {
      return this.$store.getters['harvester/all'](NAMESPACE).map((ns) => ns.id);
    },

    filteredNamespaces() {
      const defaultIds = this.defaultNamespaces.map((ns) => ns.id);

      return this.allNamespaces.filter((ns) => !defaultIds.includes(ns));
    },

    namespaceOptions() {
      const allSelected =
        this.namespaces.length === this.filteredNamespaces.length &&
        this.filteredNamespaces.every((ns) => this.namespaces.includes(ns));

      const controlOption = allSelected ? { label: this.t('harvester.modal.bundle.namespaces.unselectAll'), value: UNSELECT_ALL } : { label: this.t('harvester.modal.bundle.namespaces.selectAll'), value: SELECT_ALL };

      return [controlOption, ...this.filteredNamespaces];
    }
  },

  methods: {
    update(selected) {
      if (selected.includes(SELECT_ALL)) {
        this.namespaces = [...this.filteredNamespaces];
      } else if (selected.includes(UNSELECT_ALL)) {
        this.namespaces = [];
      } else {
        this.namespaces = selected.filter((val) => val !== SELECT_ALL && val !== UNSELECT_ALL);
      }

      this.value.value = this.namespaces.join(',');
    }
  },

  watch: {
    'value.value'(newVal) {
      const raw = newVal || this.value.default || '';

      this.namespaces = raw ? raw.split(',') : [];
    }
  }
};
</script>

<template>
  <div class="row">
    <div class="col span-12">
      <LabeledSelect
        v-model:value="namespaces"
        :loading="loading"
        :multiple="true"
        label-key="nameNsDescription.namespace.label"
        :mode="mode"
        :options="namespaceOptions"
        @update:value="update"
      />
    </div>
  </div>
</template>
