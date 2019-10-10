const {
  COMMAND_CLASS_ALARM,
  COMMAND_CLASS_BATTERY,
  COMMAND_CLASS_CONFIGURATION,
  COMMAND_CLASS_MANUFACTURER_SPECIFIC,
  COMMAND_CLASS_METER,
  COMMAND_CLASS_SENSOR_MULTILEVEL,
  COMMAND_CLASS_SWITCH_BINARY,
  COMMAND_CLASS_SWITCH_MULTILEVEL,

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
          case 'Dimmable':
            this._configureDimLightService()
            break
          case 'Color':
            this._configureColorLightService()
            break
        }
      })

    // Update the accessory information service with the latest ZWave node information
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
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const service = this._getService(this._hapService.MotionSensor)
    const motionDetectedCharacteristic = service.getCharacteristic(this._hapCharacteristic.MotionDetected)
    const statusTamperedCharacteristic = service.getCharacteristic(this._hapCharacteristic.StatusTampered)
    const zwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_ALARM,
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
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

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
        index: BATTERY_INDEX_LEVEL
      })

      const { value: currentPowerMode } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        index: CONFIGURATION_INDEX_CURRENT_POWER_MODE
      })

      const { value: minBatteryLevel } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
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
      valueIndex: BATTERY_INDEX_LEVEL
    })

    this._zwave.onNodeValueChanged(batteryLevelCharacteristicZwaveNodeValueId, value => {
      value = Number(value)

      batteryLevelCharacteristic.updateValue(value)

      this._log(`${accessoryDisplayName} "Battery Level" characteristic value updated to ${value} outside of HomeKit`)

      // Check if we need to update the "Status Low Battery" characteristic
      const { value: currentPowerMode } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
        index: CONFIGURATION_INDEX_CURRENT_POWER_MODE
      })

      const { value: minBatteryLevel } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_CONFIGURATION,
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
   * Configure the "Light" service for the accessory
   */
  _configureDimLightService () {
    const lightBulbService = this._getService(this._hapService.Lightbulb)
    const onCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.On)
    const brightnessCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Brightness)

    // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
    const onCharacteristicName = 'On'
    const onCharacteristicZwaveNodeValueCriteria = {
      commandClass: COMMAND_CLASS_SWITCH_MULTILEVEL,
      valueIndex: SWITCH_BINARY_INDEX_SWITCH
    }

     const onCharacteristicValueSet = value => {
       var setValue = brightnessCharacteristic.value
       if (value) {
         if (setValue === 1){
           setValue = 99
         }
         else if (setValue === 100) {
           setValue = 99
         }
       } else {
         setValue = 0
       }
       return setValue
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
        onCharacteristicValueSet
      ))

      // Setup handler for when the value for the "Bightness" characteristic is requested by HomeKit
      const brightnessCharacteristicName = 'Bightness'
      const brightnessCharacteristicZwaveNodeValueCriteria = {
        commandClass: COMMAND_CLASS_SWITCH_MULTILEVEL,
        valueIndex: SWITCH_BINARY_INDEX_SWITCH
      }

      brightnessCharacteristic
        .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
          brightnessCharacteristicName,
          this._makeZwaveNodeValueResolver(onCharacteristicZwaveNodeValueCriteria),
          Number
        ))
        .on('set', this._makeCharacteristicSetterForZwaveNodeValue(
          brightnessCharacteristicName,
          brightnessCharacteristicZwaveNodeValueCriteria,
          Number
        ))
  }
  /**
   * Configure the "ColorLight" service for the accessory
   */
   _configureColorLightService () {
     const lightBulbService = this._getService(this._hapService.Lightbulb)
     const onCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.On)
     const hueCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Hue)
     const saturationCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Saturation)
     const brightnessCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Brightness)

     // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
     const onCharacteristicName = 'On'
     const onCharacteristicZwaveNodeValueCriteria = {
       commandClass: COMMAND_CLASS_SWITCH_MULTILEVEL,
       valueIndex: SWITCH_BINARY_INDEX_SWITCH
     }

     const onCharacteristicValueSet = value => {
       var setValue = brightnessCharacteristic.value
       if (value) {
         if (setValue === 1){
           setValue = 99
         }
         else if (setValue === 100) {
           setValue = 99
         }
       } else {
         setValue = 0
       }
       return setValue
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
         onCharacteristicValueSet
       ))

       const hslValue = value => {
         const rValue = this._zwave.findNodeValue(this._accessoryConfig.zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 3, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })
         const gValue = this._zwave.findNodeValue(this._accessoryConfig.zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 4, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })
         const bValue = this._zwave.findNodeValue(this._accessoryConfig.zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 5, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })
         const wValue = this._zwave.findNodeValue(this._accessoryConfig.zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 6, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })
         let hsl = convertToHSL(rValue.value, gValue.value, bValue.value);

         return hsl
       }

       const hueCharacteristicValueSet = value => {
         const brightness = brightnessCharacteristic.value
         const saturation = saturationCharacteristic.value
         const hue = value
         //this._log(`Brightness: ${brightness} Hue: ${hue} Saturation: ${saturation}`)
         const rgb = HSVtoRGB(hue,saturation,brightness)
         //this._log(`Red: ${rgb.r} Green: ${rgb.g} Blue: ${rgb.b} White: ${rgb.w} `)
         const colorValue = RGBWtoHex(rgb.r,rgb.g,rgb.b,rgb.w)
         return colorValue
       }

       const hueCharacteristicName = 'Hue'
       const hueCharacteristicZwaveNodeValueCriteria = {
         commandClass: COMMAND_CLASS_SWITCH_MULTILEVEL,
         valueIndex: SWITCH_BINARY_INDEX_SWITCH
       }
       const colorCharacteristicZwaveNodeValueCriteria = {
         commandClass: 51,
         valueIndex: SWITCH_BINARY_INDEX_SWITCH
       }
       hueCharacteristic
       .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
         hueCharacteristicName,
         this._makeZwaveNodeValueResolver(hueCharacteristicZwaveNodeValueCriteria),
         hslValue.h
       ))
       .on('set', this._makeCharacteristicSetterForZwaveNodeValue(
         hueCharacteristicName,
         colorCharacteristicZwaveNodeValueCriteria,
         hueCharacteristicValueSet
       ))

       const saturationCharacteristicValueSet = value => {
         const brightness = brightnessCharacteristic.value
         const saturation = value
         const hue = hueCharacteristic.value
         //this._log(`Brightness: ${brightness} Hue: ${hue} Saturation: ${saturation}`)
         const rgb = HSVtoRGB(hue,saturation,brightness)
         //this._log(`Red: ${rgb.r} Green: ${rgb.g} Blue: ${rgb.b} White: ${rgb.w} `)
         const colorValue = RGBWtoHex(rgb.r,rgb.g,rgb.b,rgb.w)
         return colorValue
       }

       const saturationCharacteristicName = 'Saturation'
       const saturationCharacteristicZwaveNodeValueCriteria = {
         commandClass: COMMAND_CLASS_SWITCH_MULTILEVEL,
         valueIndex: SWITCH_BINARY_INDEX_SWITCH
       }
       saturationCharacteristic
       .on('get', this._makeCharacteristicGetterForZwaveNodeValue(
         saturationCharacteristicName,
         this._makeZwaveNodeValueResolver(saturationCharacteristicZwaveNodeValueCriteria),
         hslValue.s
       ))
       .on('set', this._makeCharacteristicSetterForZwaveNodeValue(
         saturationCharacteristicName,
         colorCharacteristicZwaveNodeValueCriteria,
         saturationCharacteristicValueSet
       ))
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
   * @param   {{commandClass: number, valueIndex: number}} zwaveNodeValueCriteria
   * @returns {Function}
   */
  _makeZwaveNodeValueResolver ({ commandClass, valueIndex }) {
    return () => {
      const zwaveNodeId = this._accessoryConfig.zwaveNodeId

      const { value } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: commandClass,
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
      const zwaveNodeId = this._accessoryConfig.zwaveNodeId
      const newValue = valueFilter(value)
      const nodeValueId = this._zwave.generateNodeValueId({
        nodeId: zwaveNodeId,
        commandClass,
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
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId
    const nodeValueId = this._zwave.generateNodeValueId({
      nodeId: zwaveNodeId,
      commandClass,
      valueIndex
    })

    this._zwave.onNodeValueChanged(nodeValueId, value => {
      value = valueFilter(value)

      characteristic.updateValue(value)

      this._log(`${accessoryDisplayName} "${characteristicName}" characteristic value updated to ${value} outside of HomeKit`)
    })
  }
}

function HSVtoRGB(hue, saturation, value) {
  if (hue == null || saturation == null || value == null) {
    return {
        r: null,
        g: null,
        b: null,
        w: null
    };
  }
    let h = hue / 360.0;
    let s = saturation / 100.0;
    let v = value / 100.0;
    let r, g, b, w, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }
    w = Math.min(r, g, b);
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
        w: Math.round(w * 255)
    };
}

