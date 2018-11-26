const { findNodeValue } = require('./utils')

const {
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  COMMAND_CLASS_SWITCH_BINARY,
  SENSOR_MULTILEVEL_INDEX_HUMIDITY,
  SENSOR_MULTILEVEL_INDEX_LUMINANCE,
  SENSOR_MULTILEVEL_INDEX_TEMPERATURE
} = require('./ZWave')

class AccessoryConfigurer {
  /**
   * AccessoryConfigurer constructor
   *
   * @param {Object} homekitService
   * @param {Object} homekitCharacteristic
   * @param {Object} log
   * @param {ZWave} zwave
   */
  constructor (
    homekitService,
    homekitCharacteristic,
    log,
    zwave
  ) {
    this._homekitService = homekitService
    this._homekitCharacteristic = homekitCharacteristic
    this._log = log
    this._zwave = zwave
  }

  /**
   * Configure a service for an accessory
   *
   * @param {Object} accessory
   * @param {String} service
   * @param {Object} zwaveNode
   */
  configureService (accessory, service, zwaveNode) {
    switch (service) {
      case 'AccessoryInformation':
        this._configureAccessoryInformationService(accessory, zwaveNode)
        break
      case 'Outlet':
        this._configureOutletService(accessory, zwaveNode)
        break
      case 'HumiditySensor':
        this._configureHumiditySensorService(accessory, zwaveNode)
        break
      case 'LightSensor':
        this._configureLightSensorService(accessory, zwaveNode)
        break
      case 'TemperatureSensor':
        this._configureTemperatureSensorService(accessory, zwaveNode)
        break
    }
  }

  /**
   * Configure the "Accessory Information" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureAccessoryInformationService (accessory, zwaveNode) {
    const infoService = this._getService(accessory, this._homekitService.AccessoryInformation)

    infoService
      .setCharacteristic(this._homekitCharacteristic.Manufacturer, zwaveNode.manufacturer)
      .setCharacteristic(this._homekitCharacteristic.Model, zwaveNode.product)
      .setCharacteristic(this._homekitCharacteristic.SerialNumber, 'Unknown') // TODO: where can we get the serial number from?
  }

  /**
   * Configure the "Outlet" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureOutletService (accessory, zwaveNode) {
    const outletService = this._getService(accessory, this._homekitService.Outlet)

    outletService
      .getCharacteristic(this._homekitCharacteristic.On)
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SWITCH_BINARY, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 1, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

        this._log(`${accessory.displayName} "On" characteristic value requested`)

        done(null, Boolean(nodeValue.value))
      })
      .on('set', (value, done) => {
        const newValue = Boolean(value)

        this._zwave.setNodeValue(
          zwaveNode.id,
          COMMAND_CLASS_SWITCH_BINARY, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          1, // TODO: is this always going to be 1?
          0, // TODO: is this always going to be 0?
          newValue
        )

        this._log(`${accessory.displayName} "On" characteristic value updated to: ${newValue}`)

        done(null)
      })

    outletService
      .getCharacteristic(this._homekitCharacteristic.OutletInUse)
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SWITCH_BINARY, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 1, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

        this._log(`${accessory.displayName} "Outlet In Use" characteristic value requested`)

        done(null, Boolean(nodeValue.value))
      })
  }

  /**
   * Configure the "Humidity Sensor" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureHumiditySensorService (accessory, zwaveNode) {
    const humiditySensorService = this._getService(accessory, this._homekitService.HumiditySensor)

    humiditySensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentRelativeHumidity)
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_HUMIDITY // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_HUMIDITY?
        })

        this._log(`${accessory.displayName} "Current Relative Humidity" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })
  }

  /**
   * Configure the "Light Sensor" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureLightSensorService (accessory, zwaveNode) {
    const lightSensorService = this._getService(accessory, this._homekitService.LightSensor)

    lightSensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentAmbientLightLevel)
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_LUMINANCE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_LUMINANCE?
        })

        this._log(`${accessory.displayName} "Current Ambient Light Level" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })
  }

  /**
   * Configure the "Temperature Sensor" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureTemperatureSensorService (accessory, zwaveNode) {
    const temperatureSensorService = this._getService(accessory, this._homekitService.TemperatureSensor)

    temperatureSensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentTemperature)
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_TEMPERATURE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_TEMPERATURE?
        })

        this._log(`${accessory.displayName} "Current Temperature" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })
  }

  /**
   * Get a service associated with an accessory. If the service does not exist on
   * the service, ensure it is created.
   *
   * @param {Object} accessory
   * @param {String} serviceType
   */
  _getService (accessory, serviceType) {
    return accessory.getService(serviceType) || accessory.addService(serviceType, accessory.displayName)
  }
}

module.exports = AccessoryConfigurer
