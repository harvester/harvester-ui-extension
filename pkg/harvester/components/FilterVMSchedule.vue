<script>
import { RadioGroup } from '@components/Form/Radio';

export default {
  name: 'HarvesterFilterVMSchedule',

  emits: ['change-rows'],

  components: { RadioGroup },

  props: {
    rows: {
      type:     Array,
      required: true,
    },
  },

  data() {
    return { selected: '' };
  },

  computed: {
    scheduleOptions() {
      const options = this.rows.map((r) => r.sourceSchedule).filter((r) => r);

      return Array.from(new Set(options));
    },
    enableFilterButton() {
      return this.rows.some((r) => r.sourceSchedule !== undefined);
    }
  },

  methods: {
    onSelect(selected) {
      this.selected = selected;
      this.filterRows();
    },

    remove() {
      this.selected = '';
      this.filterRows();
    },

    filterRows() {
      if (!this.selected) {
        this.$emit('change-rows', this.rows);

        return;
      }
      const filteredRows = this.rows.filter((row) => row.sourceSchedule === this.selected);

      this.$emit('change-rows', filteredRows, this.selected);
    }
  },

  watch: {
    rows: {
      deep:      true,
      immediate: false,
      handler() {
        this.filterRows();
      }
    }
  }
};
</script>

<template>
  <div
    class="vm-schedule-filter"
  >
    <span
      v-if="selected"
      class="banner-item bg-warning"
    >
      {{ t('harvester.tableHeaders.vmSchedule') }}{{ selected ? ` = ${selected}`: '' }}
      <i
        class="icon icon-close ml-5"
        @click="remove"
      />
    </span>
    <v-dropdown
      popper-class="vm-schedule-dropdown"
      :triggers="scheduleOptions.length ? ['click'] : []"
      placement="bottom-end"
      offset="1"
      :distance="20"
    >
      <button
        ref="actionDropDown"
        class="btn bg-primary mr-10"
        :disabled="!enableFilterButton"
      >
        <slot name="title">
          {{ t('harvester.fields.filterSchedule') }}
        </slot>
      </button>

      <template #popper>
        <div class="filter-popup">
          <RadioGroup
            v-model:value="selected"
            class="mr-10 ml-10"
            name="model"
            :options="scheduleOptions"
            :labels="scheduleOptions"
            @update:value="onSelect"
          />
        </div>
      </template>
    </v-dropdown>
  </div>
</template>

<style lang="scss">
.vm-schedule-dropdown .v-popper__arrow-container {
  display: none;
}

.fixed-header-actions .middle .vm-schedule-filter + .btn-group {
  display: inline-flex;
  vertical-align: middle;
}
</style>

<style lang="scss" scoped>
.vm-schedule-filter {
  display: inline-block;

  .banner-item {
    display: inline-block;
    font-size: 16px;
    margin-right: 10px;
    padding: 6px;
    border-radius: 2px;

    i {
      cursor: pointer;
      vertical-align: middle;
    }
  }
}
.filter-popup {
  width: max-content;
}

</style>
