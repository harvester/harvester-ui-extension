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
    };
  },

  // Layout constants
  LAYOUT: {
    PODS_PER_ROW:       5,
    POD_WIDTH:          150,
    HORIZONTAL_SPACING: 160,
    VERTICAL_SPACING:   95,
    SUBNET_SPACING:     550,
    VPC_Y_POSITION:     50,
    SUBNET_Y_POSITION:  200,
    POD_START_Y:        380,
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    await allHash({
      subnets: this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.SUBNET }),
      ips:     this.$store.dispatch(`${ inStore }/findAll`, { type: HCI.IP }),
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

    podCount() {
      const pods = this.nodes.filter((n) => n.data?.type === 'pod');

      return pods.length;
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

        const vpcSubnets = (Array.isArray(subnets) ? subnets : []).filter(
          (subnet) => subnet.spec?.vpc === vpc.metadata.name,
        );

        const vpcPods = (Array.isArray(ips) ? ips : []).filter((ip) => {
          const ipSubnet = ip.spec?.subnet;
          const hasPodName = ip.spec?.podName;

          return (
            hasPodName &&
            vpcSubnets.some((subnet) => subnet.metadata.name === ipSubnet)
          );
        });

        const nodes = [];
        const edges = [];

        // Add VPC node (top layer)
        nodes.push({
          id:       'vpc',
          type:     'default',
          position: { x: 400, y: this.LAYOUT.VPC_Y_POSITION },
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

        // Add pod nodes (bottom layer) - grouped by subnet
        vpcSubnets.forEach((subnet, subnetIndex) => {
          const subnetPods = vpcPods.filter(
            (ip) => ip.spec?.subnet === subnet.metadata.name,
          );

          subnetPods.forEach((pod, podIndex) => {
            const podName = pod.spec?.podName || pod.metadata.name;
            const podIp = pod.spec?.ipAddress || 'N/A';
            const podNamespace = pod.spec?.namespace || 'default';
            const podId = `pod-${ podName }-${ podIndex }`;

            // Calculate pod position
            const subnetOffset = subnetIndex * this.LAYOUT.SUBNET_SPACING;
            const columnIndex = podIndex % this.LAYOUT.PODS_PER_ROW;
            const rowIndex = Math.floor(podIndex / this.LAYOUT.PODS_PER_ROW);

            nodes.push({
              id:       podId,
              type:     'default',
              position: {
                x: subnetOffset + columnIndex * this.LAYOUT.HORIZONTAL_SPACING + 10,
                y: this.LAYOUT.POD_START_Y + rowIndex * this.LAYOUT.VERTICAL_SPACING,
              },
              data: {
                label: `${ podName.substring(
                  0,
                  13,
                ) }\nIP: ${ podIp }\nNS: ${ podNamespace }`,
                type: 'pod',
              },
              style: {
                background:   '#f0fdf4',
                color:        '#14532d',
                border:       '2px solid #22c55e',
                borderRadius: '8px',
                padding:      '8px',
                width:        `${ this.LAYOUT.POD_WIDTH }px`,
                fontSize:     '11px',
                whiteSpace:   'pre-wrap',
              },
            });

            // Connect pod to its subnet
            edges.push({
              id:       `edge-${ subnet.metadata.name }-${ podId }`,
              source:   `subnet-${ subnet.metadata.name }`,
              target:   podId,
              animated: false,
              style:    {
                stroke:          '#22c55e',
                strokeWidth:     1,
                strokeDasharray: '2,2',
              },
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
          <span class="stat-badge">{{ podCount }} pod(s)</span>
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
          <div class="legend-color pod" />
          <span>Pod</span>
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
