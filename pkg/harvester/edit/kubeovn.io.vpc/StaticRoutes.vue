<script>
import debounce from 'lodash/debounce';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { removeAt } from '@shell/utils/array';

export default {
  name: 'StaticRoutes',

  emits: ['update:value'],

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

  data() {
    return {
      rows: [{
        cidr:      '',
        nextHopIP: '',
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
  },

  created() {
    this.queueUpdate = debounce(this.update, 100);
  },

  methods: {
    add() {
      this.rows.push({
        cidr:      '',
        nextHopIP: '',
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
        <div class="pool-headers cidr">
          <span class="pool-cidr">
            <t k="harvester.vpc.staticRoutes.cidr.label" />
          </span>
          <span class="pool-nextHopIP">
            <t k="harvester.vpc.staticRoutes.nextHopIP.label" />
          </span>
        </div>
        <div
          class="pool-row cidr"
        >
          <div class="pool-cidr">
            <span v-if="isView">
              {{ row.cidr }}
            </span>
            <input
              v-else
              v-model="row.cidr"
              type="text"
              :placeholder="t('harvester.vpc.staticRoutes.cidr.placeholder')"
              @input="queueUpdate"
            />
          </div>
          <div class="pool-nextHopIP">
            <span v-if="isView">
              {{ row.nextHopIP }}
            </span>
            <input
              v-else
              v-model="row.nextHopIP"
              type="text"
              :placeholder="t('harvester.vpc.staticRoutes.nextHopIP.placeholder')"
              @input="queueUpdate"
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

    &.cidr {
      grid-template-columns: 40%+$column-gutter 40%+$column-gutter 15%;
    }
  }

</style>
