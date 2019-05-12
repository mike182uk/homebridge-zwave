const Joi = require('@hapi/joi')

/**
 * Find the first node value matching a given criteria
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

/**
 * Validate the configuration for an accessory
 *
 * @param {Object} accessoryConfig
 */
function validateAccessoryConfig (accessoryConfig) {
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

  Joi.assert(accessoryConfig, accessoryConfigSchema)
}

module.exports = {
  findNodeValue,
  validateAccessoryConfig
}
