<script>
import { VueFlow, Handle } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { allHash } from '@shell/utils/promise';
import { NETWORK_ATTACHMENT } from '@shell/config/types';
import Checkbox from '@components/Form/Checkbox/Checkbox.vue';
import { HCI } from '../types';
import { NETWORK_TYPE } from '../config/types';

const NETWORK_PROVIDERS = { OVN: 'ovn' };

const NODE_TYPES = {
  VPC:              'vpc',
  GROUP:            'group',
  SUBNET:           'subnet',
  OVERLAY_NETWORK:  'overlay-network',
  VM:               'vm',
  MULTI_NETWORK_VM: 'multi-network-vm',
};

const STOPPED_VM_STATUSES = ['stopped', 'paused'];

const THEME_COLORS = {
  VPC:        '#2453ff',
  BG_VPC:     'rgba(36, 83, 255, 0.1)',
  SUBNET:     '#fe7c3f',
  BG_SUBNET:  'rgba(254, 124, 63, 0.1)',
  OVERLAY:    '#cb1fdb',
  BG_OVERLAY: 'rgba(203, 31, 219, 0.1)',
  VM:         '#00bda7',
  BG_VM:      'rgba(0, 189, 167, 0.1)',
  STOPPED:    '#9ca3af',
  BG_STOPPED: 'rgba(156, 163, 175, 0.1)',
  LINK_GRAY:  '#9ca3af',
};

