<script>
import ELK from 'elkjs/lib/elk.bundled.js';
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
const elk = new ELK();

const THEME_COLORS = {
  VPC:             '#2453ff',
  PEER_VPC:        'rgba(36, 83, 255, 0.6)',
  BG_VPC:          'rgba(36, 83, 255, 0.1)',
  BG_PEER_VPC:     'rgba(36, 83, 255, 0.05)',
  SUBNET:          '#fe7c3f',
  BG_SUBNET:       'rgba(254, 124, 63, 0.1)',
  OVERLAY:         '#cb1fdb',
  BG_OVERLAY:      'rgba(203, 31, 219, 0.1)',
  VM:              '#00bda7',
  VM_GLOW:         'rgba(0, 189, 167, 0.6)',
  BG_VM:           'rgba(0, 189, 167, 0.1)',
  STOPPED:         '#9ca3af',
  BG_STOPPED:      'rgba(156, 163, 175, 0.1)',
  LINK_GRAY:       '#9ca3af',
  PEER_BADGE_BG:   'rgba(36, 83, 255, 0.14)',
  PEER_BADGE_TEXT: '#1f3fbf',
};

const LAYOUT = {
  BASE_PADDING:      24,
  NODE_WIDTH:        230,
  GROUP_NODE_GAP:    30,
  AUTO_NODE_GAP:     110,
  AUTO_RANK_GAP:     140,
  PEER_COLUMN_GAP:   220,
  PEER_VERTICAL_GAP: 36,
};

const NODE_WIDTH_PX = `${ LAYOUT.NODE_WIDTH }px`;

