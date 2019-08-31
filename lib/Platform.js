const { deepStrictEqual } = require('assert').strict
const AccessoryManager = require('./AccessoryManager')
const Joi = require('@hapi/joi')
const ZWave = require('./ZWave')

module.exports = (pluginName, platformName, homebridge) => {
  const ACCESSORY_CONTEXT_KEY_ACCESSORY_CONFIG = `__${pluginName}_${platformName}_accessory_config__`

  class ZWavePlatform {
    /**
     * ZWavePlatform constructor
     *
     * @param {Object} log
     * @param {Object} config
     * @param {Object} api
     */
    constructor (log, config, api) {
      this._log = log
      this._config = config
      this._api = api

      this._accessories = new Map()
      this._redundantCachedAccessories = []

      // Validate the config - We validate the config here so that configureAccessory
      // will not get executed if the config is invalid
      try {
        this._validateConfig()
      } catch (err) {
        this._log.error(`${platformName} will not be initialized due to a configuration error: ${err.message}`)

        return
      }

      // Initialize ZWave - We initialize ZWave here so that when an accessory is
      // reinitialized in configureAccessory, any ZWave event handlers can be setup
      const zwaveLog = message => {
        this._log.debug(`[zwave] ${message}`)
      }

      this._zwave = new ZWave(this._config.zwave.devicePath, zwaveLog)

      // Initialize the platform
      this._api.on('didFinishLaunching', this._initPlatform.bind(this))
    }

    /**
     * Configure a cached accessory
     *
     * Note: Calling this._api.unregisterPlatformAccessories does not seem to work correctly here
     * so its best to remove redundant accessories when the platform has finished launching
     *
     * @param {Object} accessory
     */
    configureAccessory (accessory) {
      const cachedAccessoryConfig = accessory.context[ACCESSORY_CONTEXT_KEY_ACCESSORY_CONFIG]

      // Should we remove this accessory from the cache so that it can be reinitialized later?
      if (this._config.noCache) {
        this._redundantCachedAccessories.push(accessory)

        this._log.debug(`${cachedAccessoryConfig.displayName} will be removed from the cache due to config.noCache`)

        return
      }

      // Should we remove this accessory from the cache due to it being stale? (previously cached but no longer defined in the config)
      const accessoryIsStale = !this._config.accessories.some(accessoryConfig => {
        try {
          deepStrictEqual(cachedAccessoryConfig, accessoryConfig)

          return true
        } catch (err) {
          return false
        }
      })

      if (accessoryIsStale) {
        this._redundantCachedAccessories.push(accessory)

        this._log.debug(`${cachedAccessoryConfig.displayName} will be removed from the cache due to being stale`)

        return
      }

      // Reinitialize the cached accessory
      this._accessories.set(
        accessory.UUID,
        this._initAccessory(cachedAccessoryConfig, accessory)
      )
    }

    /**
     * Validate the configuration
     *
     * @throws {Error}
     */
    _validateConfig () {
      const accessoryConfigSchema = Joi.object().keys({
        zwaveNodeId: Joi.number().integer().required(),
        displayName: Joi.string().required(),
        homekitCategory: Joi.string().valid(['Outlet', 'Sensor']).required(),
        homekitServices: Joi.array()
          .when('homekitCategory', {
            is: 'Outlet',
            then: Joi.array().items(['Outlet']).min(1).required()
          })
          .when('homekitCategory', {
            is: 'Sensor',
            then: Joi.array().items(['HumiditySensor', 'LightSensor', 'MotionSensor', 'TemperatureSensor']).min(1).required()
          })
      })

      const configSchema = Joi.object().keys({
        accessories: Joi.array().min(1).required().items(accessoryConfigSchema),
        zwave: Joi.object().keys({
          devicePath: Joi.string().required()
        }).required(),
        noCache: Joi.boolean().optional()
      }).unknown()

      Joi.assert(this._config, configSchema)
    }

    /**
     * Initialize the platform
     */
    _initPlatform () {
      // Remove redundant accessories
      if (this._redundantCachedAccessories.length > 0) {
        this._log.info('Removing redundant cached accessories...')

        this._api.unregisterPlatformAccessories(pluginName, platformName, this._redundantCachedAccessories)
      }

      // Initialize accessories
      this._log.info('Initializing new accessories...')

      this._config.accessories.forEach(accessoryConfig => {
        const accessoryUUID = this._generateAccessoryUUID(accessoryConfig)
        const accessoryAlreadyInitialized = this._accessories.has(accessoryUUID)

        if (!accessoryAlreadyInitialized) {
          this._accessories.set(
            accessoryUUID,
            this._initAccessory(accessoryConfig)
          )
        }
      })

      // Initialize the ZWave network
      this._log.debug('Initializing ZWave network...')

      this._zwave.init((err) => {
        if (err) {
          this._log.error(`An error occured initializing the ZWave network: ${err.message}`)

          return
        }

        this._log.info('Platform initialized!')
      })
    }

    /**
     * Initialize a platform accessory
     *
     * @param   {Object} accessoryConfig
     * @param   {Object} accessory
     * @returns {Object}
     */
    _initAccessory (accessoryConfig, accessory) {
      const accessoryWasCached = accessory !== undefined
      const accessoryDisplayName = accessoryConfig.displayName
      const accessoryUUID = this._generateAccessoryUUID(accessoryConfig)

      // Create and configure the accessory
      accessory = accessory || new homebridge.platformAccessory( // eslint-disable-line
        accessoryDisplayName,
        accessoryUUID,
        homebridge.hap.Accessory.Categories[accessoryConfig.homekitCategory]
      )

      accessory.context[ACCESSORY_CONTEXT_KEY_ACCESSORY_CONFIG] = accessoryConfig

      // Initialize the accessory
      const accessoryManager = new AccessoryManager(
        homebridge.hap.Service,
        homebridge.hap.Characteristic,
        this._log,
        this._zwave
      )

      accessoryManager.initializeAccessory(accessoryConfig, accessory)

      // Register the accessory with the platform
      if (accessoryWasCached) {
        this._api.updatePlatformAccessories(pluginName, platformName, [accessory])

        this._log.info(`${accessoryDisplayName} reinitialized!`)
      } else {
        this._api.registerPlatformAccessories(pluginName, platformName, [accessory])

        this._log.info(`${accessoryDisplayName} initialized!`)
      }

      return accessoryManager
    }

    /**
     * Generate a UUID for an accessory
     *
     * @param   {Object} accessoryConfig
     * @returns {string}
     */
    _generateAccessoryUUID (accessoryConfig) {
      return homebridge.hap.uuid.generate(`${accessoryConfig.zwaveNodeId}-${accessoryConfig.displayName}`)
    }
  }

  return ZWavePlatform
}
