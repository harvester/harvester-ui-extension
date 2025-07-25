<script>
import CruResource from '@shell/components/CruResource';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import Tab from '@shell/components/Tabbed/Tab';
import Loading from '@shell/components/Loading';
import CreateEditView from '@shell/mixins/create-edit-view';
import ResourceTabs from '@shell/components/form/ResourceTabs/index';
import StaticRoutes from './StaticRoutes';
import VpcPeerings from './VpcPeerings';
import { set } from '@shell/utils/object';

export default {
  name: 'EditVPC',

  emits: ['update:value'],

  components: {
    CruResource,
    NameNsDescription,
    Tab,
    StaticRoutes,
    ResourceTabs,
    Loading,
    VpcPeerings
  },

  mixins: [CreateEditView],

  inheritAttrs: false,

  data() {
    set(this.value, 'spec', this.value.spec || {
      staticRoutes: [],
      vpcPeerings:  [],
    });

    return { staticRoutes: [] };
  },

  methods: {
    async saveVpc(buttonCb) {
      const errors = [];

      try {
        const name = this.value?.metadata?.name;

        if (!name) {
          errors.push(this.t('validation.required', { key: this.t('generic.name') }, true));
        }

        if (errors.length > 0) {
          buttonCb(false);
          this.errors = errors;

          return false;
        }
        await this.value.save();
        buttonCb(true);
        this.done();
      } catch (e) {
        this.errors = [e];
        buttonCb(false);
      }
    },
  },
};

</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <CruResource
    v-else
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :apply-hooks="applyHooks"
    :errors="errors"
    @finish="saveVpc"
    @error="e=>errors=e"
  >
    <NameNsDescription
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />
    <ResourceTabs
      class="mt-15"
      :mode="mode"
      :side-tabs="true"
    >
      <Tab
        name="staticRoutes"
        :label="t('harvester.vpc.staticRoutes.label')"
        :weight="-1"
        class="bordered-table"
      >
        <StaticRoutes
          v-model:value="value.spec.staticRoutes"
          class="col span-12"
          :mode="mode"
        />
      </Tab>
      <Tab
        name="vpcPeerings"
        :label="t('harvester.vpc.vpcPeerings.label')"
        :weight="-2"
        class="bordered-table"
      >
        <VpcPeerings
          v-model:value="value.spec.vpcPeerings"
          class="col span-12"
          :mode="mode"
          :vpc="value"
        />
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>
