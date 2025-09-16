<script>
import debounce from 'lodash/debounce';
import { _EDIT, _VIEW } from '@shell/config/query-params';
import { removeAt } from '@shell/utils/array';
import { Banner } from '@components/Banner';
import InfoBox from '@shell/components/InfoBox';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import { LabeledInput } from '@components/Form/LabeledInput';

export default {
  name: 'AccessControlList',

  emits: ['update:value'],

  components: {
    Banner, InfoBox, LabeledSelect, LabeledInput
  },

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
    const rows = (this.value || []).map((row) => {
      return {
        action:      row.action || '',
        direction:   row.direction || '',
        priority:    row.priority || 0,
        match:       row.match || '',
      };
    });

    return { rows };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    actionOptions() {
      return [
        { label: 'Allow', value: 'allow' },
        { label: 'Drop', value: 'drop' },
        { label: 'Pass', value: 'pass' },
        { label: 'Reject', value: 'reject' },
        { label: 'Allow-related', value: 'allow-related' },
        { label: 'Allow-stateless', value: 'allow-stateless' },
      ];
    },
    directionOptions() {
      return [
        { label: 'To-lport', value: 'to-lport' },
        { label: 'From-lport', value: 'from-lport' },
      ];
    }
  },

  created() {
    this.queueUpdate = debounce(this.update, 100);
  },

  methods: {
    add() {
      this.rows.push({
        action:      '',
        direction:   '',
        priority:  this.rows.length,
        match:      '',
      });
      this.queueUpdate();
    },

    removeRule(idx) {
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
    <Banner
      v-if="rows.length > 0"
      color="info"
    >
      <t
        k="harvester.subnet.acl.banner"
        :raw="true"
      />
    </Banner>
    <div
      v-for="(row, idx) in rows"
      :key="idx"
    >
      <InfoBox class="box">
        <button
          type="button"
          class="role-link btn btn-sm removeBtn"
          :disabled="isView"
          @click="removeRule(idx)"
        >
          <i class="icon icon-x" />
        </button>
        <div class="row">
          <div class="col span-4">
            <LabeledSelect
              v-model:value="row.action"
              :mode="mode"
              class="mt-5 ml-5"
              :options="actionOptions"
              :required="true"
              :label="t('harvester.subnet.acl.action.label')"
              :placeholder="t('harvester.subnet.acl.action.placeholder')"
              @update:value="update"
            />
          </div>
          <div class="col span-4">
            <LabeledSelect
              v-model:value="row.direction"
              :mode="mode"
              :options="directionOptions"
              class="mt-5"
              :required="true"
              :label="t('harvester.subnet.acl.direction.label')"
              :placeholder="t('harvester.subnet.acl.direction.placeholder')"
              @update:value="update"
            />
          </div>
          <div class="col span-3">
            <LabeledInput
              v-model:value.number="row.priority"
              type="number"
              class="mb-20 mt-5"
              :max="32767"
              :min="0"
              :mode="mode"
              required
              label-key="harvester.subnet.acl.priority.label"
              @update:value="update"
            />
          </div>
        </div>
        <div class="row">
          <div class="col span-11">
            <LabeledInput
              v-model:value="row.match"
              class="mb-5 ml-5"
              :mode="mode"
              required
              :placeholder="t('harvester.subnet.acl.match.placeholder')"
              label-key="harvester.subnet.acl.match.label"
              @update:value="update"
            />
          </div>
        </div>
      </InfoBox>
    </div>
    <button
      type="button"
      class="btn role-tertiary add"
      :disabled="isView"
      @click="add()"
    >
      <t k="harvester.subnet.acl.addRule" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
  .box {
    position: relative;
  }
  .removeBtn {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 0px;
  }
</style>