const NODE_HEIGHT = {
  DEFAULT: 96,
  SUBNET:  120,
  OVERLAY: 120,
  VM:      170,
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
      flowInstance:   null,
      isFitted:       false,
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
        vpcs:               this.$store.dispatch(`${ store }/findAll`, { type: HCI.VPC }),
        subnets:            this.$store.dispatch(`${ store }/findAll`, { type: HCI.SUBNET }),
        ips:                this.$store.dispatch(`${ store }/findAll`, { type: HCI.IP }),
        vms:                this.$store.dispatch(`${ store }/findAll`, { type: HCI.VM }),
        clusterNetworks:    this.$store.dispatch(`${ store }/findAll`, { type: HCI.CLUSTER_NETWORK }),
        networkAttachments: this.$store.dispatch(`${ store }/findAll`, { type: NETWORK_ATTACHMENT }),
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
    allVpcs() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.VPC) || [];
    },
    allIps() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.IP) || [];
    },
    allVMs() {
      return this.$store.getters[`${ this.inStore }/all`](HCI.VM) || [];
    },
    allNetworkAttachments() {
      return (
        this.$store.getters[`${ this.inStore }/all`](NETWORK_ATTACHMENT) || []
      );
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
    colors() {
      return THEME_COLORS;
    },
    topologyCssVars() {
      return {
        '--node-vpc-color':        this.colors.VPC,
        '--node-vpc-bg':           this.colors.BG_VPC,
        '--node-peer-vpc-color':   this.colors.PEER_VPC,
        '--node-peer-vpc-bg':      this.colors.BG_PEER_VPC,
        '--node-subnet-color':     this.colors.SUBNET,
        '--node-subnet-bg':        this.colors.BG_SUBNET,
        '--node-overlay-color':    this.colors.OVERLAY,
        '--node-overlay-bg':       this.colors.BG_OVERLAY,
        '--node-group-bg':         this.getCssVar('--box-bg') || 'rgba(0, 0, 0, 0.05)',
        '--node-vm-color':         this.colors.VM,
        '--node-vm-bg':            this.colors.BG_VM,
        '--node-vm-stopped-color': this.colors.STOPPED,
        '--node-vm-stopped-bg':    this.colors.BG_STOPPED,
        '--badge-vpc-bg':          this.colors.VPC,
        '--badge-subnet-bg':       this.colors.SUBNET,
        '--badge-overlay-bg':      this.colors.OVERLAY,
        '--badge-vm-bg':           this.colors.VM,
        '--status-running-color':  this.colors.VM,
        '--status-running-glow':   this.colors.VM_GLOW,
        '--status-stopped-color':  this.colors.STOPPED,
        '--badge-peer-bg':         this.colors.PEER_BADGE_BG,
        '--badge-peer-text':       this.colors.PEER_BADGE_TEXT,
      };
    },

    visibilityOptions() {
      const options = [
        {
          modelKey:   'showVPC',
          label:      this.t('harvester.vpc.topology.visibility.vpc'),
          badgeClass: 'badge-vpc',
          count:      this.nodes.filter((node) => node.type === NODE_TYPES.VPC)
            .length,
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
    showSubnets(newValue) {
      this.showOverlays = newValue;
    },
  },

  methods: {
    prepareResources(vpcName) {
      const vpcSubnets = this.allSubnets.filter(
        (subnet) => subnet.spec?.vpc === vpcName,
      );
      const vpcSubnetNames = new Set(
        vpcSubnets.map((subnet) => subnet.metadata.name),
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

        return subnets.some((name) => vpcSubnetNames.has(name));
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
      this.isFitted = false;

      try {
        const vpc = this.value;
        const {
          vpcSubnets, vmToSubnetsMap, vmToDetailsMap, vpcVMs
        } =
          this.prepareResources(vpc.metadata.name);

        const nodes = [];
        const edges = [];

        nodes.push({
          id:       NODE_TYPES.VPC,
          type:     NODE_TYPES.VPC,
          position: { x: 0, y: 0 },
          data:     { name: vpc.metadata.name },
          style:    { width: NODE_WIDTH_PX },
        });

        this.createVpcPeeringNodes({
          nodes,
          edges,
          vpc,
        });

        vpcSubnets.forEach((subnet) => {
          this.createNetworkNodes(nodes, edges, subnet);
        });

        this.createVMNodes({
          nodes,
          edges,
          vpcVMs,
          vpcSubnets,
          vmToSubnetsMap,
          vmToDetailsMap,
        });

        await this.applyAutoLayout(nodes, edges);

        this.nodes = nodes;
        this.edges = edges;
        this.scheduleInitialFit();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Topology Load Error:', error);
      } finally {
        this.loading = false;
        this._loadingTopology = false;
      }
    },

    createVpcPeeringNodes({ nodes, edges, vpc }) {
      const peerings = vpc?.spec?.vpcPeerings || [];
      const peerNodeByRemote = new Map();
      let peerIndex = 0;

      peerings.forEach((peering, index) => {
        const remoteVpc = peering?.remoteVpc;

        if (!remoteVpc) {
          return;
        }

        if (!peerNodeByRemote.has(remoteVpc)) {
          const remoteVpcObj = this.allVpcs.find((item) => {
            return item.id === remoteVpc || item.metadata?.name === remoteVpc;
          });

          const peerName =
            remoteVpcObj?.metadata?.name ||
            remoteVpc.split('/').pop() ||
            remoteVpc;

          const peerNodeId = `vpc-peer-${ peerIndex }`;

          peerNodeByRemote.set(remoteVpc, peerNodeId);

          nodes.push({
            id:       peerNodeId,
            type:     NODE_TYPES.VPC,
            position: { x: 0, y: 0 },
            data:     {
              name:      peerName,
              remoteVpcObj,
              isPeerVpc: true,
            },
            style: { width: NODE_WIDTH_PX },
          });

          peerIndex++;
        }

        edges.push({
          id:           `vpc-peering-${ index }-${ remoteVpc }`,
          source:       NODE_TYPES.VPC,
          sourceHandle: 'vpc-right-handle',
          target:       peerNodeByRemote.get(remoteVpc),
          type:         'straight',
          animated:     false,
          class:        'peering-edge',
          style:        {
            stroke:          THEME_COLORS.LINK_GRAY,
            strokeWidth:     1.5,
            strokeDasharray: '6,4',
            opacity:         0.5,
          },
          label: peering?.localConnectIP || '',
        });
      });
    },

    createNetworkNodes(nodes, edges, subnet) {
      const subnetName = subnet.metadata.name;
      const subnetNodeId = `subnet-${ subnetName }`;
      const provider = subnet.spec?.provider || NETWORK_PROVIDERS.OVN;
      const hasOverlay =
        provider !== NETWORK_PROVIDERS.OVN && provider.trim() !== '';

      if (hasOverlay) {
        const groupId = `group-${ subnetName }`;

        const nad = this.allNetworkAttachments.find((networkAttachment) => {
          return networkAttachment?.parseConfig?.provider === provider;
        });

        const overlayName = nad?.parseConfig?.name || nad?.metadata?.name;

        const clusterNetwork =
          nad?.metadata?.labels?.[HCI.CLUSTER_NETWORK] || 'mgmt';

        const nadType =
          nad?.metadata?.labels?.[HCI.NETWORK_TYPE] || NETWORK_TYPE.OVERLAY;
        const overlayNodeId = `overlay-${ provider }`;

        nodes.push({
          id:       groupId,
          type:     NODE_TYPES.GROUP,
          position: { x: 0, y: 0 },
          data:     { type: NODE_TYPES.GROUP },
          style:    {
            background:   'var(--node-group-bg)',
            borderRadius: '12px',
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
          style: { width: NODE_WIDTH_PX },
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
          style: { width: NODE_WIDTH_PX },
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
          position: { x: 0, y: 0 },
          data:     {
            name:     subnetName,
            cidr:     subnet.spec?.cidrBlock,
            provider: NETWORK_PROVIDERS.OVN,
          },
          style: { width: NODE_WIDTH_PX },
        });
      }

      edges.push({
        id:           `vpc-to-${ subnetName }`,
        source:       NODE_TYPES.VPC,
        sourceHandle: 'vpc-bottom-handle',
        target:       subnetNodeId,
        animated:     true,
        style:        { stroke: THEME_COLORS.VPC, strokeWidth: 2 },
      });
    },

    createVMNodes({
      nodes,
      edges,
      vpcVMs,
      vpcSubnets,
      vmToSubnetsMap,
      vmToDetailsMap,
    }) {
      const vpcSubnetNames = new Set(
        vpcSubnets.map((subnet) => subnet.metadata.name),
      );
      const subnetNetworkMap = {};

      vpcSubnets.forEach((subnet) => {
        subnetNetworkMap[subnet.metadata.name] =
          this.getNetworkDisplayBySubnet(subnet);
      });

      vpcVMs.forEach((vm) => {
        const vmName = vm.metadata?.name;
        const vmSubnetsInVpc = (vmToSubnetsMap[vmName] || []).filter(
          (subnetName) => vpcSubnetNames.has(subnetName),
        );
        const interfacesInVpc = (vmToDetailsMap[vmName] || [])
          .filter((iface) => vpcSubnetNames.has(iface.subnet))
          .map((iface) => ({
            ...iface,
            network: subnetNetworkMap[iface.subnet] || iface.subnet,
          }));
        const isMulti = vmSubnetsInVpc.length > 1;
        const status = (vm.status?.printableStatus || '').toLowerCase();
        const isStopped = STOPPED_VM_STATUSES.includes(status);
        const vmId = `vm-${ vmName }`;

        nodes.push({
          id:       vmId,
          type:     isMulti ? NODE_TYPES.MULTI_NETWORK_VM : NODE_TYPES.VM,
          position: { x: 0, y: 0 },
          data:     {
            name:       vmName,
            isStopped,
            interfaces: interfacesInVpc,
          },
          style:  { width: NODE_WIDTH_PX },
          zIndex: 10,
        });

        vmSubnetsInVpc.forEach((name) => {
          const targetSubnet = vpcSubnets.find((s) => s.metadata.name === name);
          const provider =
            targetSubnet?.spec?.provider || NETWORK_PROVIDERS.OVN;
          const sourceId =
            provider !== NETWORK_PROVIDERS.OVN ? `overlay-${ provider }` : `subnet-${ name }`;

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
      });
    },

    getNodeTypeHeight(type) {
      switch (type) {
      case NODE_TYPES.SUBNET:
        return NODE_HEIGHT.SUBNET;
      case NODE_TYPES.OVERLAY_NETWORK:
        return NODE_HEIGHT.OVERLAY;
      default:
        return this.isVmType(type) ? NODE_HEIGHT.VM : NODE_HEIGHT.DEFAULT;
      }
    },

    getLayoutNodeDimensions(nodes, node) {
      if (node.type !== NODE_TYPES.GROUP) {
        return {
          width:  Number.parseInt(node?.style?.width, 10) || LAYOUT.NODE_WIDTH,
          height: this.getNodeTypeHeight(node?.type),
        };
      }

      const children = nodes.filter((child) => child.parentNode === node.id);
      const childWidth = Number.parseInt(children[0]?.style?.width, 10) || LAYOUT.NODE_WIDTH;
      const contentHeight = children.reduce((total, child) => {
        return total + this.getNodeTypeHeight(child.type);
      }, 0);
      const gapsHeight = Math.max(children.length - 1, 0) * LAYOUT.GROUP_NODE_GAP;
      const baseHeight = contentHeight + gapsHeight + LAYOUT.BASE_PADDING * 2;
      const minHeight = NODE_HEIGHT.DEFAULT + LAYOUT.BASE_PADDING * 2;

      return {
        width:  childWidth + LAYOUT.BASE_PADDING * 2,
        height: Math.max(baseHeight, minHeight),
      };
    },

    getTopLevelNodeId(nodeById, nodeId) {
      return nodeById.get(nodeId)?.parentNode || nodeId;
    },

    placePeerNodes(topLevelNodes, nodeDimensionsById) {
      const peerNodes = topLevelNodes.filter((node) => node.data?.isPeerVpc);

      if (!peerNodes.length) {
        return;
      }

      const maxNonPeerRight = topLevelNodes
        .filter((node) => !node.data?.isPeerVpc)
        .reduce((maxRight, node) => {
          const { width } = nodeDimensionsById.get(node.id);

          return Math.max(maxRight, node.position.x + width);
        }, 0);
      const minPeerY = Math.min(...peerNodes.map((node) => node.position.y));

      peerNodes
        .sort((left, right) => left.position.y - right.position.y)
        .forEach((node, index) => {
          const { height } = nodeDimensionsById.get(node.id);

          node.position = {
            x: maxNonPeerRight + LAYOUT.PEER_COLUMN_GAP,
            y: minPeerY + index * (height + LAYOUT.PEER_VERTICAL_GAP),
          };
        });
    },

    buildElkGraph(nodes, edges, nodeById, topLevelNodes, nodeDimensionsById) {
      const elkGraph = {
        id:            'root',
        layoutOptions: {
          'elk.algorithm':                             'layered',
          'elk.direction':                             'DOWN',
          'elk.spacing.nodeNode':                      `${ LAYOUT.AUTO_NODE_GAP }`,
        },
        children:      [],
        edges:         [],
      };

      topLevelNodes.forEach((node) => {
        const { width, height } = nodeDimensionsById.get(node.id);

        if (node.type === NODE_TYPES.GROUP) {
          const children = nodes.filter((child) => child.parentNode === node.id)
            .map((child) => {
              const childDimensions = this.getLayoutNodeDimensions(nodes, child);

              return {
                id:     child.id,
                width:  childDimensions.width,
                height: childDimensions.height,
              };
            });

          elkGraph.children.push({
            id: node.id,
            width,
            height,
            children,
          });

          return;
        }

        elkGraph.children.push({
          id: node.id,
          width,
          height,
        });
      });

      const graphEdgeKeys = new Set();

      edges.forEach((edge) => {
        const source = this.getTopLevelNodeId(nodeById, edge.source);
        const target = this.getTopLevelNodeId(nodeById, edge.target);

        if (!source || !target || source === target) {
          return;
        }

        if (!nodeDimensionsById.has(source) || !nodeDimensionsById.has(target)) {
          return;
        }

        const edgeKey = `${ source }->${ target }`;

        if (graphEdgeKeys.has(edgeKey)) {
          return;
        }

        graphEdgeKeys.add(edgeKey);

        elkGraph.edges.push({
          id:            edgeKey,
          sources:       [source],
          targets:       [target],
        });
      });

      return elkGraph;
    },

    applyElkLayout(layout, nodeById) {
      const applyLayoutNode = (layoutNode) => {
        const targetNode = nodeById.get(layoutNode.id);

        if (targetNode) {
          targetNode.position = {
            x: layoutNode.x || 0,
            y: layoutNode.y || 0,
          };

          if (targetNode.type === NODE_TYPES.GROUP) {
            targetNode.style.width = `${ layoutNode.width }px`;
            targetNode.style.height = `${ layoutNode.height }px`;
          }
        }

        if (layoutNode.children) {
          layoutNode.children.forEach((child) => applyLayoutNode(child));
        }
      };

      if (layout.children) {
        layout.children.forEach((child) => applyLayoutNode(child));
      }
    },

    async applyAutoLayout(nodes, edges) {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const topLevelNodes = nodes.filter((node) => !node.parentNode);
      const nodeDimensionsById = new Map(topLevelNodes.map((node) => {
        return [node.id, this.getLayoutNodeDimensions(nodes, node)];
      }));

      const elkGraph = this.buildElkGraph(
        nodes,
        edges,
        nodeById,
        topLevelNodes,
        nodeDimensionsById,
      );
      const layout = await elk.layout(elkGraph);

      this.applyElkLayout(layout, nodeById);
      this.placePeerNodes(topLevelNodes, nodeDimensionsById);
    },

    getNetworkDisplayBySubnet(subnet) {
      const provider = subnet?.spec?.provider || NETWORK_PROVIDERS.OVN;

      if (provider === NETWORK_PROVIDERS.OVN || provider.trim() === '') {
        return provider;
      }

      const nad = this.allNetworkAttachments.find(
        (networkAttachment) => networkAttachment?.parseConfig?.provider === provider,
      );

      if (!nad) {
        return provider;
      }

      const networkName = nad?.parseConfig?.name || nad?.metadata?.name;
      const namespace = nad?.metadata?.namespace;

      return namespace ? `${ namespace }/${ networkName }` : networkName;
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

      // Navigate to peered VPC topology view
      if (node.data?.isPeerVpc && node.data?.remoteVpcObj) {
        this.navigateToPeeringVpc(node.data.remoteVpcObj);

        return;
      }

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

    onFlowInit(instance) {
      this.flowInstance = instance;
      this.scheduleInitialFit();
    },

    scheduleInitialFit() {
      if (this.isFitted || !this.flowInstance || !this.filteredNodes.length) return;

      this.$nextTick(() => {
        requestAnimationFrame(() => {
          if (this.isFitted || !this.filteredNodes.length) return;

          this.flowInstance?.fitView({
            padding:            0.25,
            duration:           0,
            includeHiddenNodes: true,
          });
          this.isFitted = true;
        });
      });
    },

    navigateToPeeringVpc(remoteVpcObj) {
      if (remoteVpcObj && remoteVpcObj.goToDetail) {
        remoteVpcObj.goToDetail();
      }
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
      :class="['vpc-flow', { 'is-fitting': !isFitted }]"
      :min-zoom="0.1"
      :max-zoom="2"
      @init="onFlowInit"
      @node-click="onNodeClick"
      @pane-click="onPaneClick"
    >
      <template #node-vpc="{ id, data }">
        <Handle
          v-if="!data.isPeerVpc"
          id="vpc-bottom-handle"
          type="source"
          position="bottom"
        />
        <Handle
          v-if="!data.isPeerVpc && hasOutgoingConnection(id)"
          id="vpc-right-handle"
          type="source"
          position="right"
        />
        <Handle
          v-if="data.isPeerVpc"
          type="target"
          position="left"
        />
        <div
          class="custom-node vpc-node"
          :class="[data.stateClass, { 'peer-vpc': data.isPeerVpc }]"
        >
          <div class="node-name">
            {{ data.name }}
            <span
              v-if="data.isPeerVpc"
              class="peer-badge"
            >{{ t("harvester.vpc.topology.labels.peering") }}</span>
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
              <div class="subnet-text">
                {{ t("harvester.vpc.topology.labels.subnet") }}:
                {{ iface.subnet }}
              </div>
              <div class="network-text">
                {{ t("harvester.vpc.topology.labels.network") }}:
                {{ iface.network }}
              </div>
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
              <div class="subnet-text">
                {{ t("harvester.vpc.topology.labels.subnet") }}:
                {{ iface.subnet }}
              </div>
              <div class="network-text">
                {{ t("harvester.vpc.topology.labels.network") }}:
                {{ iface.network }}
              </div>
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

  .vpc-flow.is-fitting {
    opacity: 0;
    pointer-events: none;
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

  ::v-deep(.vue-flow__edge-text) {
    font-size: 14px;
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
        border-top: 1px solid var(--node-vm-color);
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

    &.peer-vpc {
      border-color: var(--node-peer-vpc-color);
      background-color: var(--node-peer-vpc-bg);
      cursor: pointer;

      &:hover {
        border-color: var(--node-vpc-color);
        box-shadow: 0 6px 16px rgba(36, 83, 255, 0.18);
        transform: translateY(-2px);
      }
    }

    .peer-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 8px;
      background-color: var(--badge-peer-bg);
      color: var(--badge-peer-text);
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
