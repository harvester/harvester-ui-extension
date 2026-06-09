<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import CreateEditView from '@shell/mixins/create-edit-view';

export default {
  name: 'HarvesterHostNetworkConfigEditPage',

  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :mode="mode"
    :resource="value"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="save"
    @cancel="done"
    @error="e => errors = e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :namespaced="true"
      @update:value="$emit('update:value', $event)"
    />
  </CruResource>
</template>
