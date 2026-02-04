<script>
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { allHash } from '@shell/utils/promise';
import { HCI } from '../types';

export default {
  name: 'VPCDetail',

  components: {
    VueFlow,
    Background,
    Controls,
    MiniMap,
  },

  props: {
    value: {
      type:     Object,
      required: true,
    },
  },

  data() {
    return {
      nodes:   [],
      edges:   [],
      loading: true,
      LAYOUT:  {
        VMS_PER_ROW:        5,
        VM_WIDTH:           150,
        HORIZONTAL_SPACING: 160,
        VERTICAL_SPACING:   80,
        SUBNET_SPACING:     300,
        VPC_Y_POSITION:     50,
        SUBNET_Y_POSITION:  160,
        VM_START_Y:         280,
      },
    };
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      subnets: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
      ips:     this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IP }),
      vms:     this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.VM }),
    });

    await this.loadTopology();
  },

  computed: {
    vpcName() {
      return this.value?.metadata?.name || '';
    },

    subnetCount() {
      const subnets = this.nodes.filter((n) => n.data?.type === 'subnet');

      return subnets.length;
    },

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

    vmCount() {
      const vms = this.nodes.filter((n) => n.data?.type === 'vm');

      return vms.length;
    },
  },

  watch: {
    allSubnets: {
      handler() {
        if (!this.loading) {
          this.loadTopology();
        }
      },
      deep: true,
    },

    allIps: {
      handler() {
        if (!this.loading) {
          this.loadTopology();
        }
      },
      deep: true,
    },

    allVMs: {
      handler() {
        if (!this.loading) {
          this.loadTopology();
        }
      },
      deep: true,
    },

    'value.metadata.resourceVersion'() {
      if (!this.loading) {
        this.loadTopology();
      }
    },
  },

  methods: {
    async loadTopology() {
      if (this._loadingTopology) {
        return;
      }

      this._loadingTopology = true;
      const wasLoading = this.loading;

      if (!wasLoading) {
        this.loading = true;
      }

      try {
        const vpc = this.value;

        if (!vpc || !vpc.metadata) {
          this.loading = false;

          return;
        }

        const subnets = this.allSubnets;
        const ips = this.allIps;
        const vms = this.allVMs;

        const vpcSubnets = (Array.isArray(subnets) ? subnets : []).filter(
          (subnet) => subnet.spec?.vpc === vpc.metadata.name,
        );

        // Build VM to subnet mapping through IP resources
        // In Kube-OVN, VM IPs use the VM name directly as podName (not virt-launcher-xxx)
        // Support multiple networks per VM
        const vmToSubnets = {}; // { vmName: [subnet1, subnet2, ...] }
        const vmToIps = {}; // { vmName: [ip1, ip2, ...] }

        (Array.isArray(ips) ? ips : []).forEach((ip) => {
          const podName = ip.spec?.podName;
          const subnet = ip.spec?.subnet;
          const ipAddress = ip.spec?.ipAddress;

          if (podName && subnet) {
            // Check if this podName matches any VM name
            const matchedVm = vms.find((vm) => vm.metadata?.name === podName);

            if (matchedVm) {
              // Initialize arrays if not exists
              if (!vmToSubnets[podName]) {
                vmToSubnets[podName] = [];
                vmToIps[podName] = [];
              }
              // Add subnet and IP to arrays (avoid duplicates)
              if (!vmToSubnets[podName].includes(subnet)) {
                vmToSubnets[podName].push(subnet);
                vmToIps[podName].push(ipAddress);
              }
            }
          }
        });

        // Get VMs that belong to this VPC by checking if any of their IPs are in VPC subnets
        const vpcVMs = (Array.isArray(vms) ? vms : []).filter((vm) => {
          const vmName = vm.metadata?.name;
          const vmSubnets = vmToSubnets[vmName] || [];

          if (vmSubnets.length === 0) {
            return false;
          }

          // Check if any of the VM's subnets belong to this VPC
          return vmSubnets.some((vmSubnet) => vpcSubnets.some((subnet) => subnet.metadata.name === vmSubnet)
          );
        });

        const nodes = [];
        const edges = [];

        // Add VPC node (top layer)
        const vpcX = vpcSubnets.length > 0 ? (vpcSubnets.length - 1) * this.LAYOUT.SUBNET_SPACING / 2 + 50 : 400;

        nodes.push({
          id:       'vpc',
          type:     'default',
          position: { x: vpcX, y: this.LAYOUT.VPC_Y_POSITION },
          data:     {
            label: `VPC: ${ vpc.metadata.name }`,
            type:  'vpc',
          },
          style: {
            background:   '#f0f9ff',
            color:        '#0c4a6e',
            border:       '2px solid #38bdf8',
            borderRadius: '12px',
            padding:      '10px',
            width:        '200px',
            fontWeight:   'bold',
          },
        });

        // Add subnet nodes (middle layer)
        vpcSubnets.forEach((subnet, index) => {
          const subnetId = `subnet-${ subnet.metadata.name }`;

          nodes.push({
            id:       subnetId,
            type:     'default',
            position: {
              x: index * this.LAYOUT.SUBNET_SPACING + 50,
              y: this.LAYOUT.SUBNET_Y_POSITION,
            },
            data: {
              label: `Subnet:${ subnet.metadata.name }\nCIDR: ${
                subnet.spec?.cidrBlock || 'N/A'
              }`,
              type: 'subnet',
            },
            style: {
              background:   '#fefce8',
              color:        '#713f12',
              border:       '2px solid #facc15',
              borderRadius: '12px',
              padding:      '10px',
              width:        '180px',
              whiteSpace:   'pre-wrap',
            },
          });

          // Connect subnet to VPC
          edges.push({
            id:       `edge-vpc-${ subnet.metadata.name }`,
            source:   'vpc',
            target:   subnetId,
            animated: true,
            style:    { stroke: '#38bdf8', strokeWidth: 2 },
          });
        });

        // Track which VMs have been processed to avoid duplicates
        const processedVMs = new Set();

        // Add VM nodes - grouped by subnet
        vpcSubnets.forEach((subnet, subnetIndex) => {
          const subnetName = subnet.metadata.name;

          // Filter VMs that belong to this subnet
          const subnetVMs = vpcVMs.filter((vm) => {
            const vmName = vm.metadata?.name;
            const vmSubnets = vmToSubnets[vmName] || [];

            return vmSubnets.includes(subnetName);
          });

          // Separate into single-network and multi-network VMs
          const singleNetworkVMs = subnetVMs.filter((vm) => {
            const vmName = vm.metadata?.name;
            const vmSubnets = vmToSubnets[vmName] || [];

            return vmSubnets.length === 1;
          });

          const multiNetworkVMs = subnetVMs.filter((vm) => {
            const vmName = vm.metadata?.name;
            const vmSubnets = vmToSubnets[vmName] || [];

            return vmSubnets.length > 1 && !processedVMs.has(vmName);
          });

          // Render single-network VMs first
          singleNetworkVMs.forEach((vm, vmIndex) => {
            const vmName = vm.metadata?.name || 'Unknown';
            const vmIps = vmToIps[vmName] || [];
            const vmId = `vm-${ vmName }`;

            const subnetOffset = subnetIndex * this.LAYOUT.SUBNET_SPACING;
            const columnIndex = vmIndex % this.LAYOUT.VMS_PER_ROW;
            const rowIndex = Math.floor(vmIndex / this.LAYOUT.VMS_PER_ROW);

            nodes.push({
              id:       vmId,
              type:     'default',
              position: {
                x: subnetOffset + columnIndex * this.LAYOUT.HORIZONTAL_SPACING + 10,
                y: this.LAYOUT.VM_START_Y + rowIndex * this.LAYOUT.VERTICAL_SPACING,
              },
              data: {
                label: `VM: ${ vmName }\nIP: ${ vmIps[0] || 'N/A' }`,
                type:  'vm',
              },
              style: {
                background:   '#f0fdf4',
                color:        '#166534',
                border:       '2px solid #22c55e',
                borderRadius: '8px',
                padding:      '8px',
                width:        `${ this.LAYOUT.VM_WIDTH }px`,
                fontSize:     '11px',
                whiteSpace:   'pre-wrap',
              },
            });

            edges.push({
              id:       `edge-${ subnetName }-${ vmId }`,
              source:   `subnet-${ subnetName }`,
              target:   vmId,
              animated: true,
              style:    {
                stroke:          '#22c55e',
                strokeWidth:     1,
                strokeDasharray: '2,2',
              },
            });
          });

          // Render multi-network VMs after single-network VMs
          const singleNetworkCount = singleNetworkVMs.length;

          multiNetworkVMs.forEach((vm, vmIndex) => {
            const vmName = vm.metadata?.name || 'Unknown';
            const vmSubnets = vmToSubnets[vmName] || [];
            const vmIps = vmToIps[vmName] || [];
            const vmId = `vm-${ vmName }`;

            // Mark as processed
            processedVMs.add(vmName);

            // Format IPs - show all IPs
            const ipDisplay = vmIps.map((ip, idx) => `IP${ idx + 1 }: ${ ip }`).join('\n');

            const subnetOffset = subnetIndex * this.LAYOUT.SUBNET_SPACING;
            const totalIndex = singleNetworkCount + vmIndex;
            const columnIndex = totalIndex % this.LAYOUT.VMS_PER_ROW;
            const rowIndex = Math.floor(totalIndex / this.LAYOUT.VMS_PER_ROW);

            nodes.push({
              id:       vmId,
              type:     'default',
              position: {
                x: subnetOffset + columnIndex * this.LAYOUT.HORIZONTAL_SPACING + 10,
                y: this.LAYOUT.VM_START_Y + rowIndex * this.LAYOUT.VERTICAL_SPACING,
              },
              data: {
                label:   `VM: ${ vmName }\n${ ipDisplay }`,
                type:    'multi-network-vm',
                subnets: vmSubnets,
              },
              style: {
                background:   '#f0fdf4',
                color:        '#166534',
                border:       '2px solid #22c55e',
                borderRadius: '8px',
                padding:      '8px',
                width:        `${ this.LAYOUT.VM_WIDTH }px`,
                fontSize:     '11px',
                whiteSpace:   'pre-wrap',
              },
            });

            // Connect to all subnets
            vmSubnets.forEach((targetSubnet) => {
              edges.push({
                id:       `edge-${ targetSubnet }-${ vmId }`,
                source:   `subnet-${ targetSubnet }`,
                target:   vmId,
                animated: true,
                style:    {
                  stroke:          '#22c55e',
                  strokeWidth:     2,
                  strokeDasharray: '5,5',
                },
              });
            });
          });
        });

        this.nodes = nodes;
        this.edges = edges;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load VPC topology:', error);
        this.$store.dispatch(
          'growl/error',
          {
            title:   'Topology Error',
            message: `Failed to load VPC topology: ${ error.message }`,
          },
          { root: true },
        );
      } finally {
        this.loading = false;
        this._loadingTopology = false;
      }
    },

    onNodeClick(event) {
      // Handle node click
    },

    onEdgeClick(event) {
      // Handle edge click
    },
  },
};
</script>

