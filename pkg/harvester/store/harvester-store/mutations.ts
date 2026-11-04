//@ts-nocheck
import { markRaw } from 'vue';

// Side navigation counts requested by `fetchFilteredCounts`, see nav-counts.ts
export default {
  filteredCountRequested(state: any, name: string) {
    state.filteredCountRequests[name] = (state.filteredCountRequests[name] || 0) + 1;
  },

  setFilteredCount(state: any, { name, count }: any) {
    state.filteredCounts = { ...state.filteredCounts, [name]: count };
  },

  resetFilteredCounts(state: any) {
    state.filteredCounts = {};
    state.filteredCountRequests = {};
  },

  setFilteredCountWatchers(state: any, unwatchers: (() => void)[]) {
    state.filteredCountWatchers = markRaw(unwatchers);
  },
};
