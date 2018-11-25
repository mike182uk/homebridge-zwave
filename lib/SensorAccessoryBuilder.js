const {
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  SENSOR_MULTILEVEL_INDEX_HUMIDITY,
  SENSOR_MULTILEVEL_INDEX_LUMINANCE,
  SENSOR_MULTILEVEL_INDEX_TEMPERATURE
} = require('./ZWave')
const { findNodeValue } = require('./utils')

class SensorAccessoryBuilder {
  /**
   * SensorAccessoryBuilder constructor
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
   * Build a new "Sensor" accessory
   *
   * @param {String} accessoryDisplayName
   * @param {[]String} sensors
   * @param {Object} zwaveNode
   */
  build (accessoryDisplayName, sensors, zwaveNode) {
    const log = this._log.debug.bind(this._log)

    const accessory = this._accessoryBuilder
      .build()
      .withInformationService(
        zwaveNode.manufacturer,
        zwaveNode.product,
        'Unknown' // TODO: where can we get the serial number from?
      )

    if (sensors.includes('humidity')) {
      accessory.withHumiditySensorService(
        this._getCurrentRelativeHumidityCharacteristicGetter(accessoryDisplayName, zwaveNode, log)
      )
    }

    if (sensors.includes('light')) {
      accessory.withLightSensorService(
        this._getCurrentAmbientLightLevelCharacteristicGetter(accessoryDisplayName, zwaveNode, log)
      )
    }

    if (sensors.includes('temperature')) {
      accessory.withTemperatureSensorService(
        this._getCurrentTemperatureCharacteristicGetter(accessoryDisplayName, zwaveNode, log)
      )
    }

    return accessory.get()
  }

  /**
   * Get the "Current Temperature" characteristic getter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {Function} log
   * @returns {Function}
   */
  _getCurrentTemperatureCharacteristicGetter (accessoryDisplayName, zwaveNode, log) {
    return function (done) {
      const nodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
        instance: 1, // TODO: is this always going to be 1?
        index: SENSOR_MULTILEVEL_INDEX_TEMPERATURE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_TEMPERATURE?
      })

      log(`${accessoryDisplayName} "Current Temperature" characteristic value requested`)

      done(null, Number(nodeValue.value))
    }
  }

  /**
   * Get the "Current Relative Humidity" characteristic getter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {Function} log
   * @returns {Function}
   */
  _getCurrentRelativeHumidityCharacteristicGetter (accessoryDisplayName, zwaveNode, log) {
    return function (done) {
      const nodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
        instance: 1, // TODO: is this always going to be 1?
        index: SENSOR_MULTILEVEL_INDEX_HUMIDITY // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_HUMIDITY?
      })

      log(`${accessoryDisplayName} "Current Relative Humidity" characteristic value requested`)

      done(null, Number(nodeValue.value))
    }
  }

  /**
   * Get the "Current Ambient Light Level" characteristic getter
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   * @param {Function} log
   * @returns {Function}
   */
  _getCurrentAmbientLightLevelCharacteristicGetter (accessoryDisplayName, zwaveNode, log) {
    return function (done) {
      const nodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
        instance: 1, // TODO: is this always going to be 1?
        index: SENSOR_MULTILEVEL_INDEX_LUMINANCE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_LUMINANCE?
      })

      log(`${accessoryDisplayName} "Current Ambient Light Level" characteristic value requested`)

      done(null, Number(nodeValue.value))
    }
  }
}

module.exports = SensorAccessoryBuilder
