<script>
import InfoBox from '@shell/components/InfoBox';

import { NETWORK_ATTACHMENT } from '@shell/config/types';
import { sortBy } from '@shell/utils/sort';
import { clone } from '@shell/utils/object';
import { randomStr } from '@shell/utils/string';
import { removeObject } from '@shell/utils/array';
import { _VIEW } from '@shell/config/query-params';
import { HCI as HCI_ANNOTATIONS } from '../../../config/labels-annotations';
import Base from './base';

export default {
  components: { InfoBox, Base },

  props: {
    vm: {
      type:    Object,
      default: () => {
        return {};
      }
    },

    mode: {
      type:    String,
      default: 'create'
    },

    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    isSingle: {
      type:    Boolean,
      default: true
    }
  },

  async fetch() {
    this.canCheckHotunplug = !!this.vm?.actions?.findHotunpluggableNics;

    if (!this.canCheckHotunplug) {
      this.hotunpluggableNics = new Set();
      this.rows = this.mergeHotplugData(clone(this.value));

      return;
    }

    try {
      const resp = await this.vm.doAction('findHotunpluggableNics');

      this.hotunpluggableNics = new Set(resp?.interfaces || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch hot-unpluggable NICs:', e);
      this.hotunpluggableNics = new Set();
    }

    this.rows = this.mergeHotplugData(clone(this.value));
  },

  data() {
    return {
      nameIdx:            1,
      rows:               this.addKeyId(clone(this.value)),
      hotunpluggableNics: new Set(),
      canCheckHotunplug:  false,
    };
  },

  computed: {
    isView() {
      return this.mode === _VIEW;
    },

    networkOption() {
      const choices = this.$store.getters['harvester/all'](NETWORK_ATTACHMENT).filter((row) => {
        return !row.metadata?.annotations?.[HCI_ANNOTATIONS.STORAGE_NETWORK];
      });

      const out = sortBy(
        choices.map((N) => {
          const label = N.isNotReady ? `${ N.id } (${ this.t('generic.notReady') })` : N.id;

          return {
            label,
            value:    N.id,
            disabled: N.isNotReady,
          };
        }),
        'label'
      );

      return out;
    },
  },

  watch: {
    value(neu) {
      this.rows = this.mergeHotplugData(clone(neu));
    },
  },

  methods: {
    mergeHotplugData(baseNics) {
      const hotunpluggableSet = this.hotunpluggableNics;

      return (baseNics || []).map((row) => ({
        ...row,
        isHotunpluggable: hotunpluggableSet.has(row.name),
        rowKeyId:         row.rowKeyId || randomStr(10)
      }));
    },

    add(type) {
      const name = this.generateName();

      const neu = {
        name,
        networkName: '',
        model:       'virtio',
        type:        'bridge',
        newCreateId: randomStr(10),
        rowKeyId:    randomStr(10)
      };

      this.rows.push(neu);
      this.update();
    },

    remove(vol) {
      removeObject(this.rows, vol);
      this.update();
    },

    addKeyId(row) {
      return row.map((R) => {
        return {
          ...R,
          rowKeyId: randomStr(10)
        };
      });
    },

    generateName() {
      let name = '';
      let hasUsed = true;

      while (hasUsed) {
        name = `nic-${ this.nameIdx }`;
        hasUsed = this.rows.find( (O) => O.name === name);
        this.nameIdx++;
      }

      return name;
    },

    update() {
      this.$emit('update:value', this.rows);
    },

    unplugNIC(network) {
      this.vm.unplugNIC(network.name);
    },
  }
};
</script>

<template>
  <div>
    <InfoBox
      v-for="(row, i) in rows"
      :key="i"
    >
      <div class="box-title mb-10">
        <h3>
          {{ t('harvester.virtualMachine.network.title') }}
        </h3>
        <button
          v-if="!isView"
          type="button"
          class="role-link btn btn-sm remove"
          @click="remove(row)"
        >
          <i class="icon icon-x" />
        </button>
        <button
          v-if="vm.hotplugNicFeatureEnabled && isView"
          type="button"
          class="role-link btn btn-sm remove"
          :disabled="!canCheckHotunplug || !row.isHotunpluggable"
          @click="unplugNIC(row)"
        >
          {{ t('harvester.virtualMachine.hotUnplug.detachNIC.actionLabel') }}
        </button>
      </div>
      <Base
        v-model:value="rows[i]"
        :rows="rows"
        :mode="mode"
        :is-single="isSingle"
        :network-option="networkOption"
        @update="update"
      />
    </InfoBox>

    <button
      v-if="!isView"
      type="button"
      class="btn btn-sm bg-primary"
      @click="add"
    >
      {{ t('harvester.virtualMachine.network.addNetwork') }}
    </button>
  </div>
</template>

<style lang='scss' scoped>
.box-title{
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    margin-bottom: 0;
  }
}
</style>
