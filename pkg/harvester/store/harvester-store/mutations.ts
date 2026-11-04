//@ts-nocheck
import { markRaw } from 'vue';

// Side navigation counts requested by `fetchFilteredCounts`, see getters.ts
export default {
  filteredCountRequested(state: any, name: string) {
    state.filteredCountRequests[name] = (state.filteredCountRequests[name] || 0) + 1;
  },

  setFilteredCount(state: any, { name, count }: any) {
    state.filteredCounts = { ...state.filteredCounts, [name]: count };
  },

  // Keeps `filteredCountRequests`, so that a response of the previous cluster is still outdated
  resetFilteredCounts(state: any) {
    state.filteredCounts = {};
  },

  setFilteredCountWatchers(state: any, unwatchers: (() => void)[]) {
    state.filteredCountWatchers = markRaw(unwatchers);
  },
};
