const Joi = require('joi')

const baseSchema = Joi.object().keys({
  zwaveNodeId: Joi.number().integer().required(),
  displayName: Joi.string().required(),
  homekitAccessoryType: Joi.string().valid(['outlet', 'sensor']).required()
})

const sensorHomekitAccessoryTypeSchema = baseSchema.keys({
  sensors: Joi.array().items(['humidity', 'light', 'temperature']).required()
})

class AccessoryConfigValidator {
  /**
   * Validate the given accessory config
   *
   * @param {Object} accessoryConfig
   */
  static validate (accessoryConfig) {
    let validationSchema

    switch (accessoryConfig.homekitAccessoryType) {
      case 'outlet':
        validationSchema = baseSchema
        break
      case 'sensor':
        validationSchema = sensorHomekitAccessoryTypeSchema
        break
      default:
        throw new Error(`${accessoryConfig.homekitAccessoryType} is not a valid HomeKit accessory type`)
    }

    Joi.assert(accessoryConfig, validationSchema)
  }
}

module.exports = AccessoryConfigValidator