const LAYOUT = {
  VMS_PER_ROW:    5,
  BASE_PADDING:   24,
  VERTICAL_GAP:   40,
  HORIZONTAL_GAP: 30,
  NODE_WIDTH:     230,
  VM_ROW_HEIGHT:  120,
  GROUP_NODE_GAP: 30,
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
        networkAttachments: this.$store.dispatch(`${ store }/findAll`, { type: NETWORK_ATTACHMENT })
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
      return this.$store.getters[`${ this.inStore }/all`](NETWORK_ATTACHMENT) || [];
    },

    subnetCount() {
      return this.nodes.filter((node) => node.type === NODE_TYPES.SUBNET)
        .length;
    },
    overlayCount() {
      return this.nodes.filter(
        (node) => node.type === NODE_TYPES.OVERLAY_NETWORK,
      ).length;
    },
    vmCount() {
      return this.nodes.filter(
        (node) => node.type && node.type.includes(NODE_TYPES.VM),
      ).length;
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
    topologyCssVars() {
      return {
        '--node-vpc-color':        this.colors.VPC,
        '--node-vpc-bg':           this.colors.BG_VPC,
        '--node-subnet-color':     this.colors.SUBNET,
        '--node-subnet-bg':        this.colors.BG_SUBNET,
        '--node-overlay-color':    this.colors.OVERLAY,
        '--node-overlay-bg':       this.colors.BG_OVERLAY,
        '--node-vm-color':         this.colors.VM,
        '--node-vm-bg':            this.colors.BG_VM,
        '--node-vm-stopped-color': this.colors.STOPPED,
        '--node-vm-stopped-bg':    this.colors.BG_STOPPED,
        '--badge-vpc-bg':          this.colors.VPC,
        '--badge-subnet-bg':       this.colors.SUBNET,
        '--badge-overlay-bg':      this.colors.OVERLAY,
        '--badge-vm-bg':           this.colors.VM,
        '--status-running-color':  this.colors.VM,
        '--status-running-glow':   'rgba(0, 189, 167, 0.6)',
        '--status-stopped-color':  this.colors.STOPPED,
      };
    },

    visibilityOptions() {
      const options = [
        {
          modelKey:   'showVPC',
          label:      this.t('harvester.vpc.topology.visibility.vpc'),
          badgeClass: 'badge-vpc',
          count:      this.nodes.filter((node) => node.type === NODE_TYPES.VPC).length,
        },
        {
          modelKey:   'showSubnets',
          label:      this.t('harvester.vpc.topology.visibility.subnets'),
          badgeClass: 'badge-subnet',
          count:      this.subnetCount,
        },
        {
          modelKey:   'showOverlays',
          label:      this.t('harvester.vpc.topology.visibility.overlayNetworks'),
          badgeClass: 'badge-overlay',
          count:      this.overlayCount,
          disabled:   !this.showSubnets,
        },
        {
          modelKey:   'showVMs',
          label:      this.t('harvester.vpc.topology.visibility.vms'),
          badgeClass: 'badge-vm',
          count:      this.vmCount,
        },
      ];

      return options.filter((option) => option.count > 0);
    },

    filteredNodes() {
      return this.nodes
        .filter((node) => {
          const type = node.type;

          if (type === NODE_TYPES.VPC && !this.showVPC) return false;
          if (this.isSubnetScopedType(type) && !this.showSubnets) return false;
          if (type === NODE_TYPES.OVERLAY_NETWORK && !this.showOverlays) {
            return false;
          }
          if (this.isVmType(type) && !this.showVMs) return false;

          return true;
        })
        .map((node) => {
          const { stateClass, zIndex } = this.getNodeState(node);

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
        .filter(
          (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
        )
        .map((edge) => {
          const isRelated =
            !this.selectedNodeId ||
            (this.relatedIds.has(edge.source) &&
              this.relatedIds.has(edge.target));

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
      deep: true,
    },
    allVMs: {
      handler() {
        if (!this.loading) this.loadTopology();
      },
      deep: true,
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
      const vpcSubnets = this.allSubnets.filter(
        (subnet) => subnet.spec?.vpc === vpcName,
      );
      const vmToSubnetsMap = {};
      const vmToDetailsMap = {};
      const vmNames = new Set(
        this.allVMs.map((vm) => vm.metadata?.name).filter(Boolean),
      );

      this.allIps.forEach((ip) => {
        const podName = ip.spec?.podName;
        const subnetName = ip.spec?.subnet;

        if (podName && subnetName && vmNames.has(podName)) {
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

        return subnets.some((name) => vpcSubnets.some((s) => s.metadata.name === name),
        );
      });

      return {
        vpcSubnets,
        vmToSubnetsMap,
        vmToDetailsMap,
        vpcVMs: filteredVMs,
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
        } =
          this.prepareResources(vpc.metadata.name);

        const nodes = [];
        const edges = [];

        let currentX = LAYOUT.BASE_PADDING * 2;
        const subnetXPositions = vpcSubnets.map(() => {
          const position = currentX;

          currentX +=
            LAYOUT.NODE_WIDTH + LAYOUT.BASE_PADDING * 2 + LAYOUT.HORIZONTAL_GAP;

          return position;
        });

        nodes.push({
          id:       NODE_TYPES.VPC,
          type:     NODE_TYPES.VPC,
          position: { x: currentX / 2, y: LAYOUT.BASE_PADDING },
          data:     { name: vpc.metadata.name },
          style:    { width: `${ LAYOUT.NODE_WIDTH }px` },
        });

        const subnetY = LAYOUT.BASE_PADDING + 100;

        vpcSubnets.forEach((subnet, index) => {
          this.createNetworkNodes(
            nodes,
            edges,
            subnet,
            subnetXPositions[index],
            subnetY,
          );
        });

        const vmStartY = subnetY + 400;

        this.createVMNodes({
          nodes,
          edges,
          vpcVMs,
          vpcSubnets,
          subnetXPositions,
          vmToSubnetsMap,
          vmToDetailsMap,
          vmStartY,
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
      const hasOverlay =
        provider !== NETWORK_PROVIDERS.OVN && provider.trim() !== '';

      if (hasOverlay) {
        const groupId = `group-${ subnetName }`;

        const nad = this.allNetworkAttachments.find(
          (networkAttachment) => {
            return networkAttachment?.parseConfig?.provider === provider;
          }
        );

        const overlayName =
          nad?.parseConfig?.name || nad?.metadata?.name;

        const clusterNetwork =
          nad?.metadata?.labels?.[HCI.CLUSTER_NETWORK] || 'mgmt';

        const nadType = nad?.metadata?.labels?.[HCI.NETWORK_TYPE] ||
          NETWORK_TYPE.OVERLAY;
        const overlayNodeId = `overlay-${ provider.replace(/\//g, '-') }`;

        nodes.push({
          id:       groupId,
          type:     NODE_TYPES.GROUP,
          position: { x, y },
          data:     { type: NODE_TYPES.GROUP },
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
          type:       NODE_TYPES.SUBNET,
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
          type:       NODE_TYPES.OVERLAY_NETWORK,
          parentNode: groupId,
          extent:     'parent',
          position:   { x: LAYOUT.BASE_PADDING, y: 150 },
          data:       {
            name:     overlayName,
            nadType,
            clusterNetwork,
            subnetId: subnetNodeId,
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
            stroke:          THEME_COLORS.LINK_GRAY,
            strokeWidth:     2,
            strokeDasharray: '4,4',
          },
        });
      } else {
        nodes.push({
          id:       subnetNodeId,
          type:     NODE_TYPES.SUBNET,
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
        id:       `vpc-to-${ subnetName }`,
        source:   NODE_TYPES.VPC,
        target:   subnetNodeId,
        animated: true,
        style:    { stroke: THEME_COLORS.VPC, strokeWidth: 2 },
      });
    },

    createVMNodes({
      nodes,
      edges,
      vpcVMs,
      vpcSubnets,
      subnetXPositions,
      vmToSubnetsMap,
      vmToDetailsMap,
      vmStartY,
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
          const subnetIndex = vpcSubnets.findIndex(
            (s) => s.metadata.name === primarySubnet,
          );

          tracker.x = subnetXPositions[subnetIndex] + LAYOUT.BASE_PADDING;
        }

        const status = (vm.status?.printableStatus || '').toLowerCase();
        const isStopped = STOPPED_VM_STATUSES.includes(status);

        const vmId = `vm-${ vmName }`;

        nodes.push({
          id:       vmId,
          type:     isMulti ? NODE_TYPES.MULTI_NETWORK_VM : NODE_TYPES.VM,
          position: {
            x: tracker.x,
            y: vmStartY + tracker.row * LAYOUT.VM_ROW_HEIGHT,
          },
          data: {
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
          const provider =
            targetSubnet?.spec?.provider || NETWORK_PROVIDERS.OVN;
          const sourceId =
            provider !== NETWORK_PROVIDERS.OVN ? `overlay-${ provider.replace(/\//g, '-') }` : `subnet-${ name }`;

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

      vpcVMs
        .filter((v) => (vmToSubnetsMap[v.metadata.name] || []).length === 1)
        .forEach((v) => renderVM(v, false));
      vpcVMs
        .filter((v) => (vmToSubnetsMap[v.metadata.name] || []).length > 1)
        .forEach((v) => renderVM(v, true));
    },

    resizeGroups() {
      this.nodes.forEach((groupNode) => {
        if (groupNode.type === NODE_TYPES.GROUP) {
          const subnetNode = this.nodes.find(
            (node) => node.parentNode === groupNode.id &&
              node.type === NODE_TYPES.SUBNET,
          );
          const overlayNode = this.nodes.find(
            (node) => node.parentNode === groupNode.id &&
              node.type === NODE_TYPES.OVERLAY_NETWORK,
          );

          if (subnetNode && overlayNode) {
            const subnetElement = document.querySelector(
              `[data-id="${ subnetNode.id }"] .custom-node`,
            );
            const overlayElement = document.querySelector(
              `[data-id="${ overlayNode.id }"] .custom-node`,
            );

            if (subnetElement && overlayElement) {
              const subnetWidth = subnetElement.offsetWidth;
              const subnetHeight = subnetElement.offsetHeight;
              const overlayWidth = overlayElement.offsetWidth;
              const overlayHeight = overlayElement.offsetHeight;

              const contentWidth = Math.max(subnetWidth, overlayWidth);
              const groupWidth = contentWidth + LAYOUT.BASE_PADDING * 2;
              const groupHeight =
                LAYOUT.BASE_PADDING +
                subnetHeight +
                LAYOUT.GROUP_NODE_GAP +
                overlayHeight +
                LAYOUT.BASE_PADDING;

              groupNode.style.width = `${ groupWidth }px`;
              groupNode.style.height = `${ groupHeight }px`;

              subnetNode.position = {
                x: LAYOUT.BASE_PADDING,
                y: LAYOUT.BASE_PADDING,
              };
              overlayNode.position = {
                x: LAYOUT.BASE_PADDING,
                y: LAYOUT.BASE_PADDING + subnetHeight + LAYOUT.GROUP_NODE_GAP,
              };
            }
          }
        }
      });
    },

    isVmType(type) {
      return type === NODE_TYPES.VM || type === NODE_TYPES.MULTI_NETWORK_VM;
    },

    isSubnetScopedType(type) {
      return (
        type === NODE_TYPES.SUBNET ||
        type === NODE_TYPES.GROUP ||
        type === NODE_TYPES.OVERLAY_NETWORK
      );
    },

    getNodeState(node) {
      const defaultZIndex = node.zIndex || 1;

      if (!this.selectedNodeId) {
        return { stateClass: '', zIndex: defaultZIndex };
      }

      const isTarget = this.selectedNodeId === node.id;
      const isRelated =
        this.relatedIds.has(node.id) || node.type === NODE_TYPES.VPC;
      const isDimmed =
        node.type !== NODE_TYPES.GROUP && !isRelated && !isTarget;

      if (isTarget) return { stateClass: 'node-focused', zIndex: 1000 };
      if (isRelated) return { stateClass: 'node-related', zIndex: 999 };
      if (isDimmed) return { stateClass: 'node-dimmed', zIndex: 0 };

      return { stateClass: '', zIndex: defaultZIndex };
    },

    hasOutgoingConnection(nodeId) {
      return this.filteredEdges.some((edge) => edge.source === nodeId);
    },

    onNodeClick({ node }) {
      if (node.type === NODE_TYPES.GROUP) return;
      if (this.selectedNodeId === node.id) {
        this.selectedNodeId = null;
        this.relatedIds.clear();

        return;
      }
      this.selectedNodeId = node.id;
      const related = new Set([node.id]);

      const traverse = (id, direction) => {
        this.edges.forEach((edge) => {
          const nextId =
            direction === 'down' ? edge.source === id ? edge.target : null : edge.target === id ? edge.source : null;

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
  <div
    class="vpc-topology"
    :style="topologyCssVars"
  >
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
              :class="[option.badgeClass, { disabled: option.disabled }]"
            >{{ option.count }}</span>
          </template>
        </Checkbox>
      </div>
    </div>

    <div
      v-if="loading"
      class="loading"
    >
      <i class="icon icon-spinner icon-spin" />
      {{ t("harvester.vpc.topology.loading") }}
    </div>
    <div
      v-else-if="nodes.length === 0"
      class="empty-state"
    >
      <i class="icon icon-info" />
      <p>{{ t("harvester.vpc.topology.empty") }}</p>
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
      <template #node-vpc="{ id, data }">
        <Handle
          v-if="hasOutgoingConnection(id)"
          type="source"
          position="bottom"
        />
        <div
          class="custom-node vpc-node"
          :class="data.stateClass"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
        </div>
      </template>

      <template #node-group></template>

      <template #node-subnet="{ id, data }">
        <Handle
          class="handle-center"
          type="target"
          position="top"
        />
        <Handle
          v-if="hasOutgoingConnection(id)"
          class="handle-center"
          type="source"
          position="bottom"
        />
        <div
          class="custom-node subnet-node"
          :class="data.stateClass"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
          <div class="node-details">
            <div>
              {{ t("harvester.vpc.topology.labels.cidr") }}: {{ data.cidr }}
            </div>
            <div>
              {{ t("harvester.vpc.topology.labels.provider") }}:
              {{ data.provider }}
            </div>
          </div>
        </div>
      </template>

      <template #node-overlay-network="{ id, data }">
        <Handle
          class="handle-center"
          type="target"
          position="top"
        />
        <Handle
          v-if="hasOutgoingConnection(id)"
          class="handle-center"
          type="source"
          position="bottom"
        />
        <div
          class="custom-node overlay-node"
          :class="data.stateClass"
        >
          <div class="node-name">
            {{ data.name }}
          </div>
          <div class="node-details">
            <div>
              {{ t("harvester.vpc.topology.labels.type") }}: {{ data.nadType }}
            </div>
            <div>
              {{ t("harvester.vpc.topology.labels.clusterNetwork") }}:
              {{ data.clusterNetwork }}
            </div>
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
                {{ t("harvester.vpc.topology.labels.ip") }}: {{ iface.ip }}
              </div>
              <div class="mac-text-static">
                {{ t("harvester.vpc.topology.labels.mac") }}: {{ iface.mac }}
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
                {{ t("harvester.vpc.topology.labels.ip") }}: {{ iface.ip }}
              </div>
              <div class="mac-text-static">
                {{ t("harvester.vpc.topology.labels.mac") }}: {{ iface.mac }}
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
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 220px);
  min-height: 480px;
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
          color: #fff;
          margin-left: 8px;
          line-height: 1;

          &.badge-vpc {
            background: var(--badge-vpc-bg);
          }

          &.badge-subnet {
            background: var(--badge-subnet-bg);
          }

          &.badge-overlay {
            background: var(--badge-overlay-bg);
          }

          &.badge-vm {
            background: var(--badge-vm-bg);
          }

          &.disabled {
            opacity: 0.4;
          }
        }
      }
    }
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 0;
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
    flex: 1;
    min-height: 0;
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
    flex: 1;
    min-height: 0;
  }

  .vue-flow__node {
    transition: all $transition-duration $transition-ease-spring;
  }
  ::v-deep(.handle-center) {
    left: 50%;
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
    width: 100%;
    padding: 10px;
    font-size: 13px;
    line-height: 1.4;
    box-sizing: border-box;
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

      .node-name {
        margin-bottom: 0;
      }
    }
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      flex-shrink: 0;
      &.is-running {
        background-color: var(--status-running-color);
        box-shadow: 0 0 6px var(--status-running-glow);
      }
      &.is-stopped {
        background-color: var(--status-stopped-color);
      }
    }

    .node-name {
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 6px;
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
      }
    }

    &.vpc-node {
      text-align: center;
      border: 2px solid var(--node-vpc-color);
      background-color: var(--node-vpc-bg);

      .node-name {
        margin-bottom: 0;
      }
    }

    &.subnet-node {
      border: 2px solid var(--node-subnet-color);
      background-color: var(--node-subnet-bg);
    }

    &.overlay-node {
      border: 2px dashed var(--node-overlay-color);
      background-color: var(--node-overlay-bg);
    }

    &.vm-node {
      border: 2px solid var(--node-vm-color);
      background-color: var(--node-vm-bg);

      &.stopped {
        border: 2px dashed var(--node-vm-stopped-color);
        background-color: var(--node-vm-stopped-bg);
      }
    }

    &.node-focused {
      transform: scale(1.03) translateY(-4px);
      z-index: 1000;
      opacity: 1 !important;
      box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.15),
        0 0 0 3px rgba(36, 83, 255, 0.15);
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
