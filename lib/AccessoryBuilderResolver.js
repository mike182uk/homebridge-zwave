const { findNodeValue } = require('./utils')
const OutletAccessoryBuilder = require('./OutletAccessoryBuilder')

const {
  COMMAND_CLASS_METER,
  COMMAND_CLASS_SWITCH_BINARY,
  METER_INDEX_ELECTRIC_INSTANT_POWER
} = require('./ZWave')

class AccessoryBuilderResolver {
  /**
   * Resolve the correct Accessory Builder for ZWave noed
   *
   * @param {Object} zwaveNode
   *
   * @returns {Object}
   */
  resolve (zwaveNode) {
    let accessoryBuilder

    // Is the ZWave node a power outlet?
    accessoryBuilder = this._resolveOutletAccessoryBuilder(zwaveNode)

    if (accessoryBuilder) {
      return accessoryBuilder
    }
  }

  /**
   * Resolve the OutletAccessoryBuilder if the ZWave node is a power outlet
   *
   * @param {Object} zwaveNode
   *
   * @returns {OutletAccessoryBuilder}
   */
  _resolveOutletAccessoryBuilder (zwaveNode) {
    const binarySwitchValueNodeValue = findNodeValue(zwaveNode.values, {
      class_id: COMMAND_CLASS_SWITCH_BINARY,
      instance: 1, // TODO: is this always going to be 1?
      index: 0 // TODO: is this always going to be 0?
    })

    const powerValueNodeValue = findNodeValue(zwaveNode.values, {
      class_id: COMMAND_CLASS_METER,
      instance: 1, // TODO: is this always going to be 1?
      index: METER_INDEX_ELECTRIC_INSTANT_POWER // TODO: is this always going to be METER_INDEX_ELECTRIC_INSTANT_POWER?
    })

    if (binarySwitchValueNodeValue && powerValueNodeValue) {
      return OutletAccessoryBuilder
    }
  }
}

module.exports = AccessoryBuilderResolver
