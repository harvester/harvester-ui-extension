<script>
import Loading from '@shell/components/Loading';
import LiveData from '@shell/components/formatter/LiveDate';
import ResourceTable from '@shell/components/ResourceTable';

import { allHash } from '@shell/utils/promise';
import { STATE, AGE, NAME, NAMESPACE } from '@shell/config/table-headers';
import { HCI } from '../types';

export default {
  name:       'HarvesterListTemplate',
  components: {
    ResourceTable, LiveData, Loading
  },
  inheritAttrs: false,

  props: {
    schema: {
      type:     Object,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;
    const hash = await allHash({
      template:        this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VM_TEMPLATE }),
      templateVersion: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VM_VERSION }),
    });

    this.template = hash.template;
    this.templateVersion = hash.templateVersion;
  },

  data() {
    return {
      template:        [],
      templateVersion: [],
    };
  },

  computed: {
    headers() {
      return [
        STATE,
        NAME,
        NAMESPACE,
        {
          name:     'defaultVersion',
          value:    'id',
          labelKey: 'tableHeaders.defaultVersion'
        },
        AGE
      ];
    },

    rows() {
      return [...this.templateVersion];
    },

    groupBy() {
      return 'spec.templateId';
    },

    groupTitleBy() {
      return HCI.VM_TEMPLATE;
    },
  },

  methods: {
    showActions(e, group) {
      const template = group.rows[0].template;

      this.$store.commit(`action-menu/show`, {
        resources: [template],
        elem:      e.target
      });
    },

    valueFor(group) {
      const resource = group?.rows?.[0].template;

      return resource?.metadata?.creationTimestamp;
    },

    templateLabel(group) {
      return group.key;
    },

    templateResource(group) {
      return group?.rows?.[0].template;
    }
  },
};
</script>

<template>
  <Loading v-if="$fetchState.pending" />
  <ResourceTable
    v-else
    v-bind="$attrs"
    :headers="headers"
    :sub-rows="true"
    :groupable="true"
    :rows="rows"
    :group-title-by="groupTitleBy"
    :group-by="groupBy"
    :schema="schema"
    :group-can-action="true"
    key-field="_key"
  >
    <template #group-by="group">
      <div class="group-bar">
        <div class="group-tab">
          <div
            v-clean-html="templateLabel(group.group)"
            class="project-name"
          />
        </div>

        <div class="right">
          <div class="age">
            <LiveData
              :value="valueFor(group.group)"
              :row="templateResource(group.group)"
            />
          </div>

          <button
            type="button"
            class="btn btn-sm actions mr-10 role-multi-action"
            @click="showActions($event, group.group)"
          >
            <i class="icon icon-actions" />
          </button>
        </div>
      </div>
    </template>

    <template #col:defaultVersion="{row}">
      <td v-if="row.isDefaultVersion">
        <i class="icon icon-checkmark" />
      </td>
      <td v-else></td>
    </template>
  </ResourceTable>
</template>

<style lang="scss" scoped>
:deep() {
  .group-name {
    line-height: 30px;
  }

  .group-bar {
    display: flex;
    flex-direction: row;
    justify-content: space-between;

    .right {
      display: flex;
      align-items: center;
      .age {
        width: 100px;
      }

      .actions {
        padding-right: 7px;
      }
    }

    &.has-description {
      .right {
        margin-top: 5px;
      }
      .group-tab {
        &, &::after {
            height: 50px;
        }

        &::after {
            right: -20px;
        }

        .description {
            margin-top: -20px;
        }
      }
    }
  }
}
</style>
