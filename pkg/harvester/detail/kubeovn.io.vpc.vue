<script>
import { VueFlow, Handle } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { allHash } from '@shell/utils/promise';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import { HCI } from '../types';

const NETWORK_PROVIDERS = { OVN: 'ovn', OVERLAY: 'overlay' };

const THEME_COLORS = {
  VPC:       '#2453ff',
  SUBNET:    '#fe7c3f',
  OVERLAY:   '#9333ea',
  VM:        '#00bda7',
  STOPPED:   '#9ca3af',
  TEXT:      '#000000',
  MUTED:     '#6b7280',
  BG_STOP:   '#f3f4f6',
  LINK_GRAY: '#9ca3af',
};

const LAYOUT = {
  VMS_PER_ROW:    5,
  BASE_PADDING:   24,
  VERTICAL_GAP:   40,
  HORIZONTAL_GAP: 30,
  NODE_WIDTH:     230,
  VM_ROW_HEIGHT:  120,
};

export default {
  name: 'VPCDetail',

  components: {
    VueFlow,
    Handle,
    Background,
    Controls,
    MiniMap,
    Checkbox,
  },

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  data() {
    return {
      nodes:          [],
      edges:          [],
      loading:        true,
      selectedNodeId: null,
      relatedIds:     new Set(),
      showVPC:        true,
      showSubnets:    true,
      showVMs:        true,
      showOverlays:   true,
    };
  },

  async fetch() {
    const store = this.$store.getters['currentProduct'].inStore;

    try {
      await allHash({
        subnets:            this.$store.dispatch(`${ store }/findAll`, { type: HCI.SUBNET }),
        ips:                this.$store.dispatch(`${ store }/findAll`, { type: HCI.IP }),
        vms:                this.$store.dispatch(`${ store }/findAll`, { type: HCI.VM }),
        clusterNetworks:    this.$store.dispatch(`${ store }/findAll`, { type: HCI.CLUSTER_NETWORK }),
        networkAttachments: this.$store
          .dispatch(`${ store }/findAll`, { type: HCI.NETWORK_ATTACHMENT })
          .catch(() => []),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch VPC resources:', error);
    }
    await this.loadTopology();
  },

  computed: {
    inStore() {
      return this.$store.getters['currentProduct']?.inStore || 'cluster';
    },
    allSubnets() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.SUBNET) || [];
    },
    allIps() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.IP) || [];
    },
    allVMs() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.VM) || [];
    },
    allNetworkAttachments() {
      try {
        return this.$store.getters[`${ this.inStore }/all`](HCI.NETWORK_ATTACHMENT) || [];
      } catch {
        return [];
      }
    },

    subnetCount() {
      return this.nodes.filter((node) => node.type === 'subnet').length;
    },
    overlayCount() {
      return this.nodes.filter((node) => node.type === 'overlay-network').length;
    },
    vmCount() {
      return this.nodes.filter((node) => node.type && node.type.includes('vm')).length;
    },

    backgroundPatternColor() {
      return this.getCssVar('--default-active-bg') || '#f1f1f1';
    },
    layoutConfig() {
      return LAYOUT;
    },
    colors() {
      return THEME_COLORS;
    },

    visibilityOptions() {
      return [
        {
          modelKey: 'showVPC', label: 'VPC', badgeKey: 'VPC', count: 1
        },
        {
          modelKey: 'showSubnets', label: 'Subnets', badgeKey: 'SUBNET', count: this.subnetCount
        },
        {
          modelKey: 'showOverlays', label: 'Overlay Networks', badgeKey: 'OVERLAY', count: this.overlayCount, disabled: !this.showSubnets
        },
        {
          modelKey: 'showVMs', label: 'VMs', badgeKey: 'VM', count: this.vmCount
        },
      ];
    },

    filteredNodes() {
      return this.nodes
        .filter((node) => {
          const type = node.type;

          if (type === 'vpc' && !this.showVPC) return false;
          if ((type === 'subnet' || type === 'group' || type === 'overlay-network') && !this.showSubnets) return false;
          if (type === 'overlay-network' && !this.showOverlays) return false;
          if (type.includes('vm') && !this.showVMs) return false;

          return true;
        })
        .map((node) => {
          const isTarget = this.selectedNodeId === node.id;
          const isRelated = this.selectedNodeId && (this.relatedIds.has(node.id) || node.type === 'vpc');
          const isDimmed = this.selectedNodeId && node.type !== 'group' && !isRelated && !isTarget;

          let stateClass = '';
          let zIndex = node.zIndex || 1;

          if (this.selectedNodeId) {
            if (isTarget) {
              stateClass = 'node-focused';
              zIndex = 1000;
            } else if (isRelated) {
              stateClass = 'node-related';
              zIndex = 999;
            } else if (isDimmed) {
              stateClass = 'node-dimmed';
              zIndex = 0;
            }
          }

          return {
            ...node,
            data:  { ...node.data, stateClass },
            style: { ...node.style, zIndex },
          };
        });
    },

    filteredEdges() {
      const visibleIds = new Set(this.filteredNodes.map((node) => node.id));

      return this.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => {
          const isRelated = !this.selectedNodeId || (this.relatedIds.has(edge.source) && this.relatedIds.has(edge.target));

          return {
            ...edge,
            class:    isRelated ? '' : 'dimmed',
            animated: edge.animated && isRelated,
          };
        });
    },
  },

  watch: {
    allSubnets: {
      handler() {
        if (!this.loading) this.loadTopology();
      },
      deep: true
    },
    allVMs:     {
      handler() {
        if (!this.loading) this.loadTopology();
      },
      deep: true
    },
    'value.metadata.resourceVersion'() {
      if (!this.loading) this.loadTopology();
    },
    showSubnets(newValue) {
      this.showOverlays = newValue;
    },
  },

  methods: {
    prepareResources(vpcName) {
      const vpcSubnets = this.allSubnets.filter((subnet) => subnet.spec?.vpc === vpcName);
      const vmToSubnetsMap = {};
      const vmToDetailsMap = {};

      this.allIps.forEach((ip) => {
        const podName = ip.spec?.podName;
        const subnetName = ip.spec?.subnet;

        if (podName && subnetName && this.allVMs.find((vm) => vm.metadata?.name === podName)) {
          if (!vmToSubnetsMap[podName]) {
            vmToSubnetsMap[podName] = [];
            vmToDetailsMap[podName] = [];
          }
          if (!vmToSubnetsMap[podName].includes(subnetName)) {
            vmToSubnetsMap[podName].push(subnetName);
            vmToDetailsMap[podName].push({
              mac:    ip.spec?.macAddress || 'N/A',
              ip:     ip.spec?.ipAddress,
              subnet: subnetName,
            });
          }
        }
      });

      const filteredVMs = this.allVMs.filter((vm) => {
        const subnets = vmToSubnetsMap[vm.metadata?.name] || [];

        return subnets.some((name) => vpcSubnets.some((s) => s.metadata.name === name));
      });

      return {
        vpcSubnets, vmToSubnetsMap, vmToDetailsMap, vpcVMs: filteredVMs
      };
    },

    async loadTopology() {
      if (this._loadingTopology) return;
      this._loadingTopology = true;
      this.loading = true;

      try {
        const vpc = this.value;
        const {
          vpcSubnets, vmToSubnetsMap, vmToDetailsMap, vpcVMs
        } = this.prepareResources(vpc.metadata.name);

        const nodes = [];
        const edges = [];

        let currentX = LAYOUT.BASE_PADDING * 2;
        const subnetXPositions = vpcSubnets.map(() => {
          const position = currentX;

          currentX += LAYOUT.NODE_WIDTH + (LAYOUT.BASE_PADDING * 2) + LAYOUT.HORIZONTAL_GAP;

          return position;
        });

        nodes.push({
          id:       'vpc',
          type:     'vpc',
          position: { x: currentX / 2, y: LAYOUT.BASE_PADDING },
          data:     { name: vpc.metadata.name },
          style:    { width: `${ LAYOUT.NODE_WIDTH }px` },
        });

        const subnetY = LAYOUT.BASE_PADDING + 100;

        vpcSubnets.forEach((subnet, index) => {
          this.createNetworkNodes(nodes, edges, subnet, subnetXPositions[index], subnetY);
        });

        const vmStartY = subnetY + 400;

        this.createVMNodes({
          nodes, edges, vpcVMs, vpcSubnets, subnetXPositions, vmToSubnetsMap, vmToDetailsMap, vmStartY
        });

        this.nodes = nodes;
        this.edges = edges;

        this.$nextTick(() => this.resizeGroups());
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Topology Load Error:', error);
      } finally {
        this.loading = false;
        this._loadingTopology = false;
      }
    },

    createNetworkNodes(nodes, edges, subnet, x, y) {
      const subnetName = subnet.metadata.name;
      const subnetNodeId = `subnet-${ subnetName }`;
      const provider = subnet.spec?.provider || NETWORK_PROVIDERS.OVN;
      const hasOverlay = provider !== NETWORK_PROVIDERS.OVN && provider.trim() !== '';

      if (hasOverlay) {
        const groupId = `group-${ subnetName }`;
        const nad = this.allNetworkAttachments.find((n) => n.id === provider || n.metadata?.name === provider);
        const overlayName = nad?.metadata?.name || provider.split('/').pop();
        const clusterNetwork = nad?.metadata?.labels?.[HCI.CLUSTER_NETWORK] || 'mgmt';
        const overlayNodeId = `overlay-${ provider.replace(/\//g, '-') }`;

        nodes.push({
          id:       groupId,
          type:     'group',
          position: { x, y },
          data:     { type: 'group' },
          style:    {
            background:   'rgba(0,0,0,0.05)',
            borderRadius: '16px',
            padding:      `${ LAYOUT.BASE_PADDING }px`,
          },
          zIndex:     -1,
          selectable: false,
        });

        nodes.push({
          id:         subnetNodeId,
          type:       'subnet',
          parentNode: groupId,
          extent:     'parent',
          position:   { x: LAYOUT.BASE_PADDING, y: LAYOUT.BASE_PADDING },
          data:       {
            name:     subnetName,
            cidr:     subnet.spec?.cidrBlock,
            provider: provider.split('/').pop(),
          },
          style: { width: `${ LAYOUT.NODE_WIDTH }px` },
        });

        nodes.push({
          id:         overlayNodeId,
          type:       'overlay-network',
          parentNode: groupId,
          extent:     'parent',
          position:   { x: LAYOUT.BASE_PADDING, y: 150 },
          data:       {
            name: overlayName, nadType: 'overlay', clusterNetwork, subnetId: subnetNodeId
          },
          style: { width: `${ LAYOUT.NODE_WIDTH }px` },
        });

        edges.push({
          id:       `link-${ subnetName }`,
          source:   subnetNodeId,
          target:   overlayNodeId,
          type:     'straight',
          animated: false,
          style:    {
            stroke: THEME_COLORS.LINK_GRAY, strokeWidth: 2, strokeDasharray: '4,4'
          },
        });
      } else {
        nodes.push({
          id:       subnetNodeId,
          type:     'subnet',
          position: { x, y: y + LAYOUT.BASE_PADDING },
          data:     {
            name:     subnetName,
            cidr:     subnet.spec?.cidrBlock,
            provider: NETWORK_PROVIDERS.OVN,
          },
          style: { width: `${ LAYOUT.NODE_WIDTH }px` },
        });
      }

      edges.push({
        id: `vpc-to-${ subnetName }`, source: 'vpc', target: subnetNodeId, animated: true, style: { stroke: THEME_COLORS.VPC, strokeWidth: 2 }
      });
    },

    createVMNodes({
      nodes, edges, vpcVMs, vpcSubnets, subnetXPositions, vmToSubnetsMap, vmToDetailsMap, vmStartY
    }) {
      const columnTrackers = {};

      vpcSubnets.forEach((subnet, index) => {
        columnTrackers[subnet.metadata.name] = {
          x:     subnetXPositions[index] + LAYOUT.BASE_PADDING,
          row:   0,
          count: 0,
        };
      });

      const processedVMs = new Set();

      const renderVM = (vm, isMulti) => {
        const vmName = vm.metadata?.name;

        if (isMulti && processedVMs.has(vmName)) return;
        processedVMs.add(vmName);

        const primarySubnet = vmToSubnetsMap[vmName]?.[0];

        if (!columnTrackers[primarySubnet]) return;

        const tracker = columnTrackers[primarySubnet];

        if (tracker.count >= LAYOUT.VMS_PER_ROW) {
          tracker.row++;
          tracker.count = 0;
          const subnetIndex = vpcSubnets.findIndex((s) => s.metadata.name === primarySubnet);

          tracker.x = subnetXPositions[subnetIndex] + LAYOUT.BASE_PADDING;
        }

        const status = (vm.status?.printableStatus || '').toLowerCase();
        const isStopped = ['stopped', 'off', 'paused', 'shutoff'].includes(status);
        const vmId = `vm-${ vmName }`;

        nodes.push({
          id:       vmId,
          type:     isMulti ? 'multi-network-vm' : 'vm',
          position: { x: tracker.x, y: vmStartY + (tracker.row * LAYOUT.VM_ROW_HEIGHT) },
          data:     {
            name:       vmName,
            isStopped,
            interfaces: vmToDetailsMap[vmName] || [],
          },
          style:  { width: `${ LAYOUT.NODE_WIDTH }px` },
          zIndex: 10,
        });

        tracker.x += LAYOUT.NODE_WIDTH + 20;
        tracker.count++;

        (vmToSubnetsMap[vmName] || []).forEach((name) => {
          const targetSubnet = vpcSubnets.find((s) => s.metadata.name === name);
          const provider = targetSubnet?.spec?.provider || NETWORK_PROVIDERS.OVN;
          const sourceId = (provider !== NETWORK_PROVIDERS.OVN) ? `overlay-${ provider.replace(/\//g, '-') }` : `subnet-${ name }`;

          edges.push({
            id:       `edge-${ name }-to-${ vmName }`,
            source:   sourceId,
            target:   vmId,
            animated: !isStopped,
            style:    {
              stroke:          isStopped ? THEME_COLORS.STOPPED : THEME_COLORS.VM,
              strokeWidth:     1,
              strokeDasharray: '5,5',
              opacity:         isStopped ? 0.4 : 1,
            },
          });
        });
      };

      vpcVMs.filter((v) => (vmToSubnetsMap[v.metadata.name] || []).length === 1).forEach((v) => renderVM(v, false));
      vpcVMs.filter((v) => (vmToSubnetsMap[v.metadata.name] || []).length > 1).forEach((v) => renderVM(v, true));
    },

    resizeGroups() {
      this.nodes.forEach((groupNode) => {
        if (groupNode.type === 'group') {
          const subnetNode = this.nodes.find((n) => n.parentNode === groupNode.id && n.type === 'subnet');
          const overlayNode = this.nodes.find((n) => n.parentNode === groupNode.id && n.type === 'overlay-network');

          if (subnetNode && overlayNode) {
            const subnetElement = document.querySelector(`[data-id="${ subnetNode.id }"] .custom-node`);
            const overlayElement = document.querySelector(`[data-id="${ overlayNode.id }"] .custom-node`);

            if (subnetElement && overlayElement) {
              const subnetHeight = subnetElement.offsetHeight;
              const overlayHeight = overlayElement.offsetHeight;
              const groupWidth = LAYOUT.NODE_WIDTH + (LAYOUT.BASE_PADDING * 2);
              const groupHeight = LAYOUT.BASE_PADDING + subnetHeight + 30 + overlayHeight + LAYOUT.BASE_PADDING;

              groupNode.style.width = `${ groupWidth }px`;
              groupNode.style.height = `${ groupHeight }px`;
              subnetNode.position = { x: LAYOUT.BASE_PADDING, y: LAYOUT.BASE_PADDING };
              overlayNode.position = { x: LAYOUT.BASE_PADDING, y: LAYOUT.BASE_PADDING + subnetHeight + 30 };
            }
          }
        }
      });
    },

    onNodeClick({ node }) {
      if (node.type === 'group') return;
      if (this.selectedNodeId === node.id) {
        this.selectedNodeId = null;
        this.relatedIds.clear();

        return;
      }
      this.selectedNodeId = node.id;
      const related = new Set([node.id]);

      const traverse = (id, direction) => {
        this.edges.forEach((edge) => {
          const nextId = (direction === 'down') ? (edge.source === id ? edge.target : null) : (edge.target === id ? edge.source : null);

          if (nextId && !related.has(nextId)) {
            related.add(nextId);
            traverse(nextId, direction);
          }
        });
      };

      traverse(node.id, 'down');
      traverse(node.id, 'up');
      this.relatedIds = related;
    },

    onPaneClick() {
      this.selectedNodeId = null;
      this.relatedIds.clear();
    },

    getCssVar(name) {
      return getComputedStyle(document.body).getPropertyValue(name).trim();
    },
  },
};
</script>

