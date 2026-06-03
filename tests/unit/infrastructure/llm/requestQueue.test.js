'use strict';

const { RequestQueue } = require('../../../../src/infrastructure/llm/requestQueue');

describe('RequestQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new RequestQueue(100); // 100ms delay for tests
  });

  test('should execute actions sequentially with minimum delay', async () => {
    const times = [];
    const fn1 = jest.fn().mockImplementation(() => {
      times.push(Date.now());
      return 'one';
    });
    const fn2 = jest.fn().mockImplementation(() => {
      times.push(Date.now());
      return 'two';
    });

    const p1 = queue.add(fn1);
    const p2 = queue.add(fn2);

    const results = await Promise.all([p1, p2]);

    expect(results).toEqual(['one', 'two']);
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();

    const diff = times[1] - times[0];
    expect(diff).toBeGreaterThanOrEqual(95); // roughly 100ms
  });

  test('should propagate errors from executed functions', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Queue error'));
    await expect(queue.add(fn)).rejects.toThrow('Queue error');
  });
});