function RGBWtoHex(r,g,b,w){
  //console.log("Converting to Hex");

  if (r == null || g == null || b == null || w == null){
    return null;
  }

  hexR = r.toString(16).toUpperCase();
  hexG = g.toString(16).toUpperCase();
  hexB = b.toString(16).toUpperCase();
  hexW = w.toString(16).toUpperCase();

  padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;
  while (hexR.length < padding) {
    hexR = "0" + hexR;
  }
  while (hexG.length < padding) {
    hexG = "0" + hexG;
  }
  while (hexB.length < padding) {
    hexB = "0" + hexB;
  }
  while (hexW.length < padding) {
    hexW = "0" + hexW;
  }

  //hexW = "0000"
  //hexValue = "#"+hexR+hexG+hexB + hexW;
  hexValue = "#"+hexR+hexG+hexB+hexW

  return(hexValue);

}
function convertToHSL(rV,gV,bV){
 // console.log("Converting RGB to HSL....");
  var h,s,l;
  var r = rV/255;
  var g = gV/255;
  var b = bV/255;

  var max = Math.max(r,g,b);
  var min = Math.min(r,g,b);

  var l = (max + min)/2

  if (max == min) {
    h = 0;
    s = 0;
  }
  else {
    var d = max - min;
    if ( l > 0.5) {
      s = d / (2 - max - min);
    }
    else {
      s = d / (max + min);
    }

    if (max == r) {
      h = (g-b)/d;
      if (g < b) {
        h = h + 6
      }
    }
    else if (max == g) {
      h = (b - r)/d + 2
    }
    else if (max == b) {
      h = (r - g)/d + 4
    }
  //  h = h/6;
  }

  h = h * 60
  if (h < 0) {
    h = h + 360
  }

  h = Math.round(h);
  s = Math.round(s*100);
  l = Math.round(l*100);
  console.log(h)
  console.log(s)
  console.log(l)

  return {
      h: h, /// 360,
      s: s,
      l: l
  };
}

module.exports = AccessoryManager
