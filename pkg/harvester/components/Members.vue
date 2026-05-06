<script>
import { MANAGEMENT, NORMAN, VIRTUAL_TYPES } from '@shell/config/types';
import ResourceTable from '@shell/components/ResourceTable';
import Masthead from '@shell/components/ResourceList/Masthead';
import { AGE, ROLE, STATE, PRINCIPAL } from '@shell/config/table-headers';
import Banner from '@components/Banner/Banner.vue';
import Tabbed from '@shell/components/Tabbed/index.vue';
import Tab from '@shell/components/Tabbed/Tab.vue';
import { mapGetters } from 'vuex';
import { allHash } from '@shell/utils/promise';

export default {
  name: 'Members',

  components: {
    Banner,
    Masthead,
    ResourceTable,
    Tabbed,
    Tab,
  },

  props: {
    // Cluster tole template binding create route - defaults to the explorer route
    createLocationOverride: {
      type:    Object,
      default: () => {
        return {
          name:   'c-cluster-product-resource-create',
          params: { resource: MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING }
        };
      }
    }
  },

  async fetch() {
    const clusterRoleTemplateBindingSchema = this.$store.getters[
      `rancher/schemaFor`
    ](NORMAN.CLUSTER_ROLE_TEMPLATE_BINDING);

    const projectRoleTemplateBindingSchema = this.$store.getters['rancher/schemaFor'](NORMAN.PROJECT_ROLE_TEMPLATE_BINDING);

    this['normanClusterRTBSchema'] = clusterRoleTemplateBindingSchema;
    this['normanProjectRTBSchema'] = projectRoleTemplateBindingSchema;

    if (clusterRoleTemplateBindingSchema) {
      Promise.all([
        this.$store.dispatch(`rancher/findAll`, { type: NORMAN.CLUSTER_ROLE_TEMPLATE_BINDING }, { root: true }),
        this.$store.dispatch(`management/findAll`, { type: MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING })
      ]).then(([normanBindings]) => {
        this['normanClusterRoleTemplateBindings'] = normanBindings;
        this.loadingClusterBindings = false;
      });
    }

    if (projectRoleTemplateBindingSchema) {
      this.$store.dispatch('rancher/findAll', { type: NORMAN.PROJECT_ROLE_TEMPLATE_BINDING }, { root: true })
        .then((bindings) => {
          this['projectRoleTemplateBindings'] = bindings;
          this.loadingProjectBindings = false;
        });
    }

    const hydration = {
      normanPrincipals:  this.$store.dispatch('rancher/findAll', { type: NORMAN.PRINCIPAL }),
      mgmt:              this.$store.dispatch(`management/findAll`, { type: MANAGEMENT.USER }),
      mgmtRoleTemplates: this.$store.dispatch(`management/findAll`, { type: MANAGEMENT.ROLE_TEMPLATE }),
    };

    await allHash(hydration);
  },

  data() {
    return {
      schema: this.$store.getters[`management/schemaFor`](
        MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING
      ),
      headers:        [STATE, PRINCIPAL, ROLE, AGE],
      createLocation: {
        ...this.createLocationOverride,
        params: {
          ...this.createLocationOverride.params,
          cluster: this.$store.getters['currentCluster'].id
        }
      },
      resource:                          MANAGEMENT.CLUSTER_ROLE_TEMPLATE_BINDING,
      normanClusterRTBSchema:            null,
      normanProjectRTBSchema:            null,
      normanClusterRoleTemplateBindings: [],
      projectRoleTemplateBindings:       [],
      VIRTUAL_TYPES,
      projectRoleTemplateColumns:        [
        STATE,
        {
          name:      'member',
          labeKey:   'generic.name',
          value:     'principalId',
          formatter: 'Principal'
        },
        {
          name:     'role',
          labelKey: 'tableHeaders.role',
          value:    'roleTemplate.nameDisplay'
        },
      ],
      loadingProjectBindings: true,
      loadingClusterBindings: true
    };
  },

  computed: {
    ...mapGetters(['currentCluster']),
    clusterRoleTemplateBindings() {
      return this.normanClusterRoleTemplateBindings.map((b) => b.clusterroletemplatebinding) ;
    },
    filteredClusterRoleTemplateBindings() {
      return this.clusterRoleTemplateBindings.filter(
        (b) => b?.clusterName === this.$store.getters['currentCluster'].id
      );
    },
    isLocal() {
      return this.$store.getters['currentCluster'].isLocal;
    },
    canEditClusterMembers() {
      return this.schema?.collectionMethods.find((x) => x.toLowerCase() === 'post');
    },
  },
};
</script>

<template>
  <div class="project-members">
    <Masthead
      :schema="schema"
      :resource="resource"
      :favorite-resource="VIRTUAL_TYPES.CLUSTER_MEMBERS"
      :create-location="createLocation"
      :create-button-label="t('members.createActionLabel')"
      :is-creatable="false"
      :type-display="t('members.clusterAndProject')"
    />
    <Banner
      v-if="isLocal"
      color="error"
      :label="t('members.localClusterWarning')"
    />
    <Tabbed>
      <Tab
        name="cluster-membership"
        :label="t('members.clusterMembership')"
      >
        <div
          v-if="canEditClusterMembers"
          class="row mb-10 cluster-add"
        >
          <router-link
            :to="createLocation"
            class="btn role-primary pull-right"
          >
            {{ t('members.createActionLabel') }}
          </router-link>
        </div>
        <ResourceTable
          :schema="schema"
          :headers="headers"
          :rows="filteredClusterRoleTemplateBindings"
          :groupable="true"
          :show-grouping="true"
          :namespaced="false"
          :loading="$fetchState.pending || !currentCluster || loadingClusterBindings"
          sub-search="subSearch"
          :sub-fields="['nameDisplay']"
        />
      </Tab>
    </Tabbed>
  </div>
</template>

<style lang='scss' scoped>

.role {
  align-items: center;
    background-color: rgba(0, 0, 0, 0.05);
    border: 1px solid var(--header-border);
    border-radius: 5px;
    color: var(--tag-text);
    line-height: 20px;
    padding: 2px 5px;
    white-space: nowrap;
    display: inline-flex;
    margin-right: 3px;
}

.role-value {
  &.text-link-enabled {
    cursor: pointer;
    &:hover {
      color: var(--primary);
    }
  }
  + .icon-close {
    margin-left: 3px;
    cursor: pointer;
    &:hover {
      color: var(--primary);
    }
  }
}

.project-members {
  & :deep() .group-bar{
    display: flex;
    justify-content: space-between;
  }
}
.cluster-add {
  justify-content: flex-end;
}
</style>
