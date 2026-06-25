<script>
import CruResource from '@shell/components/CruResource';
import ArrayList from '@shell/components/form/ArrayList';
import InfoBox from '@shell/components/InfoBox';
import NameNsDescription from '@shell/components/form/NameNsDescription';
import ResourceTabs from '@shell/components/form/ResourceTabs';
import Tab from '@shell/components/Tabbed/Tab';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import ArrayListSelect from '@shell/components/form/ArrayListSelect';
import CreateEditView from '@shell/mixins/create-edit-view';
import { allHash } from '@shell/utils/promise';
import { NODE } from '@shell/config/types';
import { HCI } from '../types';

export default {
  emits: ['update:value'],

  components: {
    CruResource,
    ArrayList,
    InfoBox,
    NameNsDescription,
    ResourceTabs,
    Tab,
    LabeledSelect,
    ArrayListSelect,
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
    return {
      defaultInterface: this.value?.spec?.defaultInterface || '',
      excludedNodes:    this.value?.spec?.excludeNodes || [],
      customInterfaces: this.value?.spec?.customInterfaces || [],
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      nodes:        this.$store.dispatch(`${ inStore }/findAll`, { type: NODE }),
      linkMonitors: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.LINK_MONITOR }),
    });
  },

  created() {
    if (this.registerBeforeHook) {
      this.registerBeforeHook(this.updateBeforeSave);
    }
  },

  computed: {
    nodes() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const nodes = this.$store.getters[`${ inStore }/all`](NODE);

      return nodes.filter((n) => n.isEtcd !== 'true');
    },

    nics() {
      const inStore = this.$store.getters['currentProduct'].inStore;
      const linkMonitor = this.$store.getters[`${ inStore }/byId`](HCI.LINK_MONITOR, 'nic') || {};
      const linkStatus = linkMonitor?.status?.linkStatus || {};
      const nodes = this.nodes.map((n) => n.id);

      const out = [];

      // Collect all nics from all nodes
      Object.keys(linkStatus).map((nodeName) => {
        if (nodes.includes(nodeName)) {
          const nics = linkStatus[nodeName] || [];

          nics.map((nic) => {
            out.push({
              ...nic,
              nodeName,
            });
          });
        }
      });

      return out;
    },

    nicOptions() {
      const out = [];
      const seen = new Set();

      (this.nics || []).forEach((nic) => {
        if (!seen.has(nic.name)) {
          seen.add(nic.name);
          out.push({
            label: nic.name,
            value: nic.name,
          });
        }
      });

      return out.sort((a, b) => a.label.localeCompare(b.label));
    },

    nodeOptions() {
      return this.nodes.map((node) => ({
        label: node.id,
        value: node.id,
      }));
    },
  },

  methods: {
    removeCustomInterface(index) {
      this.customInterfaces.splice(index, 1);
    },

    updateBeforeSave() {
      if (!this.value.spec) {
        this.value.spec = {};
      }

      this.value.spec.defaultInterface = this.defaultInterface;
      this.value.spec.excludeNodes = this.excludedNodes;
      this.value.spec.customInterfaces = (this.customInterfaces || [])
        .filter((item) => item?.interface || (item?.nodes || []).length)
        .map((item) => ({
          interface: item.interface || '',
          nodes:     (item.nodes || []).filter((node) => !!node),
        }))
        .filter((item) => item.interface && item.nodes.length > 0);
    },
  }
};
</script>

