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
  SWITCH_BINARY_INDEX_SWITCH,
  COMMAND_CLASS_SWITCH_MULTILEVEL
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
          case 'Dimmable':
            this._configureDimLightService()
            break
          case 'Color':
            this._configureColorLightService()
            break
        }
      })

    this._zwave.onNodeReady(accessoryConfig.zwaveNodeId, zwaveNode => {
    // Update the accessory information service with the latest node information
    const zwaveNodeId = accessoryConfig.zwaveNodeId

    this._zwave.onNodeReady(zwaveNodeId, zwaveNode => {
      this._accessoryReadyState = READY_STATE_READY

      const { value: serialNumber } = this._zwave.findNodeValue(zwaveNodeId, {
        class_id: COMMAND_CLASS_MANUFACTURER_SPECIFIC,
        instance: 1,
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
   * Configure the "Light" service for the accessory
   */
  _configureDimLightService () {
    const accessoryDisplayName = this._accessoryConfig.displayName
    const zwaveNodeId = this._accessoryConfig.zwaveNodeId

    const lightBulbService = this._getService(this._hapService.Lightbulb)
    const onCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.On)
    const brightnessCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Brightness)

    // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
    onCharacteristic
      .on('get', done => {
        if (this._accessoryReadyState !== READY_STATE_READY) {
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL,
          instance: 1,
          index: 0
        })

        done(null, Boolean(value))

        this._log(`${accessoryDisplayName} "On/Off" GET: ${value}`)

      })
      .on('set', (value, done) => {
        this._log(`${accessoryDisplayName} "On/Off" SET: ${value}`)
        const newValue = Boolean(value)
        const nodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_MULTILEVEL}-1-0` // TODO: is this always going to be the node value id?
        var setValue = brightnessCharacteristic.value

        if (newValue) {
          if (setValue === 0){
            setValue = 99
          }
          else if (setValue === 100) {
            setValue = 99
          }
        } else {
          setValue = 0
        }

        this._log(`${this._accessory.displayName} "On" characteristic value updating to: ${setValue}`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          const errMsg = `${accessoryDisplayName} is not yet ready`

          this._log(errMsg)

          return done(new Error(errMsg))
        }

        // note: this will trigger any event handlers listening for change events on this node value
        this._zwave.updateNodeValueById(nodeValueId, setValue)

        done(null)
      })

    brightnessCharacteristic
      .on('get', done => {
        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const { value } = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL,
          instance: 1,
          index: 0
        })


        this._log(`${accessoryDisplayName} "Brightness" GET: ${value}`)

        done(null, value)
      })
      .on('set', (value, done) => {
        var newValue = value - 1//Boolean(value)
        if (newValue < 0) {
          newValue = 0
        }
        const nodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_MULTILEVEL}-1-0` // TODO: is this always going to be the node value id?

        this._log(`${this._accessory.displayName} "Brightness" SET: ${newValue}`)

        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        // note: this will trigger any event handlers listening for change events on this node value
        this._zwave.updateNodeValueById(nodeValueId, newValue)

        done(null)

      })

      const onCharacteristicZwaveNodeValueId = this._zwave.generateNodeValueId({
        nodeId: zwaveNodeId,
        commandClass: COMMAND_CLASS_SWITCH_BINARY,
        valueIndex: 0
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
  }

  /**
   * Configure the "ColorLight" service for the accessory
   */
   _configureColorLightService () {
     const accessoryDisplayName = this._accessoryConfig.displayName
     const zwaveNodeId = this._accessoryConfig.zwaveNodeId

     const lightBulbService = this._getService(this._hapService.Lightbulb)
     const onCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.On)
     const hueCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Hue)
     const saturationCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Saturation)
     const brightnessCharacteristic = lightBulbService.getCharacteristic(this._hapCharacteristic.Brightness)


     // Setup handler for when the value for the "On" characteristic is requested / set by HomeKit
     onCharacteristic
       .on('get', done => {
         if (this._accessoryReadyState !== READY_STATE_READY) {
           this._log(`${accessoryDisplayName} is not yet ready`)

           return done(new Error(`${accessoryDisplayName} is not yet ready`))
         }

         const { value } = this._zwave.findNodeValue(zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 1, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })

         this._log(`${accessoryDisplayName} "On/Off" GET: ${value}`)

         done(null, Boolean(value))
       })
       .on('set', (value, done) => {
         this._log(`${accessoryDisplayName} "On/Off" SET: ${value}`)
         const newValue = Boolean(value)
         const nodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_MULTILEVEL}-1-0` // TODO: is this always going to be the node value id?
         var setValue = brightnessCharacteristic.value

         if (newValue) {
           if (setValue === 0){
             setValue = 99
           }
           else if (setValue === 100) {
             setValue = 99
           }
         } else {
           setValue = 0
         }

         this._log(`${this._accessory.displayName} "On" characteristic value updating to: ${setValue}`)

         if (this._accessoryReadyState !== READY_STATE_READY) {
           this._log(`${accessoryDisplayName} is not yet ready`)

           return done(new Error(`${accessoryDisplayName} is not yet ready`))
         }

         // note: this will trigger any event handlers listening for change events on this node value
         this._zwave.updateNodeValueById(nodeValueId, setValue)

         done(null)
       })

     brightnessCharacteristic
       .on('get', done => {
         if (this._accessoryReadyState !== READY_STATE_READY) {
           this._log(`${accessoryDisplayName} is not yet ready`)

           return done(new Error(`${accessoryDisplayName} is not yet ready`))
         }
         const { value } = this._zwave.findNodeValue(zwaveNodeId, {
           class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
           instance: 1, // TODO: is this always going to be 1?
           index: 0 // TODO: is this always going to be 0?
         })

         this._log(`${accessoryDisplayName} "Brightness" GET: ${value}`)

        done(null, Boolean(value))
       })
       .on('set', (value, done) => {
         var newValue = value - 1//Boolean(value)
         if (newValue < 0) {
           newValue = 0
         }
         const nodeValueId = `${zwaveNodeId}-${COMMAND_CLASS_SWITCH_MULTILEVEL}-1-0` // TODO: is this always going to be the node value id?

         this._log(`${this._accessory.displayName} "Brightness" SET: ${newValue}`)

         if (this._accessoryReadyState !== READY_STATE_READY) {
           this._log(`${accessoryDisplayName} is not yet ready`)

           return done(new Error(`${accessoryDisplayName} is not yet ready`))
         }

         // note: this will trigger any event handlers listening for change events on this node value
         this._zwave.updateNodeValueById(nodeValueId, newValue)

         done(null)

       })

    hueCharacteristic
      .on('get', done => {
        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const rValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 3, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const gValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 4, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const bValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 5, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const wValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 6, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

         this._log(`${accessoryDisplayName} "Hue" GET: Red: ${rValue.value} Green: ${gValue.value} Blue: ${bValue.value} White: ${wValue.value}`)

        let hsl = convertToHSL(rValue.value, gValue.value, bValue.value);

        done(null, hsl.h)
      })
      .on('set', (value, done) => {
        this._log(`${accessoryDisplayName} "Hue" SET: ${value}`)
        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)

          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const nodeValueId = `${zwaveNodeId}-${51}-1-0`
        const brightness = brightnessCharacteristic.value
        const saturation = saturationCharacteristic.value
        const hue = value

        var rgb = HSVtoRGB(hue,saturation,brightness)

        var colorValue = RGBWtoHex(rgb.r,rgb.g,rgb.b,rgb.w)
        const newValue = colorValue

        this._zwave.updateNodeValueById(nodeValueId, newValue)

        done(null)
      })

    saturationCharacteristic
      .on('get', done => {
        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)
          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }

        const rValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 3, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const gValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 4, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const bValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 5, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        const wValue = this._zwave.findNodeValue(zwaveNodeId, {
          class_id: COMMAND_CLASS_SWITCH_MULTILEVEL, // TODO: is this always going to be COMMAND_CLASS_SWITCH_BINARY?
          instance: 6, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })
        this._log(`${accessoryDisplayName} "Saturation" GET: Red: ${rValue.value} Green: ${gValue.value} Blue: ${bValue.value} White: ${wValue.value}`)

        let hsl = convertToHSL(rValue.value, gValue.value, bValue.value);

        done(null, hsl.s)

      })
      .on('set', (value, done) => {
        this._log(`${accessoryDisplayName} "Saturation" SET: ${value}`)
        if (this._accessoryReadyState !== READY_STATE_READY) {
          this._log(`${accessoryDisplayName} is not yet ready`)
          return done(new Error(`${accessoryDisplayName} is not yet ready`))
        }
        const nodeValueId = `${zwaveNodeId}-${51}-1-0`

        const brightness = brightnessCharacteristic.value
        const saturation = value
        const hue = hueCharacteristic.value

        var rgb = HSVtoRGB(hue,saturation,brightness)

        var colorValue = RGBWtoHex(rgb.r,rgb.g,rgb.b,rgb.w)
        const newValue = colorValue

        this._zwave.updateNodeValueById(nodeValueId, newValue)

        done(null)
      })

    }//colorLight


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
          instance: 1,
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
          instance: 1,
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
          instance: 1,
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
          instance: 1,
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
        instance: 1,
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
          instance: 1,
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

  return {
      h: h, /// 360,
      s: s,
      l: l
  };
}

module.exports = AccessoryManager
