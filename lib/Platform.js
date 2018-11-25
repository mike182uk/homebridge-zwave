const AccessoryConfigValidator = require('./AccessoryConfigValidator')
const BaseAccessoryBuilder = require('./AccessoryBuilder')
const OutletAccessoryBuilder = require('./OutletAccessoryBuilder')
const SensorAccessoryBuilder = require('./SensorAccessoryBuilder')
const ZWave = require('./ZWave')

module.exports = (pluginName, platformName, homebridge) => {
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

    this._cachedAccessories = new Map()
    this._zwave = undefined

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

    const zwaveLog = (message) => {
      this._log.debug(`[zwave] ${message}`)
    }

    this._zwave = new ZWave(this._config.zwave.devicePath, zwaveLog)

    // Initialize the ZWave network
    this._log.debug('Initializing ZWave network...')

    this._zwave.init(
      // When the ZWave network has been initialized, initialize the platform accessories
      this._initAccessories.bind(this)
    )
  }

  /**
   * Initialize the platform accessories
   *
   * @param {Error} zwaveInitErr
   */
  ZWavePlatform.prototype._initAccessories = function (zwaveInitErr) {
    if (zwaveInitErr) {
      this._log.error(`ZWave network was not initialized due to: ${zwaveInitErr.message}`)

      return
    }

    this._log.info('Initializing accessories...')

    this._config.accessories.forEach((accessoryConfig, idx) => {
      const accessoryDisplayName = accessoryConfig.displayName || `accessory-${idx}`

      // Check the accessory config is valid
      try {
        AccessoryConfigValidator.validate(accessoryConfig)
      } catch (err) {
        this._log.error(`The configuration for ${accessoryDisplayName} is invalid: ${err.message}`)
        this._log.error(`${accessoryDisplayName} will not be initialized`)

        return
      }

      // Check the corresponding ZWave node is available on the network
      const nodeId = accessoryConfig.zwaveNodeId
      const zwaveNode = this._zwave.getNodeById(nodeId)

      if (!zwaveNode) {
        this._log.error(`${accessoryDisplayName} (node ${nodeId}) was not found)`)
        this._log.error(`${accessoryDisplayName} will not be initialized`)

        return
      }

      this._initAccessory(accessoryConfig, zwaveNode)
    })

    // Remove any left over cached accessories that were not initialized.
    // These will be accessories that were previously defined in the config,
    // but are no longer needed
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
   * @param {Object} accessoryConfig
   * @param {Object} zwaveNode
   */
  ZWavePlatform.prototype._initAccessory = function (accessoryConfig, zwaveNode) {
    const accessoryDisplayName = accessoryConfig.displayName
    const accessoryUUID = homebridge.hap.uuid.generate(accessoryDisplayName)

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

    // Build the accessory that the ZWave node maps too
    const baseAccessoryBuilder = new BaseAccessoryBuilder(
      () => cachedAccessory || new homebridge.platformAccessory(accessoryDisplayName, accessoryUUID), // eslint-disable-line
      homebridge.hap.Service,
      homebridge.hap.Characteristic
    )

    let accessory

    switch (accessoryConfig.homekitAccessoryType) {
      case 'outlet':
        accessory = new OutletAccessoryBuilder(baseAccessoryBuilder, this._log, this._zwave)
          .build(accessoryDisplayName, zwaveNode)
        break
      case 'sensor':
        accessory = new SensorAccessoryBuilder(baseAccessoryBuilder, this._log, this._zwave)
          .build(accessoryDisplayName, accessoryConfig.sensors, zwaveNode)
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
   * Remove an accessory from the platform
   *
   * @param {PlatformAccessory} accessory
   */
  ZWavePlatform.prototype._removeAccessory = function (accessory) {
    this._api.unregisterPlatformAccessories(pluginName, platformName, [accessory])
  }

  return ZWavePlatform
}
