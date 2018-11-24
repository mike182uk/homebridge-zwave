const { COMMAND_CLASS_SWITCH_BINARY } = require('./ZWave')
const { findNodeValue } = require('./utils')

class OutletAccessoryBuilder {
  /**
   * OutletAccessoryBuilder constructor
   *
   * @param {AccessoryBuilder} accessoryBuilder
   * @param {Object} log
   * @param {ZWave} zwave
   */
  constructor (accessoryBuilder, log, zwave) {
    this._accessoryBuilder = accessoryBuilder
    this._log = log
    this._zwave = zwave
  }

  /**
   * Build a new "Outlet" accessory
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   */
  build (accessoryDisplayName, zwaveNode) {
    const log = this._log.debug.bind(this._log)

    return this._accessoryBuilder
      .build()
      .withInformationService(
        zwaveNode.manufacturer,
        zwaveNode.product,
        'Unknown' // TODO: where can we get the serial number from?
      )
      .withOutletService(
        this._getOnCharacteristicGetter(accessoryDisplayName, zwaveNode, log),
        this._getOnCharacteristicSetter(accessoryDisplayName, zwaveNode, this._zwave, log),
        this._getOutletInUseCharacteristicGetter(accessoryDisplayName, zwaveNode, log)
      )
      .get()
  }

  /**
   * Get the "On" characteristic getter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {Function} log
   * @returns {Function}
   */
  _getOnCharacteristicGetter (accessoryDisplayName, zwaveNode, log) {
    return function (done) {
      const nodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_SWITCH_BINARY,
        instance: 1, // TODO: is this always going to be 1?
        index: 0 // TODO: is this always going to be 0?
      })

      log(`${accessoryDisplayName} "On" characteristic value requested`)

      done(null, Boolean(nodeValue.value))
    }
  }

  /**
   * Get the "On" characteristic setter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {ZWave} zwave
   * @param {Function} log
   * @returns {Function}
   */
  _getOnCharacteristicSetter (accessoryDisplayName, zwaveNode, zwave, log) {
    return function (value, done) {
      const newValue = Boolean(value)

      zwave.setNodeValue(
        zwaveNode.id,
        COMMAND_CLASS_SWITCH_BINARY,
        1, // TODO: is this always going to be 1?
        0, // TODO: is this always going to be 0?
        newValue
      )

      log(`${accessoryDisplayName} "On" characteristic value updated to: ${newValue}`)

      done(null)
    }
  }

  /**
   * Get the "Outlet In Use" characteristic getter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {Function} log
   * @returns {Function}
   */
  _getOutletInUseCharacteristicGetter (accessoryDisplayName, zwaveNode, log) {
    return function (done) {
      const nodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_SWITCH_BINARY,
        instance: 1, // TODO: is this always going to be 1?
        index: 0 // TODO: is this always going to be 0?
      })

      log(`${accessoryDisplayName} "Outlet In Use" characteristic value requested`)

      done(null, Boolean(nodeValue.value))
    }
  }
}

module.exports = OutletAccessoryBuilder