<template>
  <div class="vpc-topology">
    <div class="topology-header">
      <div class="header-title">
        <div class="stats">
          <span class="stat-badge">{{ subnetCount }} subnet(s)</span>
          <span class="stat-badge">{{ vmCount }} vm(s)</span>
        </div>
      </div>
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color vpc" />
          <span>VPC</span>
        </div>
        <div class="legend-item">
          <div class="legend-color subnet" />
          <span>Subnet</span>
        </div>
        <div class="legend-item">
          <div class="legend-color vm" />
          <span>VM</span>
        </div>
      </div>
    </div>

    <div
      v-if="loading"
      class="loading"
    >
      <i class="icon icon-spinner icon-spin" />
      Loading topology...
    </div>

    <div
      v-else-if="nodes.length === 0"
      class="empty-state"
    >
      <i class="icon icon-info" />
      <p>No resources found in this VPC</p>
    </div>

    <VueFlow
      v-else
      v-model:nodes="nodes"
      v-model:edges="edges"
      class="vpc-flow"
      :default-zoom="0.8"
      :min-zoom="0.2"
      :max-zoom="2"
      fit-view-on-init
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
    >
      <Background
        pattern-color="#f1f1f1"
        :gap="12"
        size="1"
      />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style lang="scss" scoped>
@import '../styles/vue-flow.scss';

.vpc-topology {
  height: 800px;
  width: 100%;
  background: #f5f5f5;
  border-radius: 4px;
  overflow: hidden;

  .topology-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 0;
    background: white;
    border-bottom: 1px solid #ddd;

    .header-title {
      display: flex;
      flex-direction: column;
      gap: 8px;

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .stats {
        display: flex;
        gap: 10px;

        .stat-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #e5e7eb;
          border-radius: 12px;
          font-size: 12px;
          color: #374151;
          font-weight: 500;
        }
      }
    }

    .legend {
      display: flex;
      gap: 20px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;

        .legend-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;

          &.vpc {
            background: #f0f9ff;
            border: 2px solid #38bdf8;
          }

          &.subnet {
            background: #fefce8;
            border: 2px solid #facc15;
          }

          &.pod {
            background: #f0fdf4;
            border: 2px solid #22c55e;
          }

          &.vm {
            background: #f0fdf4;
            border: 2px solid #22c55e;
          }
        }

        span {
          font-size: 14px;
          color: #333;
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
    color: #666;

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
    color: #9ca3af;

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
}
</style>
