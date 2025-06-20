<script>
import debounce from 'lodash/debounce';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { removeAt } from '@shell/utils/array';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { HCI } from '../../types';

export default {
  name: 'VpcPeerings',

  emits: ['update:value'],

  components: { LabeledSelect },

  props: {
    value: {
      type:    Array,
      default: null,
    },
    mode: {
      type:    String,
      default: _EDIT,
    },
  },

  async fetch() {
    await this.$store.dispatch('harvester/findAll', { type: HCI.VPC });
  },

  data() {
    return {
      rows: [{
        localConnectIP:  '',
        remoteVpc:      '',
      }],
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    showAdd() {
      return !this.isView;
    },

    showRemove() {
      return !this.isView;
    },

    remoteVpcOptions() {
      const vpcs = this.$store.getters['harvester/all'](HCI.VPC) || [];

      return vpcs.map((n) => ({
        label: n.id,
        value: n.id,
      }));
    },
  },

  created() {
    this.queueUpdate = debounce(this.update, 100);
  },

  methods: {
    add() {
      this.rows.push({
        localConnectIP:  '',
        remoteVpc:      '',
      });
      this.queueUpdate();
    },

    remove(idx) {
      removeAt(this.rows, idx);
      this.queueUpdate();
    },

    update() {
      if (this.isView) {
        return;
      }
      this.$emit('update:value', this.rows);
    }
  },
};
</script>

<template>
  <div>
    <div
      v-if="rows.length"
      class="static-route-row"
    >
      <div
        v-for="(row, idx) in rows"
        :key="idx"
      >
        <div class="pool-headers localConnectIP">
          <span class="pool-localConnectIP">
            <t k="harvester.vpc.vpcPeerings.localConnectIP.label" />
          </span>
          <span class="pool-remoteVpc">
            <t k="harvester.vpc.vpcPeerings.remoteVpc.label" />
          </span>
        </div>
        <div class="pool-row localConnectIP">
          <div class="pool-localConnectIP">
            <span v-if="isView">
              {{ row.localConnectIP }}
            </span>
            <input
              v-else
              v-model="row.localConnectIP"
              type="text"
              :placeholder="t('harvester.vpc.vpcPeerings.localConnectIP.placeholder')"
              @input="queueUpdate"
            />
          </div>
          <div class="pool-remoteVpc">
            <span v-if="isView">
              {{ row.remoteVpc }}
            </span>
            <LabeledSelect
              v-model:value="row.remoteVpc"
              :options="remoteVpcOptions"
              :mode="mode"
              @update:value="queueUpdate"
            />
          </div>
          <button
            v-if="showRemove"
            type="button"
            class="btn role-link pl-0"
            @click="remove(idx)"
          >
            <t k="generic.remove" />
          </button>
        </div>
      </div>
    </div>
    <button
      v-if="showAdd"
      type="button"
      class="btn role-tertiary add"
      @click="add()"
    >
      <t k="generic.add" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
  .pool-headers, .pool-row {
    display: grid;
    grid-column-gap: $column-gutter;
    margin-bottom: 10px;
    align-items: center;

    &.localConnectIP {
      grid-template-columns: 40%+$column-gutter 40%+$column-gutter 15%;
    }
  }
</style>
