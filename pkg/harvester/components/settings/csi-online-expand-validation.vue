<script>
import { _EDIT } from '@shell/config/query-params';
import LabeledSelect from '@shell/components/form/LabeledSelect';
import InfoBox from '@shell/components/InfoBox';
import { Banner } from '@components/Banner';
import { allHash } from '@shell/utils/promise';
import { CSI_DRIVER } from '../../types';
import { LONGHORN_DRIVER } from '@shell/config/types';

export default {
  name: 'CSIOnlineExpandValidation',

  components: {
    Banner,
    InfoBox,
    LabeledSelect,
  },

  props: {
    mode: {
      type:    String,
      default: _EDIT,
    },
    value: {
      type:    Object,
      default: () => ({}),
    },
    registerBeforeHook: {
      type:     Function,
      required: true,
    },
  },

  async fetch() {
    const inStore = this.$store.getters['currentProduct'].inStore;

    try {
      await allHash({ csiDrivers: this.$store.dispatch(`${ inStore }/findAll`, { type: CSI_DRIVER }) });
      this.fetchError = null;
    } catch (error) {
      console.error('Failed to fetch CSI drivers:', error); // eslint-disable-line no-console
      this.fetchError = this.t(
        'harvester.setting.csiOnlineExpandValidation.failedToLoadDrivers',
        { error: error.message || error },
        true
      );
    }
  },

  data() {
    return {
      configArr:  [],
      parseError: null,
      fetchError: null,
    };
  },

  created() {
    const initValue = this.value.value || this.value.default || '{}';

    this.configArr = this.parseValue(initValue);
    this.registerBeforeHook?.(this.willSave, 'willSave');
  },

  computed: {
    allErrors() {
      const errors = [];

      if (this.fetchError) {
        errors.push(this.fetchError);
      }
      if (this.parseError) {
        errors.push(this.parseError);
      }

      return errors;
    },

    csiDrivers() {
      if (this.fetchError) return [];

      const inStore = this.$store.getters['currentProduct'].inStore;

      return this.$store.getters[`${ inStore }/all`](CSI_DRIVER) || [];
    },

    provisioners() {
      const usedKeys = this.configArr.map(({ key }) => key);

      return this.csiDrivers
        .filter(({ name }) => !usedKeys.includes(name))
        .map(({ name }) => name);
    },

    provisionerValue() {
      return [
        { label: 'True', value: true },
        { label: 'False', value: false },
      ];
    },

    disableAdd() {
      return this.parseError || this.fetchError || this.configArr.length >= this.csiDrivers.length;
    },

    disableConfigEditing() {
      return this.parseError || this.fetchError;
    }
  },

  watch: {
    'value.value'(newVal, oldVal) {
      if (newVal !== oldVal) {
        this.configArr = this.parseValue(newVal || '{}');
      }
    }
  },

  methods: {
    _convertToBoolean(value) {
      if (typeof value === 'boolean') return value;

      if (typeof value === 'string') {
        const lowerCaseValue = value.toLowerCase();

        if (lowerCaseValue === 'true') return true;
        if (lowerCaseValue === 'false') return false;
      }

      return false; // default to false for any other string or non-boolean type
    },
    parseValue(raw) {
      try {
        const json = JSON.parse(raw);

        this.parseError = null;

        return Object.entries(json).map(([key, value]) => ({
          key,
          value: this._convertToBoolean(value),
        }));
      } catch (e) {
        console.error('[CSIOnlineExpandValidation] JSON Parsing Error:', raw, e); // eslint-disable-line no-console
        this.parseError = this.t(
          'harvester.setting.csiOnlineExpandValidation.invalidJsonFormat',
          { error: e.message },
          true
        );

        return [];
      }
    },

    stringifyConfig() {
      const obj = {};

      this.configArr.forEach(({ key, value }) => {
        obj[key] = value;
      });

      return this.configArr.length ? JSON.stringify(obj) : '';
    },

    update() {
      this.value.value = this.stringifyConfig();
    },

    willSave() {
      const errors = [];

      this.configArr.forEach(({ key }) => {
        if (!key) {
          errors.push(
            this.t('validation.required', { key: this.t('harvester.setting.csiOnlineExpandValidation.provisioner') }, true)
          );
        }
      });

      this.value.value = this.stringifyConfig();

      return errors.length ? Promise.reject(errors) : Promise.resolve();
    },

    useDefault() {
      this.configArr = this.parseValue(this.value.default || '{}');
      this.update();
    },

    disableEdit(driverKey) {
      return this.fetchError || driverKey === LONGHORN_DRIVER;
    },

    add() {
      if (this.disableConfigEditing) return;

      this.configArr.push({ key: '', value: true });
    },

    remove(index) {
      if (this.disableConfigEditing) return;

      this.configArr.splice(index, 1);
      this.update();
    },

    onValueChange(idx, newVal) {
      if (this.disableConfigEditing) return;

      const val = newVal === 'true' ? true : newVal === 'false' ? false : newVal;

      this.configArr[idx].value = val;
      this.update();
    },
  },
};
</script>

<template>
  <div>
    <Banner
      v-for="(errorMsg, index) in allErrors"
      :key="index"
      color="error"
    >
      {{ errorMsg }}
    </Banner>
    <InfoBox
      v-for="(driver, idx) in configArr"
      :key="idx"
      class="box"
    >
      <button
        class="role-link btn btn-sm remove"
        type="button"
        :disabled="disableEdit(driver.key)"
        @click="remove(idx)"
      >
        <i class="icon icon-x" />
      </button>

      <div class="row">
        <div class="col span-4">
          <LabeledSelect
            v-model:value="driver.key"
            label-key="harvester.setting.csiOnlineExpandValidation.provisioner"
            required
            searchable
            :mode="mode"
            :disabled="disableEdit(driver.key)"
            :options="provisioners"
            @update:value="update"
            @keydown.native.enter.prevent
          />
        </div>

        <div class="col span-4">
          <LabeledSelect
            v-model:value="driver.value"
            :value="driver.value.toString()"
            label-key="harvester.setting.csiOnlineExpandValidation.value"
            required
            searchable
            :mode="mode"
            :disabled="disableEdit(driver.key)"
            :options="provisionerValue"
            @update:value="val => onValueChange(idx, val)"
            @keydown.native.enter.prevent
          />
        </div>
      </div>
    </InfoBox>

    <button
      class="btn btn-sm role-primary"
      :disabled="disableAdd"
      @click="add"
    >
      {{ t('generic.add') }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.box {
  position: relative;
  padding-top: 40px;
}
.remove {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 0;
}
</style>
