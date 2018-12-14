const { findNodeValue } = require('./utils')

const {
  ALARM_INDEX_HOME_SECURITY,
  COMMAND_CLASS_ALARM,
  COMMAND_CLASS_METER,
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  COMMAND_CLASS_SWITCH_BINARY,
  METER_INDEX_ELECTRIC_INSTANT_POWER,
  SENSOR_MULTILEVEL_INDEX_HUMIDITY,
  SENSOR_MULTILEVEL_INDEX_LUMINANCE,
  SENSOR_MULTILEVEL_INDEX_TEMPERATURE
} = require('./ZWave')

class AccessoryServiceConfigurer {
  /**
   * AccessoryServiceConfigurer constructor
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
      case 'HumiditySensor':
        this._configureHumiditySensorService(accessory, zwaveNode)
        break
      case 'LightSensor':
        this._configureLightSensorService(accessory, zwaveNode)
        break
      case 'MotionSensor':
        this._configureMotionSensorService(accessory, zwaveNode)
        break
      case 'Outlet':
        this._configureOutletService(accessory, zwaveNode)
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
    this._getService(accessory, this._homekitService.AccessoryInformation)
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
    const onCharacteristic = outletService.getCharacteristic(this._homekitCharacteristic.On)
    const outletInUseCharacteristic = outletService.getCharacteristic(this._homekitCharacteristic.OutletInUse)

    // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
    onCharacteristic
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
        const nodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_SWITCH_BINARY}-1-0` // TODO: is this always going to be the node value id?

        // note: this will trigger any event handlers listening for change events on this node value
        this._zwave.updateNodeValueById(nodeValueId, newValue)

        this._log(`${accessory.displayName} "On" characteristic value updated to: ${newValue}`)

        done(null)
      })

    // Setup handler for when the value for the "Outlet In Use" characteristic is requested by HomeKit
    outletInUseCharacteristic
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_METER, // TODO: is this always going to be COMMAND_CLASS_METER?
          instance: 1, // TODO: is this always going to be 1?
          index: METER_INDEX_ELECTRIC_INSTANT_POWER // TODO: is this always going to be METER_INDEX_ELECTRIC_INSTANT_POWER?
        })

        this._log(`${accessory.displayName} "Outlet In Use" characteristic value requested`)

        done(null, Number(nodeValue.value) > 0)
      })

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit
    const onCharacteristicZwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_SWITCH_BINARY}-1-0` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(onCharacteristicZwaveNodeValueId, ({ value }) => {
      value = Boolean(value)

      // TODO: this is to ensure that this event handler is not executed as a result
      // of us updating the accessory via the HomeKit. Is there a better way of doing this?
      if (onCharacteristic.value === value) {
        return
      }

      onCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "On" characteristic value updated to ${value} outside of HomeKit`)
    })

    const outletInUseZwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_METER}-1-${METER_INDEX_ELECTRIC_INSTANT_POWER}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(outletInUseZwaveNodeValueId, ({ value }) => {
      value = Number(value) > 0

      outletInUseCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "Outlet In Use" characteristic value updated to ${value} outside of HomeKit`)
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
    const currentRelativeHumidityCharacteristic = humiditySensorService.getCharacteristic(this._homekitCharacteristic.CurrentRelativeHumidity)

    currentRelativeHumidityCharacteristic
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_HUMIDITY // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_HUMIDITY?
        })

        this._log(`${accessory.displayName} "Current Relative Humidity" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_HUMIDITY}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, ({ value }) => {
      value = Number(value)

      currentRelativeHumidityCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
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
    const currentAmbientLightLevelCharacteristic = lightSensorService.getCharacteristic(this._homekitCharacteristic.CurrentAmbientLightLevel)

    currentAmbientLightLevelCharacteristic
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_LUMINANCE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_LUMINANCE?
        })

        this._log(`${accessory.displayName} "Current Ambient Light Level" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_LUMINANCE}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, ({ value }) => {
      value = Number(value)

      currentAmbientLightLevelCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Configure the "Motion Sensor" service for the accessory
   *
   * @param {Object} accessory
   * @param {Object} zwaveNode
   */
  _configureMotionSensorService (accessory, zwaveNode) {
    const motionSensorService = this._getService(accessory, this._homekitService.MotionSensor)
    const motionDetectedCharacteristic = motionSensorService.getCharacteristic(this._homekitCharacteristic.MotionDetected)

    // Setup handler for when the value for the "Motion Detected" characteristic is requested by HomeKit
    motionDetectedCharacteristic.on('get', done => {
      const zwaveNodeValue = findNodeValue(zwaveNode.values, {
        class_id: COMMAND_CLASS_ALARM, // TODO: is this always going to be COMMAND_CLASS_ALARM?
        instance: 1, // TODO: is this always going to be 1?
        index: ALARM_INDEX_HOME_SECURITY // TODO: is this always going to be ALARM_INDEX_HOME_SECURITY?
      })

      this._log(`${accessory.displayName} "Motion Detected" characteristic value requested`)

      done(null, Boolean(zwaveNodeValue.value))
    })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_ALARM}-1-${ALARM_INDEX_HOME_SECURITY}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, ({ value }) => {
      value = Boolean(value)

      motionDetectedCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "Motion Detected" characteristic value updated to ${value} outside of HomeKit`)
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
    const currentTemperatureCharacteristic = temperatureSensorService.getCharacteristic(this._homekitCharacteristic.CurrentTemperature)

    // Setup handler for when the value for the "Current Temperature" characteristic is requested by HomeKit
    currentTemperatureCharacteristic
      .on('get', done => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_TEMPERATURE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_TEMPERATURE?
        })

        this._log(`${accessory.displayName} "Current Temperature" characteristic value requested`)

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNode.id}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_TEMPERATURE}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, ({ value }) => {
      value = Number(value)

      currentTemperatureCharacteristic.updateValue(value)

      this._log(`${accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
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

module.exports = AccessoryServiceConfigurer
