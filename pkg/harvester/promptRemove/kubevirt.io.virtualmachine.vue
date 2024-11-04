<script>
import { mapState, mapGetters } from 'vuex';
import { isEmpty } from '@shell/utils/object';
import Parse from 'url-parse';
import { resourceNames } from '@shell/utils/string';
import { HCI } from '../types';

export default {
  name: 'HarvesterPromptRemove',

  props: {
    value: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    names: {
      type:    Array,
      default: () => {
        return [];
      }
    },

    type: {
      type:     String,
      required: true
    },
    close: {
      type:     Function,
      required: true
    },
    doneLocation: {
      type:    Object,
      default: () => {}
    }
  },

  data() {
    return {
      checkedList: [],
      checkAll:    true
    };
  },

  computed: {
    ...mapState('action-menu', ['toRemove']),
    ...mapGetters({ t: 'i18n/t' }),

    removeNameArr() {
      const out = {};

      this.value.forEach((crd) => {
        if (crd.type !== HCI.VM) {
          return;
        }
        const volumes = crd.spec.template.spec?.volumes || [];
        const names = volumes.filter((volume) => volume.persistentVolumeClaim ).map((volume) => {
          if (volume.persistentVolumeClaim) {
            return volume.name;
          }
        });

        out[crd.id] = names;
      });

      return out;
    },

    plusMore() {
      const remaining = this.toRemove.length - this.names.length;

      return this.t('promptRemove.andOthers', { count: remaining });
    },
  },

  watch: {
    removeNameArr: {
      handler(neu) {
        if (this.value.length === 1) {
          const keys = Object.values(neu[this.value[0].id]);

          this.checkedList.unshift(keys[0]);
        }
      },
      deep:      true,
      immediate: true
    }
  },

  methods: {
    resourceNames,
    remove() {
      let goTo;

      if (this.doneLocation) {
        // doneLocation will recompute to undefined when delete request completes
        goTo = { ...this.doneLocation };
      }

      Promise.all(this.value.map((resource) => {
        if (resource.type !== HCI.VM) { // maybe is VMI
          resource.remove();

          return;
        }

        let removedDisks = '';

        if (this.value.length > 1) {
          if (this.checkAll) {
            this.removeNameArr[resource.id].forEach((item) => {
              removedDisks += `removedDisks=${ item }&`;
            });
          }
        } else {
          this.checkedList.forEach((item) => {
            removedDisks += `removedDisks=${ item }&`;
          });
          removedDisks.replace(/&$/, '');
        }

        const parsed = Parse(resource.links.self);

        resource.remove({ url: `${ parsed.pathname }?${ removedDisks }propagationPolicy=Foreground` });
      })).then((_results) => {
        if ( goTo && !isEmpty(goTo) ) {
          this.value?.[0]?.currentRouter().push(goTo)
        }
        this.close();
      }).catch((err) => {
        this.$emit('errors', err);
      });
    }
  }
};
</script>

<template>
  <div class="mt-10">
    {{ t('promptRemove.attemptingToRemove', {type}) }}
    <span v-clean-html="resourceNames(names, plusMore, t)"></span>

    <div class="mt-10">
      {{ t('harvester.virtualMachine.promptRemove.title') }}
    </div>
    <div v-if="value.length === 1">
      <span
        v-for="(name, i) in removeNameArr[value[0].id]"
        :key="i"
      >
        <label class="checkbox-container mr-15"><input
                                                  v-model="checkedList"
                                                  type="checkbox"
                                                  :label="name"
                                                  :value="name"
                                                />
          <span
            class="checkbox-custom mr-5"
            role="checkbox"
          />
          {{ name }}
        </label>
      </span>
    </div>

    <div v-else>
      <label class="checkbox-container mr-15"><input
                                                v-model="checkAll"
                                                type="checkbox"
                                              />
        <span
          class="checkbox-custom mr-5"
          role="checkbox"
        />
        {{ t('harvester.virtualMachine.promptRemove.deleteAll') }}
      </label>
    </div>
  </div>
</template>
