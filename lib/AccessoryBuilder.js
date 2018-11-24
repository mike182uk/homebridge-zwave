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

    if (onGetOnCharacteristic) {
      outletService
        .getCharacteristic(this._homekitCharacteristic.On)
        .on('get', onGetOnCharacteristic)
    }

    if (onSetOnCharacteristic) {
      outletService
        .getCharacteristic(this._homekitCharacteristic.On)
        .on('set', onSetOnCharacteristic)
    }

    if (onGetOutletInUseCharacteristic) {
      outletService
        .getCharacteristic(this._homekitCharacteristic.OutletInUse)
        .on('get', onGetOutletInUseCharacteristic)
    }

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
