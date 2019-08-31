const {
  ALARM_INDEX_HOME_SECURITY,
  COMMAND_CLASS_ALARM,
  COMMAND_CLASS_MANUFACTURER_SPECIFIC,
  COMMAND_CLASS_METER,
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  COMMAND_CLASS_SWITCH_BINARY,
  MANUFACTURER_SPECIFIC_INDEX_SERIAL_NUMBER,
  METER_INDEX_ELECTRIC_INSTANT_POWER,
  SENSOR_MULTILEVEL_INDEX_HUMIDITY,
  SENSOR_MULTILEVEL_INDEX_LUMINANCE,
  SENSOR_MULTILEVEL_INDEX_TEMPERATURE,
  SWITCH_BINARY_INDEX_SWITCH
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

    // Update the accessory information service with the latest node information
    const zwaveNodeId = accessoryConfig.zwaveNodeId

    this._zwave.onNodeReady(zwaveNodeId, zwaveNode => {
      this._accessoryReadyState = READY_STATE_READY

      const { value: serialNumber } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_MANUFACTURER_SPECIFIC,
        index: MANUFACTURER_SPECIFIC_INDEX_SERIAL_NUMBER
      })

      this._configureAccessoryInformationService(
        zwaveNode.manufacturer,
        zwaveNode.product,
        serialNumber
      )
    })
  }

  /**
   * Configure the "Accessory Information" service for the accessory
   *
   * @param {string} manufacturer
   * @param {string} model
   * @param {string} serialNumber
   */
  _configureAccessoryInformationService (
    manufacturer = 'Unknown',
    model = 'Unknown',
    serialNumber = 'Unknown'
  ) {
    this._getService(this._hapService.AccessoryInformation)
      .updateCharacteristic(this._hapCharacteristic.Manufacturer, manufacturer)
      .updateCharacteristic(this._hapCharacteristic.Model, model)
      .updateCharacteristic(this._hapCharacteristic.SerialNumber, serialNumber)
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
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_BINARY,
          index: SWITCH_BINARY_INDEX_SWITCH
        })

        done(null, Boolean(value))
      })
      .on('set', (value, done) => {
        const newValue = Boolean(value)
        const nodeValueId = this._zwave.generateNodeValueId({
          nodeId: zwaveNodeId,
          commandClass: COMMAND_CLASS_SWITCH_BINARY,
          valueIndex: SWITCH_BINARY_INDEX_SWITCH
        })

        this._log(`${this._accessory.displayName} "On" characteristic value updating to: ${newValue}`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
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
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_METER,
          index: METER_INDEX_ELECTRIC_INSTANT_POWER
        })

        done(null, Number(value) > 0)
      })

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit
    const onCharacteristicZwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_SWITCH_BINARY,
      valueIndex: SWITCH_BINARY_INDEX_SWITCH
    })

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

    const outletInUseZwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_METER,
      valueIndex: METER_INDEX_ELECTRIC_INSTANT_POWER
    })

    this._zwave.onNodeValueChanged(outletInUseZwaveNodeValueId, value => {
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
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
          index: SENSOR_MULTILEVEL_INDEX_HUMIDITY
        })

        done(null, Number(value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_HUMIDITY
    })

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
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
          index: SENSOR_MULTILEVEL_INDEX_LUMINANCE
        })

        done(null, Number(value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_LUMINANCE
    })

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
        let errMsg = `${accessoryDisplayName} is not yet ready`

        this._log(errMsg)

        return done(new Error(errMsg))
      }

      const { value } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_ALARM,
        index: ALARM_INDEX_HOME_SECURITY
      })

      // TODO: I'm not convinced this is the best way to do this 🤔
      let motionDetected = false

      if (value.includes('Motion Detected')) {
        motionDetected = true
      }

      done(null, motionDetected)
    })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_ALARM,
      valueIndex: ALARM_INDEX_HOME_SECURITY
    })

    this._zwave.onNodeValueChanged(zwaveNodeValueId, value => {
      // TODO: I'm not convinced this is the best way to do this 🤔
      let motionDetected = false

      if (value.includes('Motion Detected')) {
        motionDetected = true
      }

      motionDetectedCharacteristic.updateValue(motionDetected)

      this._log(`${this._accessory.displayName} "Motion Detected" characteristic value updated to ${motionDetected} outside of HomeKit`)
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
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SENSOR_MULTILEVEL,
          index: SENSOR_MULTILEVEL_INDEX_TEMPERATURE
        })

        done(null, Number(value))
      })

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    const zwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_TEMPERATURE
    })

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
   * @param   {string} serviceType
   * @returns {Object}
   */
  _getService (serviceType) {
    return this._accessory.getService(serviceType) || this._accessory.addService(serviceType, this._accessory.displayName)
  }
}

module.exports = AccessoryManager