<template>
  <div class="vpc-topology">
    <div class="topology-header">
      <div class="visibility-controls">
        <Checkbox
          v-for="option in visibilityOptions"
          :key="option.modelKey"
          v-model:value="$data[option.modelKey]"
          class="control-item"
          :label="option.label"
          :disabled="option.disabled"
        >
          <template #label>
            {{ option.label }}
            <span
              class="count-badge"
              :style="{
                background: colors[option.badgeKey],
                opacity: option.disabled ? 0.4 : 1,
              }"
            >{{ option.count }}</span>
          </template>
        </Checkbox>
      </div>
    </div>

    <div
      v-if="loading"
      class="loading"
    >
      <i class="icon icon-spinner icon-spin" /> Loading topology...
    </div>
    <div
      v-else-if="nodes.length === 0"
      class="empty-state"
    >
      <i class="icon icon-info" />
      <p>No resources found</p>
    </div>

    <VueFlow
      v-else
      :nodes="filteredNodes"
      :edges="filteredEdges"
      class="vpc-flow"
      fit-view-on-init
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <template #node-vpc="{ data }">
        <Handle
          type="source"
          position="bottom"
        />
        <div
          class="custom-node vpc-node"
          :class="data.stateClass"
          :style="{
            width: layoutConfig.NODE_WIDTH + 'px',
            border: `2px solid ${colors.VPC}`,
          }"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
        </div>
      </template>

      <template #node-group></template>

      <template #node-subnet="{ data }">
        <Handle
          type="target"
          position="top"
          style="left: 50%"
        /><Handle
          type="source"
          position="bottom"
          style="left: 50%"
        />
        <div
          class="custom-node subnet-node"
          :class="data.stateClass"
          :style="{ width: '100%', border: `2px solid ${colors.SUBNET}` }"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
          <div class="node-details">
            <div>CIDR: {{ data.cidr }}</div>
            <div>Provider: {{ data.provider }}</div>
          </div>
        </div>
      </template>

      <template #node-overlay-network="{ data }">
        <Handle
          type="target"
          position="top"
          style="left: 50%"
        /><Handle
          type="source"
          position="bottom"
          style="left: 50%"
        />
        <div
          class="custom-node overlay-node"
          :class="data.stateClass"
          :style="{ width: '100%', border: `2px dashed ${colors.OVERLAY}` }"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
          <div class="node-details">
            <div>Type: {{ data.nadType }}</div>
            <div>Cluster Network: {{ data.clusterNetwork }}</div>
          </div>
        </div>
      </template>

      <template #node-vm="{ data }">
        <Handle
          type="target"
          position="top"
        />
        <div
          class="custom-node vm-node"
          :class="[data.stateClass, { stopped: data.isStopped }]"
          :style="{
            width: layoutConfig.NODE_WIDTH + 'px',
            border: data.isStopped
              ? `2px dashed ${colors.STOPPED}`
              : `2px solid ${colors.VM}`,
            backgroundColor: data.isStopped ? colors.BG_STOP : '#ffffff',
          }"
        >
          <div class="node-header">
            <span
              class="status-indicator"
              :class="data.isStopped ? 'is-stopped' : 'is-running'"
            ></span>
            <div class="node-name">
              {{ data.name }}
            </div>
          </div>
          <div class="node-details">
            <div
              v-for="(iface, idx) in data.interfaces"
              :key="idx"
              class="interface-group"
            >
              <div class="ip-text">
                IP: {{ iface.ip }}
              </div>
              <div class="mac-text-static">
                MAC: {{ iface.mac }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #node-multi-network-vm="{ data }">
        <Handle
          type="target"
          position="top"
        />
        <div
          class="custom-node vm-node"
          :class="[data.stateClass, { stopped: data.isStopped }]"
          :style="{
            width: layoutConfig.NODE_WIDTH + 'px',
            border: data.isStopped
              ? `2px dashed ${colors.STOPPED}`
              : `2px solid ${colors.VM}`,
            backgroundColor: data.isStopped ? colors.BG_STOP : '#ffffff',
          }"
        >
          <div class="node-header">
            <span
              class="status-indicator"
              :class="data.isStopped ? 'is-stopped' : 'is-running'"
            ></span>
            <div class="node-name">
              {{ data.name }}
            </div>
          </div>
          <div class="node-details">
            <div
              v-for="(iface, idx) in data.interfaces"
              :key="idx"
              class="interface-group"
            >
              <div class="ip-text">
                IP: {{ iface.ip }}
              </div>
              <div class="mac-text-static">
                MAC: {{ iface.mac }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <Background
        :pattern-color="backgroundPatternColor"
        :gap="12"
        size="1"
      />
      <Controls /><MiniMap />
    </VueFlow>
  </div>
</template>

<style lang="scss" scoped>
$transition-duration: 0.5s;
$transition-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
$transition-ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

.vpc-topology {
  height: 800px;
  width: 100%;
  background: var(--body-bg);
  border-radius: 4px;
  overflow: hidden;
  .topology-header {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    .visibility-controls {
      display: flex;
      gap: 24px;
      align-items: center;
      margin-left: 12px;
      .control-item {
        display: flex;
        align-items: center;
        cursor: pointer;
        ::v-deep .checkbox-label {
          display: flex;
          align-items: center;
          line-height: 1;
        }
        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 8px;
          border-radius: 30px;
          font-size: 12px;
          min-width: 20px;
          height: 20px;
          text-align: center;
          color: #ffffff;
          margin-left: 8px;
          line-height: 1;
        }
      }
    }
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100% - 100px);
    font-size: 16px;
    color: var(--muted);
    i {
      margin-right: 10px;
      font-size: 20px;
    }
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: calc(100% - 100px);
    color: var(--muted);
    i {
      font-size: 48px;
      margin-bottom: 16px;
    }
    p {
      font-size: 16px;
      margin: 0;
    }
  }
  .vpc-flow {
    height: calc(100% - 100px);
  }

  .vue-flow__node {
    transition: all $transition-duration $transition-ease-spring;
  }
  ::v-deep(.vue-flow__edge) {
    transition: opacity $transition-duration $transition-ease-smooth,
      filter $transition-duration $transition-ease-smooth;
    path {
      transition: stroke-dasharray 0.4s ease;
    }
    &.dimmed {
      opacity: 0.05 !important;
      filter: grayscale(90%);
      path {
        stroke-dasharray: 5 !important;
      }
    }
  }

  .custom-node {
    padding: 10px;
    font-size: 13px;
    line-height: 1.4;
    color: #000000;
    box-sizing: border-box;
    background: #ffffff;
    border-radius: 12px;
    height: auto;
    transition: transform $transition-duration $transition-ease-spring,
      opacity $transition-duration $transition-ease-smooth,
      box-shadow $transition-duration $transition-ease-smooth,
      filter $transition-duration $transition-ease-smooth,
      background-color $transition-duration $transition-ease-smooth;
    opacity: 1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

    .node-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
    }
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      flex-shrink: 0;
      &.is-running {
        background-color: #00bda7;
        box-shadow: 0 0 6px rgba(0, 189, 167, 0.6);
      }
      &.is-stopped {
        background-color: #9ca3af;
      }
    }

    .node-name {
      font-weight: 600;
      font-size: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-details {
      font-size: 14px;
    }

    .interface-group {
      &:not(:first-child) {
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #eee;
      }
    }

    &.node-focused {
      transform: scale(1.03) translateY(-4px);
      z-index: 1000;
      opacity: 1 !important;
      box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.15),
        0 0 0 3px rgba(36, 83, 255, 0.15);
      background-color: #fafafa;
    }
    &.node-related {
      transform: scale(1.03);
      z-index: 999;
      opacity: 1 !important;
      box-shadow: 0 8px 20px -3px rgba(0, 0, 0, 0.08);
    }
    &.node-dimmed {
      opacity: 0.3;
      filter: grayscale(85%);
      transform: scale(0.98);
    }
  }
}
</style>
