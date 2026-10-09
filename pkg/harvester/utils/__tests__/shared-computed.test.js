import { reactive } from 'vue';
import { sharedComputed } from '../shared-computed';

describe('sharedComputed', () => {
  it('should run the function once per source and key, not once per call', () => {
    const source = reactive([1, 2, 3]);
    const fn = jest.fn((list) => list.length);

    expect(sharedComputed(source, 'length', fn)).toBe(3);
    expect(sharedComputed(source, 'length', fn)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should run the function again after reactive data it read changed', () => {
    const source = reactive([1, 2, 3]);
    const fn = jest.fn((list) => list.length);

    expect(sharedComputed(source, 'length', fn)).toBe(3);

    source.push(4);

    expect(sharedComputed(source, 'length', fn)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should keep the values of different keys and different sources apart', () => {
    const one = reactive([1]);
    const two = reactive([1, 2]);

    expect(sharedComputed(one, 'length', (list) => list.length)).toBe(1);
    expect(sharedComputed(two, 'length', (list) => list.length)).toBe(2);
    expect(sharedComputed(one, 'first', (list) => list[0])).toBe(1);
  });
});
