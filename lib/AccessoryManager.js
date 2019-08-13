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

const READY_STATE_UNREADY = 0
const READY_STATE_READY = 1

class AccessoryManager {
  /**
   * AccessoryManager constructor
   *
   * @param {Object} hapService
   * @param {Object} hapCharacteristic
   * @param {Function} log
   * @param {Object} zwave
   */
  constructor (
    hapService,
    hapCharacteristic,
    log,
    zwave
  ) {
    this._hapService = hapService
    this._hapCharacteristic = hapCharacteristic
    this._log = log
    this._zwave = zwave

    this._accessory = null
    this._accessoryConfig = null
    this._accessoryReadyState = READY_STATE_UNREADY
  }

  /**
   * Initialize an accessory
   *
   * @param {Object} accessoryConfig
   * @param {Object} accessory
   */
  initializeAccessory (accessoryConfig, accessory) {
    this._accessoryConfig = accessoryConfig
    this._accessory = accessory

    accessoryConfig.homekitServices
      .concat('AccessoryInformation')
      .forEach(service => {
        switch (service) {
          case 'AccessoryInformation':
            this._configureAccessoryInformationService()
            break
          case 'HumiditySensor':
            this._configureHumiditySensorService()
            break
          case 'LightSensor':
            this._configureLightSensorService()
            break
          case 'MotionSensor':
            this._configureMotionSensorService()
            break
          case 'Outlet':
            this._configureOutletService()
            break
          case 'TemperatureSensor':
            this._configureTemperatureSensorService()
            break
        }
      })

    this._zwave.onNodeReady(accessoryConfig.zwaveNodeId, zwaveNode => {
      this._accessoryReadyState = READY_STATE_READY

      // Update the information service with the latest node information
      this._configureAccessoryInformationService(zwaveNode)
    })
  }

  /**
   * Configure the "Accessory Information" service for the accessory
   *
   * @param {Object} zwaveNode
   */
  _configureAccessoryInformationService (zwaveNode) {
    this._getService(this._hapService.AccessoryInformation)
      .setCharacteristic(this._hapCharacteristic.Manufacturer, zwaveNode ? zwaveNode.manufacturer : 'Unknown')
      .setCharacteristic(this._hapCharacteristic.Model, zwaveNode ? zwaveNode.product : 'Unknown')
      .setCharacteristic(this._hapCharacteristic.SerialNumber, 'Unknown') // TODO: where can we get the serial number from?
  }

  /**
   * Configure the "Outlet" service for the accessory
   */
  _configureOutletService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const outletService = this._getService(this._hapService.Outlet)
    const onCharacteristic = outletService.getCharacteristic(this._hapCharacteristic.On)
    const outletInUseCharacteristic = outletService.getCharacteristic(this._hapCharacteristic.OutletInUse)

    // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
    onCharacteristic
      .on('get', done => {
        this._log(`${accessoryDisplayName} "On" characteristic value requested`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_BINARY, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 1, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

        done(null, Boolean(nodeValue.value))
      })
      .on('set', (value, done) => {
        const newValue = Boolean(value)
        const nodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_BINARY}-1-0` // TODO: is this always going to be the node value id?

        this._log(`${this._accessory.displayName} "On" characteristic value updating to: ${newValue}`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        // note: this will trigger any event handlers listening for change events on this node value
        this._zwave.updateNodeValueById(nodeValueId, newValue)

        done(null)
      })

    // Setup handler for when the value for the "Outlet In Use" characteristic is requested by HomeKit
    outletInUseCharacteristic
      .on('get', done => {
        this._log(`${this._accessory.displayName} "Outlet In Use" characteristic value requested`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_METER, // TODO: is this always going to be COMMAND_CLASS_METER?
          instance: 1, // TODO: is this always going to be 1?
          index: METER_INDEX_ELECTRIC_INSTANT_POWER // TODO: is this always going to be METER_INDEX_ELECTRIC_INSTANT_POWER?
        })

        done(null, Number(nodeValue.value) > 0)
      })

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit
    const onCharacteristicZwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_BINARY}-1-0` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(onCharacteristicZwaveNodeValueId, value => {
      value = Boolean(value)

      // TODO: this is to ensure that this event handler is not executed as a result
      // of us updating the accessory via HomeKit. Is there a better way of doing this?
      if (onCharacteristic.value === value) {
        return
      }

      onCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "On" characteristic value updated to ${value} outside of HomeKit`)
    })

    const outletInUseZwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_METER}-1-${METER_INDEX_ELECTRIC_INSTANT_POWER}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(outletInUseZwaveNodeValueId, ({ value }) => {
      value = Number(value) > 0

      outletInUseCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "Outlet In Use" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Configure the "Humidity Sensor" service for the accessory
   */
  _configureHumiditySensorService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const humiditySensorService = this._getService(this._hapService.HumiditySensor)
    const currentRelativeHumidityCharacteristic = humiditySensorService.getCharacteristic(this._hapCharacteristic.CurrentRelativeHumidity)

    currentRelativeHumidityCharacteristic
      .on('get', done => {
        this._log(`${this._accessory.displayName} "Current Relative Humidity" characteristic value requested`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_HUMIDITY // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_HUMIDITY?
        })

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_HUMIDITY}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, value => {
      value = Number(value)

      currentRelativeHumidityCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Configure the "Light Sensor" service for the accessory
   */
  _configureLightSensorService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const lightSensorService = this._getService(this._hapService.LightSensor)
    const currentAmbientLightLevelCharacteristic = lightSensorService.getCharacteristic(this._hapCharacteristic.CurrentAmbientLightLevel)

    currentAmbientLightLevelCharacteristic
      .on('get', done => {
        this._log(`${this._accessory.displayName} "Current Ambient Light Level" characteristic value requested`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_LUMINANCE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_LUMINANCE?
        })

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_LUMINANCE}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, value => {
      value = Number(value)

      currentAmbientLightLevelCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Configure the "Motion Sensor" service for the accessory
   */
  _configureMotionSensorService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const motionSensorService = this._getService(this._hapService.MotionSensor)
    const motionDetectedCharacteristic = motionSensorService.getCharacteristic(this._hapCharacteristic.MotionDetected)

    // Setup handler for when the value for the "Motion Detected" characteristic is requested by HomeKit
    motionDetectedCharacteristic.on('get', done => {
      this._log(`${this._accessory.displayName} "Motion Detected" characteristic value requested`)

      if (this._accessoryReadyState !== READY_STATE_READY) {
        this._log(`${accessoryDisplayName} is not yet ready`)

        return done(new Error(`${accessoryDisplayName} is not yet ready`))
      }

      const zwaveNodeValue = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_ALARM, // TODO: is this always going to be COMMAND_CLASS_ALARM?
        instance: 1, // TODO: is this always going to be 1?
        index: ALARM_INDEX_HOME_SECURITY // TODO: is this always going to be ALARM_INDEX_HOME_SECURITY?
      })

      done(null, Boolean(zwaveNodeValue.value))
    })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_ALARM}-1-${ALARM_INDEX_HOME_SECURITY}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, value => {
      value = Boolean(value)

      motionDetectedCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "Motion Detected" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Configure the "Temperature Sensor" service for the accessory
   */
  _configureTemperatureSensorService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const temperatureSensorService = this._getService(this._hapService.TemperatureSensor)
    const currentTemperatureCharacteristic = temperatureSensorService.getCharacteristic(this._hapCharacteristic.CurrentTemperature)

    // Setup handler for when the value for the "Current Temperature" characteristic is requested by HomeKit
    currentTemperatureCharacteristic
      .on('get', done => {
        this._log(`${this._accessory.displayName} "Current Temperature" characteristic value requested`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SENSOR_MULTILEVEL?
          instance: 1, // TODO: is this always going to be 1?
          index: SENSOR_MULTILEVEL_INDEX_TEMPERATURE // TODO: is this always going to be SENSOR_MULTILEVEL_INDEX_TEMPERATURE?
        })

        done(null, Number(nodeValue.value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SENSOR_MULTILEVEL}-1-${SENSOR_MULTILEVEL_INDEX_TEMPERATURE}` // TODO: is this always going to be the node value id?

    this._zwave.onNodeValueChanged(zwaveNodeValueId, value => {
      value = Number(value)

      currentTemperatureCharacteristic.updateValue(value)

      this._log(`${this._accessory.displayName} "Current Temperature" characteristic value updated to ${value} outside of HomeKit`)
    })
  }

  /**
   * Get a service associated with the accessory. If the service does not exist on
   * the accessory, ensure it is created.
   *
   * @param {String} serviceType
   */
  _getService (serviceType) {
    return this._accessory.getService(serviceType) || this._accessory.addService(serviceType, this._accessory.displayName)
  }
}

module.exports = AccessoryManager
