const AccessoryManager = require('./AccessoryManager');

describe('_findNodeSerialNumber', () => {
  const mockZwave = {},
        manager = new AccessoryManager({}, {}, console.log, mockZwave);

  function mockFindNodeResult(result) {
    mockZwave.findNodeValue = (_nodeId, _options = {}) => result;
  }

  test('returns serialNumber if provided by ZWave', () => {
    mockFindNodeResult({ value: '12345'});
    expect(manager._findNodeSerialNumber(1)).toBe('12345');
  });

  test('returns undefined if ZWave value is undefined', () => {
    mockFindNodeResult({});
    expect(manager._findNodeSerialNumber(1)).toBe(undefined);
  });

  test('returns undefined if entire ZWave result is undefined', () => {
    mockFindNodeResult(undefined);
    expect(manager._findNodeSerialNumber(1)).toBe(undefined);
  });
});
