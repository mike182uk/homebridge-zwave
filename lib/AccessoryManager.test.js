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

  test('returns null if ZWave value is undefined', () => {
    mockFindNodeResult({ value: undefined });
    expect(manager._findNodeSerialNumber(1)).toBe(null);
  });

  test('returns null if ZWave result is empty', () => {
    mockFindNodeResult({});
    expect(manager._findNodeSerialNumber(1)).toBe(null);
  });

  test('returns null if entire ZWave result is undefined', () => {
    mockFindNodeResult(undefined);
    expect(manager._findNodeSerialNumber(1)).toBe(null);
  });
});