<template>
  <CruResource
    :done-route="doneRoute"
    :resource="value"
    :mode="mode"
    :errors="errors"
    :apply-hooks="applyHooks"
    @finish="save"
    @error="e=>errors=e"
  >
    <NameNsDescription
      ref="nd"
      :value="value"
      :mode="mode"
      :namespaced="false"
      @update:value="$emit('update:value', $event)"
    />

    <ResourceTabs
      class="mt-15"
      :need-conditions="false"
      :need-related="false"
      :need-events="false"
      :side-tabs="true"
      :mode="mode"
    >
      <Tab
        name="Interfaces"
        label="Interfaces"
        :weight="99"
      >
        <LabeledSelect
          v-model:value="defaultInterface"
          class="mb-20"
          required
          :options="nicOptions"
          :mode="mode"
          :label="t('harvester.providerNetwork.defaultInterface.label')"
          :placeholder="t('harvester.providerNetwork.defaultInterface.placeholder')"
        />

        <hr class="section-divider" />

        <ArrayList
          v-model:value="customInterfaces"
          class="mb-20 custom-interface-list"
          :mode="mode"
          :title="t('harvester.providerNetwork.customInterfaces.label')"
          :protip="false"
          :remove-allowed="false"
          :initial-empty-row="true"
          :default-add-value="{ interface: '', nodes: [] }"
        >
          <template #add="{ add }">
            <div class="custom-interface-primary-add">
              <button
                type="button"
                class="btn role-primary"
                :disabled="mode === 'view'"
                @click="add"
              >
                {{ t('harvester.providerNetwork.customInterfaces.addLabel') }}
              </button>
            </div>
          </template>

          <template #column-headers>
            <div class="row custom-interface-header">
              <div class="col span-6">
                {{ t('harvester.providerNetwork.customInterfaces.interface.label') }}
              </div>
              <div class="col span-6">
                {{ t('harvester.providerNetwork.customInterfaces.nodes.label') }}
              </div>
            </div>
          </template>

          <template #columns="scope">
            <InfoBox class="custom-interface-box">
              <button
                v-if="mode !== 'view'"
                type="button"
                class="role-link btn btn-sm remove"
                @click="removeCustomInterface(scope.i)"
              >
                <i class="icon icon-x" />
              </button>

              <div class="custom-interface-content">
                <div class="row custom-interface-row interface-row">
                  <div class="col span-12 interface-col">
                    <h3 class="mb-10">
                      {{ t('harvester.providerNetwork.customInterfaces.interface.label') }}
                    </h3>
                    <LabeledSelect
                      v-model:value="scope.row.value.interface"
                      class="mb-20"
                      :label="''"
                      :options="nicOptions"
                      :mode="mode"
                      :placeholder="t('harvester.providerNetwork.customInterfaces.interface.placeholder')"
                    />
                  </div>
                </div>

                <div class="row custom-interface-row nodes-row">
                  <div class="col span-12">
                    <ArrayListSelect
                      v-model:value="scope.row.value.nodes"
                      :options="nodeOptions"
                      :mode="mode"
                      :disabled="mode === 'view'"
                      :enable-default-add-value="false"
                      :array-list-props="{
                        addLabel: t('harvester.providerNetwork.customInterfaces.nodes.addLabel'),
                        initialEmptyRow: true,
                        title: t('harvester.providerNetwork.customInterfaces.nodes.label'),
                        required: false,
                        protip: false,
                      }"
                      :select-props="{
                        placeholder: t('harvester.providerNetwork.customInterfaces.nodes.placeholder'),
                        disabled: mode === 'view',
                      }"
                    >
                      <template #add="{ add }">
                        <div class="custom-interface-add">
                          <button
                            type="button"
                            class="btn role-tertiary add"
                            :disabled="mode === 'view'"
                            @click="add"
                          >
                            {{ t('harvester.providerNetwork.customInterfaces.nodes.addLabel') }}
                          </button>
                        </div>
                      </template>
                    </ArrayListSelect>
                  </div>
                </div>
              </div>
            </InfoBox>
          </template>
        </ArrayList>
      </Tab>

      <Tab
        name="excludedNodes"
        :label="t('harvester.providerNetwork.excludedNodes.label')"
        :weight="98"
      >
        <div class="row">
          <div class="col span-12">
            <ArrayListSelect
              v-model:value="excludedNodes"
              :options="nodeOptions"
              :disabled="mode === 'view'"
              :mode="mode"
              :enable-default-add-value="false"
              :array-list-props="{
                addLabel: t('harvester.providerNetwork.excludedNodes.addLabel'),
                initialEmptyRow: true,
                required: false,
                protip: false,
              }"
              :select-props="{
                placeholder: t('harvester.providerNetwork.excludedNodes.placeholder'),
                disabled: mode === 'view',
              }"
            />
          </div>
        </div>
      </Tab>
    </ResourceTabs>
  </CruResource>
</template>

<style lang="scss" scoped>
.section-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 10px 0 20px;
}

.custom-interface-header {
  margin-bottom: 10px;
  font-weight: 600;
}

.custom-interface-row {
  align-items: flex-start;
}

.interface-row {
  width: calc(100% - 90px);
  margin-bottom: 10px;
}

.nodes-row {
  align-items: flex-start;
}

.custom-interface-add {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

:deep(.nodes-row .array-list-select .box) {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

:deep(.nodes-row .array-list-select .box .remove) {
  align-self: center;
}

.custom-interface-primary-add {
  max-width: 100%;
}

.custom-interface-box {
  position: relative;
  width: 100%;
  padding: 20px;
  margin-bottom: 5px;
}

:deep(.custom-interface-list .box) {
  grid-template-columns: 1fr;
}

.remove {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  padding: 0;
}
</style>
