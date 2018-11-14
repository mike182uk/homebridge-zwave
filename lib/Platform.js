const OpenZWave = require('openzwave-shared')

// http://wiki.micasaverde.com/index.php/ZWave_Command_Classes
const ZWAVE_COMMAND_CLASS_SWITCH_BINARY = 37

module.exports = (pluginName, platformName, homebridge) => {
  const Characteristic = homebridge.hap.Characteristic
  const PlatformAccessory = homebridge.platformAccessory
  const Service = homebridge.hap.Service
  const UUID = homebridge.hap.uuid.generate

  /**
   * ZWavePlatform constructor
   *
   * @param {Object} log
   * @param {Object} config
   * @param {Object} api
   */
  function ZWavePlatform (log, config, api) {
    this._log = log
    this._config = config
    this._api = api

    this._ozw = undefined
    this._zwaveNodes = new Map()
    this._zwaveLog = (message) => {
      this._log.debug(`[zwave] ${message}`)
    }

    this._cachedAccessories = new Map()

    this._api.on('didFinishLaunching', this._initPlatform.bind(this))
  }

  /**
   * Configure a cached accessory
   *
   * @param {PlatformAccessory} accessory
   */
  ZWavePlatform.prototype.configureAccessory = function (accessory) {
    this._cachedAccessories.set(accessory.UUID, accessory)
  }

  /**
   * Initialize the platform
   */
  ZWavePlatform.prototype._initPlatform = function () {
    if (!this._config.accessories || this._config.accessories.length < 1) {
      this._log.error('There are no accessories defined in the config')

      return
    }

    if (!this._config.zwave.devicePath) {
      this._log.error('The ZWave device path has not been set')

      return
    }

    this._log.info('Initializing ZWave network...')

    this._initZWave(this._initAccessories.bind(this))
  }

  /**
   * Initialize the platform accessories
   *
   * @param {Error} zwaveErr
   */
  ZWavePlatform.prototype._initAccessories = function (zwaveErr) {
    if (zwaveErr) {
      this._log.error(`ZWave network was not initialized due to: ${zwaveErr.message}`)

      return
    }

    this._log.info('Initializing accessories...')

    this._config.accessories.forEach((accessoryConfig, idx) => {
      let accessoryDisplayName = accessoryConfig.displayName
      const nodeId = accessoryConfig.zwaveNodeId
      const zwaveNode = this._zwaveNodes.get(nodeId)

      if (!accessoryDisplayName) {
        accessoryDisplayName = `accessory-${idx}`

        this._log.debug(`Accessory ${idx} does not have a display name. ${accessoryDisplayName} will be used as the display name for this accessory`)
      }

      if (!zwaveNode) {
        this._log.error(`${accessoryDisplayName} (node ${nodeId}) was not found)`)
        this._log.error(`${accessoryDisplayName} will not be initialized`)

        return
      }

      this._initAccessory(accessoryDisplayName, zwaveNode)
    })

    // Remove any left over cached accessories that were not initialized.
    // These will be accessories that were previously defined in the config,
    // but no longer needed
    for (let accessory of this._cachedAccessories.values()) {
      this._removeAccessory(accessory)

      this._cachedAccessories.delete(accessory.UUID)

      this._log.debug(`${accessory.displayName} was previously cached but is no longer required`)
      this._log.debug(`${accessory.displayName} removed from the cache`)
    }
  }

  /**
   * Initialize a platform accessory
   *
   * @param {String} accessoryDisplayName
   * @param {Object} zwaveNode
   */
  ZWavePlatform.prototype._initAccessory = function (accessoryDisplayName, zwaveNode) {
    const accessoryUUID = UUID(accessoryDisplayName)

    // Was the accessory previously cached?
    let cachedAccessory = this._cachedAccessories.get(accessoryUUID)

    if (cachedAccessory) {
      // Remove the accessory from this._cachedAccessories otherwise the
      // accessory will be unregistered from the platform when left over
      // accessories are cleaned up (see _initAccessories)
      this._cachedAccessories.delete(accessoryUUID)
    }

    // Should we remove this cached accessory from the platform and rebuild it?
    if (this._config.noCache && cachedAccessory) {
      this._removeAccessory(cachedAccessory)

      cachedAccessory = undefined

      this._log.debug(`${accessoryDisplayName} removed from the cache`)
    }

    // Work out what type of accessory the ZWave node maps too
    let accessory

    switch (zwaveNode.type) {
      case 'Binary Power Switch': // TODO: is this the best way to classify an accessory? should we use Node Values instead?
        accessory = this._initOutletAccessory(
          accessoryDisplayName,
          accessoryUUID,
          zwaveNode,
          cachedAccessory
        )

        this._setupZWaveNodeEventHandlerForOutletAccessory(
          zwaveNode,
          accessory
        )
        break
      // TODO: support other accessory types
      default:
        this._log.error(`${accessoryDisplayName} was identified as a ${zwaveNode.type}. This device type is currently unsupported.`)

        return
    }

    // Register the accessory with the platform
    if (cachedAccessory) {
      this._log.debug(`${accessoryDisplayName} was previously cached`)

      this._api.updatePlatformAccessories(pluginName, platformName, [accessory])
    } else {
      this._api.registerPlatformAccessories(pluginName, platformName, [accessory])
    }

    this._log.info(`${accessoryDisplayName} initialized!`)
  }

  /**
   * Initialize an Outlet accessory
   *
   * @param {String} accessoryDisplayName
   * @param {String} accessoryUUID
   * @param {Object} zwaveNode
   * @param {PlatformAccessory} cachedAccessory
   *
   * @returns {Object}
   */
  ZWavePlatform.prototype._initOutletAccessory = function (
    accessoryDisplayName,
    accessoryUUID,
    zwaveNode,
    cachedAccessory
  ) {
    // If we have a cached accessory, use it, otherwise create a new platform accessory
    const accessory = cachedAccessory || new PlatformAccessory(accessoryDisplayName, accessoryUUID)

    // Set up accessory information service
    const accessoryInformationService =
      accessory.getService(Service.AccessoryInformation) ||
      accessory.addService(Service.AccessoryInformation, accessoryDisplayName)

    accessoryInformationService
      .setCharacteristic(Characteristic.Manufacturer, zwaveNode.manufacturer)
      .setCharacteristic(Characteristic.Model, zwaveNode.model)
      .setCharacteristic(Characteristic.SerialNumber, 'Unknown') // TODO: where can we get the serial number from?

    // Set up outlet service
    const outletService =
      accessory.getService(Service.Outlet) ||
      accessory.addService(Service.Outlet, accessoryDisplayName)

    // Set up "On" Characteristic
    outletService.getCharacteristic(Characteristic.On)
      .on('get', (done) => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: ZWAVE_COMMAND_CLASS_SWITCH_BINARY,
          instance: 1, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

        this._log.debug(`${accessoryDisplayName} "On" characteristic value requested`)

        done(null, Boolean(nodeValue.value))
      })
      .on('set', (value, done) => {
        const newValue = Boolean(value)

        // This will trigger a "value changed" OpenZWave event. Ensure any
        // event handlers set up for this event are aware of this (see
        // _setupZWaveNodeEventHandlerForOutletAccessory)
        this._ozw.setValue(
          zwaveNode.id,
          ZWAVE_COMMAND_CLASS_SWITCH_BINARY,
          1, // TODO: is this always going to be 1?
          0, // TODO: is this always going to be 0?
          newValue
        )

        this._log.debug(`${accessoryDisplayName} "On" characteristic value updated to: ${newValue}`)

        done(null)
      })

    // Set up "Outlet In Use" Characteristic
    outletService.getCharacteristic(Characteristic.OutletInUse)
      .on('get', (done) => {
        const nodeValue = findNodeValue(zwaveNode.values, {
          class_id: ZWAVE_COMMAND_CLASS_SWITCH_BINARY,
          instance: 1, // TODO: is this always going to be 1?
          index: 0 // TODO: is this always going to be 0?
        })

        this._log.debug(`${accessoryDisplayName} "Outlet In Use" characteristic value requested`)

        done(null, Boolean(nodeValue.value))
      })

    return accessory
  }

  /**
   * Set up event handlers for ZWave Node associated with an Outlet accessory
   *
   * @param {Object} zwaveNode
   * @param {PlatformAccessory} accessory
   */
  ZWavePlatform.prototype._setupZWaveNodeEventHandlerForOutletAccessory = function (zwaveNode, accessory) {
    this._ozw.on('value changed', function (nodeId, commandClass, value) {
      const valueId = `${zwaveNode.id}-${ZWAVE_COMMAND_CLASS_SWITCH_BINARY}-1-0` // TODO: will this always be suffixed with '-1-0' (-<instance>-<index>)
      const newValue = Boolean(value.value)

      if (value.value_id !== valueId) {
        return
      }

      const outletService = accessory.getService(homebridge.hap.Service.Outlet)
      const onCharacteristic = outletService.getCharacteristic(homebridge.hap.Characteristic.On)

      // TODO: this is a hack to ensure this event handler is not executed as a result
      // of us triggering an OpenZWave "value changed" event via the platform (see outlet
      // accessory "On" characteristic setter). Is there a better way of doing this?
      if (onCharacteristic.value === newValue) {
        return
      }

      onCharacteristic.updateValue(newValue, null)

      this._log.debug(`${accessory.displayName} "On" characteristic value updated to: ${newValue} outside of HomeKit`)

      outletService
        .getCharacteristic(homebridge.hap.Characteristic.OutletInUse)
        .updateValue(newValue, null)

      this._log.debug(`${accessory.displayName} "Outlet In Use" characteristic value updated to: ${newValue} outside of HomeKit`)
    }.bind(this))
  }

  /**
   * Remove an accessory from the platform
   *
   * @param {PlatformAccessory} accessory
   */
  ZWavePlatform.prototype._removeAccessory = function (accessory) {
    this._api.unregisterPlatformAccessories(pluginName, platformName, [accessory])
  }

  /**
   * Initialize the ZWave network
   *
   * @param {Function} done
   */
  ZWavePlatform.prototype._initZWave = function (done) {
    const ozw = this._ozw = new OpenZWave({
      Logging: false,
      SaveConfiguration: false
    })

    ozw.on('driver failed', this._zwaveDriverFailed.bind(this, done))
    ozw.on('scan complete', this._zwaveScanComplete.bind(this, done))
    ozw.on('node added', this._zwaveNodeAdded.bind(this))
    ozw.on('node removed', this._zwaveNodeRemoved.bind(this))
    ozw.on('node ready', this._zwaveNodeReady.bind(this))
    ozw.on('value added', this._zwaveNodeValueAdded.bind(this))
    ozw.on('value changed', this._zwaveNodeValueChanged.bind(this))
    ozw.on('value removed', this._zwaveNodeValueRemoved.bind(this))

    ozw.connect(this._config.zwave.devicePath)
  }

  /**
   * Handler for OpenZWave "driver failed" event
   *
   * @param {Function} done
   */
  ZWavePlatform.prototype._zwaveDriverFailed = function (done) {
    done(new Error('Failed to setup ZWave network driver'))
  }

  /**
   * Handler for OpenZWave "scan complete" event
   *
   * @param {Function} done
   */
  ZWavePlatform.prototype._zwaveScanComplete = function (done) {
    this._zwaveLog('Scan complete')

    done()
  }

  /**
   * Handler for OpenZWave "node added" event
   *
   * @param {String} nodeId
   */
  ZWavePlatform.prototype._zwaveNodeAdded = function (nodeId) {
    // We only know the id of the node at this point. The rest of the node data
    // is set when the node is ready (see "node ready" event handler)
    this._zwaveNodes.set(nodeId, {
      id: nodeId,
      values: new Map()
    })

    // TODO: do we need to add a corresponding accessory to the platform?

    this._zwaveLog(`Node ${nodeId} added`)
  }

  /**
   * Handler for OpenZWave "node removed" event
   *
   * @param {String} nodeId
   */
  ZWavePlatform.prototype._zwaveNodeRemoved = function (nodeId) {
    this._zwaveNodes.delete(nodeId)

    // TODO: do we need to remove any corresponding accessories from the platform?

    this._zwaveLog(`Node ${nodeId} removed`)
  }

  /**
   * Handler for OpenZWave "node ready" event
   *
   * @param {String} nodeId
   * @param {Object} nodeData
   */
  ZWavePlatform.prototype._zwaveNodeReady = function (nodeId, nodeData) {
    this._zwaveNodes.set(
      nodeId,
      Object.assign(this._zwaveNodes.get(nodeId), nodeData)
    )

    this._zwaveLog(`Node ${nodeId} (${getNodeDescription(nodeData)}) ready`)
  }

  /**
   * Handler for OpenZWave "value added" event
   *
   * @param {String} nodeId
   * @param {String} commandClass
   * @param {Object} value
   */
  ZWavePlatform.prototype._zwaveNodeValueAdded = function (nodeId, commandClass, value) {
    const node = this._zwaveNodes.get(nodeId)

    node.values.set(value.value_id, value)

    this._zwaveLog(`Value ${value.value_id} (${value.label}) added for node ${nodeId}`)
  }

  /**
   * Handler for OpenZWave "value changed" event
   *
   * @param {String} nodeId
   * @param {String} commandClass
   * @param {Object} value
   */
  ZWavePlatform.prototype._zwaveNodeValueChanged = function (nodeId, commandClass, value) {
    const node = this._zwaveNodes.get(nodeId)
    const existingNodeValue = node.values.get(value.value_id)
    const previousNodeValueValue = existingNodeValue.value

    existingNodeValue.value = value.value

    this._zwaveLog(`Value ${existingNodeValue.value_id} (${existingNodeValue.label}) changed for node ${nodeId}: ${previousNodeValueValue} -> ${value.value}`)
  }

  /**
   * Handler for OpenZWave "value removed" event
   *
   * @param {String} nodeId
   * @param {String} commandclass
   * @param {Number} valueInstance
   * @param {Number} valueIndex
   */
  ZWavePlatform.prototype._zwaveNodeValueRemoved = function (nodeId, commandclass, valueInstance, valueIndex) {
    const valueId = `${nodeId}-${commandclass}-${valueInstance}-${valueIndex}`
    const node = this._zwaveNodes.get(nodeId)
    const value = node.values.get(valueId)

    node.delete(valueId)

    this._log(`Value ${valueId} (${value.label}) removed from node ${nodeId}`)
  }

  return ZWavePlatform
}

/**
 * Get the description for a ZWave node
 *
 * @param {Object} node
 * @returns {String}
 */
function getNodeDescription (node) {
  return `${node.manufacturer} ${node.product}`
}

/**
 * Find the first value matching a given criteria
 *
 * @param {Map} valuesMap
 * @param {Object} criteria
 *
 * @returns {Object}
 */
function findNodeValue (valuesMap, criteria) {
  return Array.from(valuesMap.values())
    .find(value => {
      return !Object.entries(criteria)
        .map(([k, v]) => value[k] === v)
        .includes(false)
    })
}
