const {
  COMMAND_CLASS_ALARM,
  COMMAND_CLASS_BATTERY,
  COMMAND_CLASS_CONFIGURATION,
  COMMAND_CLASS_MANUFACTURER_SPECIFIC,
  COMMAND_CLASS_METER,
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  COMMAND_CLASS_SWITCH_BINARY,

  ALARM_INDEX_HOME_SECURITY,
  BATTERY_INDEX_LEVEL,

  CONFIGURATION_INDEX_CURRENT_POWER_MODE,
  CONFIGURATION_INDEX_LOW_BATTERY,

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
          case 'Battery':
            this._configureBatteryService()
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
          case 'Switch':
            this._configureSwitchService()
            break
          case 'TemperatureSensor':
            this._configureTemperatureSensorService()
            break
        }
      })

    // Update the accessory information service with the latest ZWave node information
    const { zwaveNodeId, zwaveNodeInstance } = accessoryConfig

    this._zwave.onNodeReady(zwaveNodeId, zwaveNode => {
      this._accessoryReadyState = READY_STATE_READY

      const { value: serialNumber } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_MANUFACTURER_SPECIFIC,
        instance: zwaveNodeInstance,
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
    const outletService = this._getService(this._hapService.Outlet)
    const onCharacteristic = outletService.getCharacteristic(this._hapCharacteristic.On)
    const outletInUseCharacteristic = outletService.getCharacteristic(this._hapCharacteristic.OutletInUse)

    // Setup handlers for when the value for the "On" characteristic is requested / updated by HomeKit
    const onCharacteristicName = 'On'
    const onCharacteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SWITCH_BINARY,
      valueIndex: SWITCH_BINARY_INDEX_SWITCH
    }

    onCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        onCharacteristicName,
        this._makeZwaveNodeValueResolver(onCharacteristicZwaveNodeValueCriteria),
        Boolean
      ))
      .on('set', this._makeCharacteristicSetterForZwaveNodeValue(
        onCharacteristicName,
        onCharacteristicZwaveNodeValueCriteria,
        Boolean
      ))

    // Setup handler for when the value for the "Outlet In Use" characteristic is requested by HomeKit
    const outletInUseCharacteristicName = 'Outlet In Use'
    const outletInUseCharacteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_METER,
      valueIndex: METER_INDEX_ELECTRIC_INSTANT_POWER
    }
    const outletInUseCharacteristicValueFilter = value => Number(value) > 0

    outletInUseCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        outletInUseCharacteristicName,
        this._makeZwaveNodeValueResolver(outletInUseCharacteristicZwaveNodeValueCriteria),
        outletInUseCharacteristicValueFilter
      ))

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit
    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      onCharacteristic,
      onCharacteristicName,
      onCharacteristicZwaveNodeValueCriteria,
      Boolean
    )

    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      outletInUseCharacteristic,
      outletInUseCharacteristicName,
      outletInUseCharacteristicZwaveNodeValueCriteria,
      outletInUseCharacteristicValueFilter
    )
  }

  /**
   * Configure the "Humidity Sensor" service for the accessory
   */
  _configureHumiditySensorService () {
    const service = this._getService(this._hapService.HumiditySensor)
    const characteristic = service.getCharacteristic(this._hapCharacteristic.CurrentRelativeHumidity)

    // Setup handler for when the value for the "Current Relative Humidity" characteristic is requested by HomeKit
    const characteristicName = 'Current Relative Humidity'
    const zwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_HUMIDITY
    }

    characteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        characteristicName,
        this._makeZwaveNodeValueResolver(zwaveNodeValueCriteria),
        Number
      ))

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      characteristic,
      characteristicName,
      zwaveNodeValueCriteria,
      Number
    )
  }

  /**
   * Configure the "Light Sensor" service for the accessory
   */
  _configureLightSensorService () {
    const service = this._getService(this._hapService.LightSensor)
    const characteristic = service.getCharacteristic(this._hapCharacteristic.CurrentAmbientLightLevel)

    // Setup handler for when the value for the "Current Ambient Light Level" characteristic is requested by HomeKit
    const characteristicName = 'Current Ambient Light Level'
    const zwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_LUMINANCE
    }

    characteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        characteristicName,
        this._makeZwaveNodeValueResolver(zwaveNodeValueCriteria),
        Number
      ))

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      characteristic,
      characteristicName,
      zwaveNodeValueCriteria,
      Number
    )
  }

  /**
   * Configure the "Motion Sensor" service for the accessory
   */
  _configureMotionSensorService () {
    const accessoryDisplayName = this._accessory.displayName
    const { zwaveNodeId, zwaveNodeInstance } = this._accessoryConfig

    const service = this._getService(this._hapService.MotionSensor)
    const motionDetectedCharacteristic = service.getCharacteristic(this._hapCharacteristic.MotionDetected)
    const statusTamperedCharacteristic = service.getCharacteristic(this._hapCharacteristic.StatusTampered)
    const zwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_ALARM,
      valueInstance: zwaveNodeInstance,
      valueIndex: ALARM_INDEX_HOME_SECURITY
    }
    const zwaveNodeValueResolver = this._makeZwaveNodeValueResolver(zwaveNodeValueCriteria)

    // Setup handler for when the value for the "Motion Detected" characteristic is requested by HomeKit
    const motionDetectedCharacteristicName = 'Motion Detected'
    const motionDetectedValueFilter = value => value.includes('Motion Detected')

    motionDetectedCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        motionDetectedCharacteristicName,
        zwaveNodeValueResolver,
        motionDetectedValueFilter
      ))

    // Setup handler for when the value for the "Status Tampered" characteristic is requested by HomeKit
    const statusTamperedCharacteristicName = 'Status Tampered'
    const statusTamperedValueFilter = value => value.includes('Tampering') ? 1 : 0

    statusTamperedCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        statusTamperedCharacteristicName,
        zwaveNodeValueResolver,
        statusTamperedValueFilter
      ))

    // Setup handlers for when the corresponding ZWave node value is updated outside of HomeKit

    // Instead of using _updateCharacteristicValueOnZwaveNodeValueUpdated to update the "Motion Detected"
    // and "Status Tampered" characteristic, we manually bind a handler as both characteristics use the
    // same ZWave node value
    const homeSecurityZwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      ...zwaveNodeValueCriteria
    })

    this._zwave.onNodeValueChanged(homeSecurityZwaveNodeValueId, value => {
      const motionDetected = motionDetectedValueFilter(value)
      const statusTampered = statusTamperedValueFilter(value)

      if (motionDetectedCharacteristic.value !== motionDetected) {
        motionDetectedCharacteristic.updateValue(motionDetected)

        this._log(`${accessoryDisplayName} "${motionDetectedCharacteristicName}" characteristic value updated to ${motionDetected} outside of HomeKit`)
      }

      if (statusTamperedCharacteristic.value !== statusTampered) {
        statusTamperedCharacteristic.updateValue(statusTampered)

        this._log(`${accessoryDisplayName} "${statusTamperedCharacteristicName}" characteristic value updated to ${statusTampered} outside of HomeKit`)
      }
    })
  }

  /**
   * Configure the "Temperature Sensor" service for the accessory
   */
  _configureTemperatureSensorService () {
    const service = this._getService(this._hapService.TemperatureSensor)
    const characteristic = service.getCharacteristic(this._hapCharacteristic.CurrentTemperature)

    // Setup handler for when the value for the "Current Temperature" characteristic is requested by HomeKit
    const characteristicName = 'Current Temperature'
    const zwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SENSOR_MULTILEVEL,
      valueIndex: SENSOR_MULTILEVEL_INDEX_TEMPERATURE
    }

    characteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        characteristicName,
        this._makeZwaveNodeValueResolver(zwaveNodeValueCriteria),
        Number
      ))

    // Setup handler for when the corresponding ZWave node value is updated outside of HomeKit
    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      characteristic,
      characteristicName,
      zwaveNodeValueCriteria,
      Number
    )
  }

  /**
   * Configure the "Battery" service for the accessory
   */
  _configureBatteryService () {
    const accessoryDisplayName = this._accessory.displayName
    const { zwaveNodeId, zwaveNodeInstance } = this._accessoryConfig

    const batteryService = this._getService(this._hapService.BatteryService)
    const batteryLevelCharacteristic = batteryService.getCharacteristic(this._hapCharacteristic.BatteryLevel)
    const chargingStateCharacteristic = batteryService.getCharacteristic(this._hapCharacteristic.ChargingState)
    const statusLowBatteryCharacteristic = batteryService.getCharacteristic(this._hapCharacteristic.StatusLowBattery)

    // Setup handler for when the value for the "Battery Level" characteristic is requested by HomeKit
    const batteryLevelCharacteristicName = 'Battery Level'
    const batteryLevelCharacteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_BATTERY,
      valueIndex: BATTERY_INDEX_LEVEL
    }

    batteryLevelCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        batteryLevelCharacteristicName,
        this._makeZwaveNodeValueResolver(batteryLevelCharacteristicZwaveNodeValueCriteria),
        Number
      ))

    // Setup handler for when the value for the "Charging State" characteristic is requested by HomeKit
    const chargingStateCharacteristicName = 'Charging State'
    const chargingStateCharacteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_CONFIGURATION,
      valueIndex: CONFIGURATION_INDEX_CURRENT_POWER_MODE
    }
    const chargingStateCharacteristicValueFilter = value => value.includes('Battery power') ? 0 : 1

    chargingStateCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        chargingStateCharacteristicName,
        this._makeZwaveNodeValueResolver(chargingStateCharacteristicZwaveNodeValueCriteria),
        chargingStateCharacteristicValueFilter
      ))

    // Setup handler for when the value for the "Status Low Battery" characteristic is requested by HomeKit
    const statusLowBatteryCharacteristicName = 'Status Low Battery'
    const statusLowBatteryCharacteristicZwaveNodeValueResolver = () => {
      const { value: batteryLevel } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_BATTERY,
        instance: zwaveNodeInstance,
        index: BATTERY_INDEX_LEVEL
      })

      const { value: currentPowerMode } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        instance: zwaveNodeInstance,
        index: CONFIGURATION_INDEX_CURRENT_POWER_MODE
      })

      const { value: minBatteryLevel } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        instance: zwaveNodeInstance,
        index: CONFIGURATION_INDEX_LOW_BATTERY
      })

      const isCharging = Boolean(chargingStateCharacteristicValueFilter(currentPowerMode))
      const lowBattery = !isCharging && (Number(batteryLevel) < Number(minBatteryLevel))

      return lowBattery ? 1 : 0
    }

    statusLowBatteryCharacteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        statusLowBatteryCharacteristicName,
        statusLowBatteryCharacteristicZwaveNodeValueResolver
      ))

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit

    // Instead of using _updateCharacteristicValueOnZwaveNodeValueUpdated to update the "Battery Level"
    // characteristic, we manually bind a handler so that we can also update the "Status Low Battery"
    // characteristic at the the same time
    const batteryLevelCharacteristicZwaveNodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass: COMMAND_CLASS_BATTERY,
      valueInstance: zwaveNodeInstance,
      valueIndex: BATTERY_INDEX_LEVEL
    })

    this._zwave.onNodeValueChanged(batteryLevelCharacteristicZwaveNodeValueId, value => {
      value = Number(value)

      batteryLevelCharacteristic.updateValue(value)

      this._log(`${accessoryDisplayName} "Battery Level" characteristic value updated to ${value} outside of HomeKit`)

      // Check if we need to update the "Status Low Battery" characteristic
      const { value: currentPowerMode } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        instance: zwaveNodeInstance,
        index: CONFIGURATION_INDEX_CURRENT_POWER_MODE
      })

      const { value: minBatteryLevel } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        instance: zwaveNodeInstance,
        index: CONFIGURATION_INDEX_LOW_BATTERY
      })

      const isCharging = Boolean(chargingStateCharacteristicValueFilter(currentPowerMode))
      const lowBattery = (
        !isCharging && (value < Number(minBatteryLevel))
      ) ? 1 : 0

      // Only update the characteristic if the computed value is different
      if (statusLowBatteryCharacteristic.value !== lowBattery) {
        statusLowBatteryCharacteristic.updateValue(lowBattery)

        this._log(`${accessoryDisplayName} "Status Low Battery" characteristic value updated to ${lowBattery} outside of HomeKit`)
      }
    })

    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      chargingStateCharacteristic,
      chargingStateCharacteristicName,
      chargingStateCharacteristicZwaveNodeValueCriteria,
      chargingStateCharacteristicValueFilter
    )
  }

  /**
   * Configure the "Switch" service for the accessory
   */
  _configureSwitchService () {
    const service = this._getService(this._hapService.Switch)
    const characteristic = service.getCharacteristic(this._hapCharacteristic.On)

    // Setup handlers for when the value for the "On" characteristic is requested / updated by HomeKit
    const characteristicName = 'On'
    const characteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SWITCH_BINARY,
      valueIndex: SWITCH_BINARY_INDEX_SWITCH
    }

    characteristic
      .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
        characteristicName,
        this._makeZwaveNodeValueResolver(characteristicZwaveNodeValueCriteria),
        Boolean
      ))
      .on('set', this._makeCharacteristicSetterForZwaveNodeValue(
        characteristicName,
        characteristicZwaveNodeValueCriteria,
        Boolean
      ))

    // Setup handlers for when the corresponding ZWave node values are updated outside of HomeKit
    this._updateCharacteristicValueOnZwaveNodeValueUpdated(
      characteristic,
      characteristicName,
      characteristicZwaveNodeValueCriteria,
      Boolean
    )
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

  /**
   * Create a characteristic getter for a zwave node value
   *
   * @param   {string} characteristicName
   * @param   {Function} zwaveNodeValueResolver
   * @param   {Function} valueFilter
   * @returns {Function}
   */
  _makeCharacteristicGetterForZwaveNodeValue (
    characteristicName,
    zwaveNodeValueResolver,
    valueFilter = v => v
  ) {
    return done => {
      const accessoryDisplayName = this._accessoryConfig.displayName

      this._log(`${accessoryDisplayName} "${characteristicName}" characteristic value requested`)

      if (this._accessoryReadyState === READY_STATE_UNREADY) {
        const errMsg = `${accessoryDisplayName} is not yet ready`

        this._log(errMsg)

        return done(new Error(errMsg))
      }

      const value = zwaveNodeValueResolver()

      done(null, valueFilter(value))
    }
  }

  /**
   * Create a ZWave node value resolver
   *
   * @param   {{commandClass: number, valueInstance: number, valueIndex: number}} zwaveNodeValueCriteria
   * @returns {Function}
   */
  _makeZwaveNodeValueResolver ({ commandClass, valueInstance, valueIndex }) {
    return () => {
      const { zwaveNodeId, zwaveNodeInstance } = this._accessoryConfig

      const { value } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: commandClass,
        instance: valueInstance || zwaveNodeInstance,
        index: valueIndex
      })

      return value
    }
  }

  /**
   * Create a characteristic setter for a zwave node value
   *
   * @param   {string} characteristicName
   * @param   {{commandClass: number, valueIndex: number}} zwaveNodeValueCriteria
   * @param   {Function} valueFilter
   * @returns {Function}
   */
  _makeCharacteristicSetterForZwaveNodeValue (
    characteristicName,
    { commandClass, valueIndex },
    valueFilter = v => v
  ) {
    return (value, done) => {
      const accessoryDisplayName = this._accessoryConfig.displayName
      const { zwaveNodeId, zwaveNodeInstance } = this._accessoryConfig
      const newValue = valueFilter(value)
      const nodeValueId = this._zwave.generateNodeValueId({
        nodeId: zwaveNodeId,
        commandClass,
        valueInstance: zwaveNodeInstance,
        valueIndex
      })

      this._log(`${accessoryDisplayName} "${characteristicName}" value updating to: ${newValue}`)

      if (this._accessoryReadyState === READY_STATE_UNREADY) {
        const errMsg = `${accessoryDisplayName} is not yet ready`

        this._log(errMsg)

        return done(new Error(errMsg))
      }

      this._zwave.updateNodeValueById(nodeValueId, newValue)

      done(null)
    }
  }

  /**
   * Update a characteristic when a zwave node value gets updated
   *
   * @param {{commandClass: number, valueIndex: number}} zwaveNodeValueCriteria
   * @param {Object} characteristic
   * @param {string} characteristicName
   * @param {Function} valueFilter
   */
  _updateCharacteristicValueOnZwaveNodeValueUpdated (
    characteristic,
    characteristicName,
    { commandClass, valueIndex },
    valueFilter = v => v
  ) {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const { zwaveNodeId, zwaveNodeInstance } = this._accessoryConfig
    const nodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass,
      valueInstance: zwaveNodeInstance,
      valueIndex
    })

    this._zwave.onNodeValueChanged(nodeValueId, value => {
      value = valueFilter(value)

      characteristic.updateValue(value)

      this._log(`${accessoryDisplayName} "${characteristicName}" characteristic value updated to ${value} outside of HomeKit`)
    })
  }
}

module.exports = AccessoryManager
