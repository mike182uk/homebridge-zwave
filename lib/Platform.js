const { validateAccessoryConfig } = require('./utils')
const AccessoryServiceConfigurer = require('./AccessoryServiceConfigurer')
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
    this._accessoryServiceConfigurer = undefined
    this._zwave = undefined

    this._api.on('didFinishLaunching', this._initPlatform.bind(this))
  }

  /**
   * Configure a cached accessory
   *
   * @param {Object} accessory
   */
  ZWavePlatform.prototype.configureAccessory = function (accessory) {
    this._cachedAccessories.set(accessory.UUID, accessory)
  }

  /**
   * Initialize the platform
   */
  ZWavePlatform.prototype._initPlatform = function () {
    // Ensure accessories have been defined
    if (!this._config.accessories || this._config.accessories.length < 1) {
      this._log.error('There are no accessories defined in the configuration')

      return
    }

    // Ensure accessory configuration is valid
    try {
      this._config.accessories.forEach((accessoryConfig, idx) => {
        const accessoryDisplayName = accessoryConfig.displayName || `accessory-${idx + 1}`

        try {
          validateAccessoryConfig(accessoryConfig)
        } catch (err) {
          throw new Error(`The configuration for ${accessoryDisplayName} is invalid: ${err.message}`)
        }
      })
    } catch (err) {
      this._log.error(err.message)

      return
    }

    // Ensure zwave device path has been defined
    if (!this._config.zwave.devicePath) {
      this._log.error('The ZWave device path has not been defined in the configuration')

      return
    }

    const zwaveLog = message => {
      this._log.debug(`[zwave] ${message}`)
    }

    this._zwave = new ZWave(this._config.zwave.devicePath, zwaveLog)

    // Remove any cached accessories that are not defined in the config
    const conifgAccessoriesUUIDs = this._config.accessories.map(this._generateAccessoryUUID)

    for (let accessory of this._cachedAccessories.values()) {
      if (!conifgAccessoriesUUIDs.includes(accessory.UUID)) {
        this._removeAccessory(accessory)

        this._cachedAccessories.delete(accessory.UUID)

        this._log.debug(`${accessory.displayName} was previously cached but is no longer required`)
        this._log.debug(`${accessory.displayName} removed from the cache`)
      }
    }

    // Initialize the ZWave network
    this._log.debug('Initializing ZWave network...')

    this._zwave.init((err) => {
      if (err) {
        this._log.error(`ZWave network was not initialized due to: ${err.message}`)

        return
      }

      // When the ZWave network has been initialized, initialize the platform accessories
      this._initAccessories()
    })
  }

  /**
   * Initialize the platform accessories
   */
  ZWavePlatform.prototype._initAccessories = function () {
    this._accessoryServiceConfigurer = new AccessoryServiceConfigurer(
      homebridge.hap.Service,
      homebridge.hap.Characteristic,
      this._log,
      this._zwave
    )

    this._log.info('Initializing accessories...')

    this._config.accessories.forEach((accessoryConfig, idx) => {
      const accessoryDisplayName = accessoryConfig.displayName || `accessory-${idx + 1}`

      // Check the corresponding ZWave node is available on the network
      const nodeId = accessoryConfig.zwaveNodeId
      const zwaveNode = this._zwave.getNodeById(nodeId)

      if (!zwaveNode) {
        this._log.error(`${accessoryDisplayName} (node ${nodeId}) was not found`)
        this._log.error(`${accessoryDisplayName} will not be initialized`)

        return
      }

      this._initAccessory(accessoryConfig, zwaveNode)
    })
  }

  /**
   * Initialize a platform accessory
   *
   * @param {Object} accessoryConfig
   * @param {Object} zwaveNode
   */
  ZWavePlatform.prototype._initAccessory = function (accessoryConfig, zwaveNode) {
    const accessoryDisplayName = accessoryConfig.displayName
    const accessoryUUID = this._generateAccessoryUUID(accessoryConfig)

    // Was the accessory previously cached?
    let cachedAccessory = this._cachedAccessories.get(accessoryUUID)

    // Should we remove this cached accessory from the platform and reconfigure it?
    if (this._config.noCache && cachedAccessory) {
      this._removeAccessory(cachedAccessory)

      cachedAccessory = undefined

      this._log.debug(`${accessoryDisplayName} removed from the cache`)
    }

    // Create and configure the accessory
    const accessory = cachedAccessory || new homebridge.platformAccessory( // eslint-disable-line
      accessoryDisplayName,
      accessoryUUID,
      homebridge.hap.Accessory.Categories[accessoryConfig.homekitCategory]
    )

    accessoryConfig.homekitServices
      .concat('AccessoryInformation') // Ensure each accessory has a AccessoryInformation service so that the accessory information gets updated
      .forEach(service => {
        this._accessoryServiceConfigurer.configureService(
          accessory,
          service,
          zwaveNode
        )
      })

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
   * @param {Object} accessory
   */
  ZWavePlatform.prototype._removeAccessory = function (accessory) {
    this._api.unregisterPlatformAccessories(pluginName, platformName, [accessory])
  }

  /**
   * Generate a UUID for an accessory
   *
   * @param {Object} accessoryConfig
   * @returns {String}
   */
  ZWavePlatform.prototype._generateAccessoryUUID = function (accessoryConfig) {
    return homebridge.hap.uuid.generate(accessoryConfig.displayName)
  }

  return ZWavePlatform
}
