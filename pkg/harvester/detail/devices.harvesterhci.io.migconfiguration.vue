<script>
import CreateEditView from '@shell/mixins/create-edit-view';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import SortableTable from '@shell/components/SortableTable';

export default {

  components: {
    ResourceTabs,
    Tab,
    SortableTable,
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

  computed: {
    headers() {
      return [
        {
          name:        'profileName',
          labelKey:    'harvester.migconfiguration.tableHeaders.profileName',
          value:       'name',
          width:       75,
          sort:        'name',
          dashIfEmpty: true,
        },
        {
          name:        'vGPUID',
          labelKey:    'harvester.migconfiguration.tableHeaders.vGPUID',
          value:       'vGPUID',
          width:       75,
          sort:        'vGPUID',
          dashIfEmpty: true,
        },
        {
          name:        'available',
          labelKey:    'harvester.migconfiguration.tableHeaders.available',
          value:       'available',
          width:       75,
          sort:        'available',
          align:       'center',
          dashIfEmpty: true,
        },
        {
          name:        'requested',
          labelKey:    'harvester.migconfiguration.tableHeaders.requested',
          value:       'requested',
          width:       75,
          sort:        'requested',
          align:       'center',
          dashIfEmpty: true,
        },
        {
          name:        'total',
          labelKey:    'harvester.migconfiguration.tableHeaders.total',
          value:       'total',
          width:       75,
          sort:        'total',
          align:       'center',
          dashIfEmpty: true,
        },
      ];
    },

    rows() {
      let out = (this.value?.status?.profileStatus || []).map((profile) => {
        const {
          id, name, total, available
        } = profile;

        return {
          id,
          name,
          total,
          available,
          vGPUID: profile.vGPUID?.join(', ') || '',
        };
      });

      out = out.map((row) => {
        const requested = this.value?.spec?.profileSpec.find((p) => p.id === row.id)?.requested || 0;

        return { ...row, requested };
      });

      return out;
    },
  },
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
      <SortableTable
        :headers="headers"
        :rows="rows"
        key-field="condition"
        default-sort-by="condition"
        :table-actions="false"
        :row-actions="false"
        :search="false"
      />
    </Tab>
  </ResourceTabs>
</template>
