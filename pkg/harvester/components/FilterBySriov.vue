<script>
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';

export default {
  name: 'HarvesterFilterLabel',

  emits: ['change-rows'],

  components: { LabeledSelect },

  props: {
    rows: {
      type:     Array,
      required: true,
    },

    parentSriovOptions: {
      type:     Array,
      required: true,
    },

    parentSriovLabel: {
      type:     String,
      required: true,
    },

    label: {
      type:     String,
      required: true,
    },

  },

  data() {
    return { parentSriov: this.$route.query?.parentSriov || null };
  },

  methods: {
    remove() {
      this.parentSriov = null;
      this.filterRows();
    },

    filterRows() {
      const rows = this.rows.filter((row) => {
        if (!this.parentSriov) {
          return true;
        }

        const label = row.labels[this.parentSriovLabel];

        return label === this.parentSriov;
      });

      this.$emit('change-rows', rows, this.parentSriov);
    }
  },

  watch: {
    parentSriov: {
      deep:      true,
      immediate: true,
      handler() {
        this.filterRows();
      }
    }
  }
};
</script>

<template>
  <div class="filter">
    <span
      v-if="parentSriov"
      class="banner-item bg-warning"
    >
      {{ parentSriov }} <i
        class="icon icon-close"
        @click="remove()"
      />
    </span>

    <v-dropdown
      popper-class="filter-parent-sriov"
      trigger="click"
      placement="bottom-end"
      :distance="20"
    >
      <slot name="header">
        <button
          ref="actionDropDown"
          class="btn bg-primary mr-10"
        >
          <slot name="title">
            {{ label }}
          </slot>
        </button>
      </slot>

      <template #popper>
        <div class="filter-popup">
          <div>
            <LabeledSelect
              v-model:value="parentSriov"
              :options="parentSriovOptions"
              :searchable="true"
              :label="label"
            />
          </div>
        </div>
      </template>
    </v-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.filter {
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
  width: 300px;
}

:deep() .box {
  display: grid;
  grid-template-columns: 40% 40% 10%;
  column-gap: 1.75%;
  margin-bottom: 10px;
}

.required {
  color: var(--error);
}

</style>

<style lang="scss">
.filter-parent-sriov .v-popper__arrow-container {
  display: none;
}
</style>
