class AccessoryBuilder {
  /**
   * AccessoryBuilder constructor
   *
   * @param {Function} accessoryFactory
   * @param {Object} homekitService
   * @param {Object} homekitCharacteristic
   */
  constructor (
    accessoryFactory,
    homekitService,
    homekitCharacteristic
  ) {
    this._accessoryFactory = accessoryFactory
    this._homekitService = homekitService
    this._homekitCharacteristic = homekitCharacteristic

    this._accessory = undefined
  }

  /**
   * Build the accessory
   *
   * @returns {AccessoryBuilder}
   */
  build () {
    this._accessory = this._accessoryFactory()

    return this
  }

  /**
   * Add an "Accessory Information" service to the accessory
   *
   * @param {String} manufacturer
   * @param {String} model
   * @param {String} serialNumber
   *
   * @returns {AccessoryBuilder}
   */
  withInformationService (manufacturer, model, serialNumber) {
    if (!this._accessory) {
      throw new Error('accessory has not yet been built')
    }

    const accessoryInformationService =
      this._accessory.getService(this._homekitService.AccessoryInformation) ||
      this._accessory.addService(this._homekitService.AccessoryInformation, this._accessory.displayName)

    accessoryInformationService
      .setCharacteristic(this._homekitCharacteristic.Manufacturer, manufacturer)
      .setCharacteristic(this._homekitCharacteristic.Model, model)
      .setCharacteristic(this._homekitCharacteristic.SerialNumber, serialNumber)

    return this
  }

  /**
   * Add an "Outlet" service to the accessory
   *
   * @param {Function} onGetOnCharacteristic
   * @param {Function} onSetOnCharacteristic
   * @param {Function} onGetOutletInUseCharacteristic
   *
   * @returns {AccessoryBuilder}
   */
  withOutletService (
    onGetOnCharacteristic,
    onSetOnCharacteristic,
    onGetOutletInUseCharacteristic
  ) {
    if (!this._accessory) {
      throw new Error('accessory has not yet been built')
    }

    const outletService =
      this._accessory.getService(this._homekitService.Outlet) ||
      this._accessory.addService(this._homekitService.Outlet, this._accessory.displayName)

    outletService
      .getCharacteristic(this._homekitCharacteristic.On)
      .on('get', onGetOnCharacteristic)
      .on('set', onSetOnCharacteristic)

    outletService
      .getCharacteristic(this._homekitCharacteristic.OutletInUse)
      .on('get', onGetOutletInUseCharacteristic)

    return this
  }

  /**
   * Add a "Humidity Sensor" service to the accessory
   *
   * @param {Function} onGetCurrentRelativeHumidityCharacteristic
   *
   * @returns {AccessoryBuilder}
   */
  withHumiditySensorService (
    onGetCurrentRelativeHumidityCharacteristic
  ) {
    if (!this._accessory) {
      throw new Error('accessory has not yet been built')
    }

    const humiditySensorService =
      this._accessory.getService(this._homekitService.HumiditySensor) ||
      this._accessory.addService(this._homekitService.HumiditySensor, this._accessory.displayName)

    humiditySensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentRelativeHumidity)
      .on('get', onGetCurrentRelativeHumidityCharacteristic)

    return this
  }

  /**
   * Add a "Light Sensor" service to the accessory
   *
   * @param {Function} onGetCurrentRelativeHumidityCharacteristic
   *
   * @returns {AccessoryBuilder}
   */
  withLightSensorService (
    onGetCurrentAmbientLightLevelCharacteristic
  ) {
    if (!this._accessory) {
      throw new Error('accessory has not yet been built')
    }

    const humiditySensorService =
      this._accessory.getService(this._homekitService.LightSensor) ||
      this._accessory.addService(this._homekitService.LightSensor, this._accessory.displayName)

    humiditySensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentAmbientLightLevel)
      .on('get', onGetCurrentAmbientLightLevelCharacteristic)

    return this
  }

  /**
   * Add a "Temperature Sensor" service to the accessory
   *
   * @param {Function} onGetCurrentTemperatureCharacteristic
   *
   * @returns {AccessoryBuilder}
   */
  withTemperatureSensorService (
    onGetCurrentTemperatureCharacteristic
  ) {
    if (!this._accessory) {
      throw new Error('accessory has not yet been built')
    }

    const temperatureSensorService =
      this._accessory.getService(this._homekitService.TemperatureSensor) ||
      this._accessory.addService(this._homekitService.TemperatureSensor, this._accessory.displayName)

    temperatureSensorService
      .getCharacteristic(this._homekitCharacteristic.CurrentTemperature)
      .on('get', onGetCurrentTemperatureCharacteristic)

    return this
  }

  /**
   * Get the built accessory
   *
   * @returns {Object}
   */
  get () {
    return this._accessory
  }
}

module.exports = AccessoryBuilder
