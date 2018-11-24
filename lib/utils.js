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

module.exports = {
  findNodeValue
}
