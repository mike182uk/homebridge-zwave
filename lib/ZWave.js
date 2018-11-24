const OpenZWave = require('openzwave-shared')

class ZWave {
  /**
   * ZWave constructor
   *
   * @param {String} devicePath
   * @param {Function} log
   */
  constructor (devicePath, log) {
    this._devicePath = devicePath
    this._log = log

    this._nodes = new Map()
  }

  /**
   * Initialize the ZWave network
   *
   * @param {Function} done
   */
  init (done) {
    const ozw = this._ozw = new OpenZWave({
      Logging: false,
      SaveConfiguration: false
    })

    ozw.on('driver failed', this._ozwDriverFailed.bind(this, done))
    ozw.on('scan complete', this._ozwScanComplete.bind(this, done))
    ozw.on('node added', this._ozwNodeAdded.bind(this))
    ozw.on('node removed', this._ozwNodeRemoved.bind(this))
    ozw.on('node ready', this._ozwNodeReady.bind(this))
    ozw.on('value added', this._ozwNodeValueAdded.bind(this))
    ozw.on('value changed', this._ozwNodeValueChanged.bind(this))
    ozw.on('value removed', this._ozwNodeValueRemoved.bind(this))

    ozw.connect(this._devicePath)
  }

  /**
   * Get all of the nodes
   *
   * @returns Array
   */
  getNodes () {
    return Array.from(this._nodes.values())
  }

  /**
   * Get a node by its ID
   *
   * @param {String} nodeId
   * @returns {Object}
   */
  getNodeById (nodeId) {
    return this._nodes.get(nodeId)
  }

  /**
   * Set a node value
   *
   * @param {String} nodeId
   * @param {String} commandClass
   * @param {Number} valueInstance
   * @param {Number} valueIndex
   * @param {*} valueValue
   */
  setNodeValue (
    nodeId,
    commandClass,
    valueInstance,
    valueIndex,
    valueValue
  ) {
    this._ozw.setValue(
      nodeId,
      commandClass,
      valueInstance,
      valueIndex,
      valueValue
    )
  }

  /**
   * Handler for OpenZWave "driver failed" event
   *
   * @param {Function} done
   */
  _ozwDriverFailed (done) {
    done(new Error('Failed to setup ZWave network driver'))
  }

  /**
   * Handler for OpenZWave "scan complete" event
   *
   * @param {Function} done
   */
  _ozwScanComplete (done) {
    this._log('Scan complete')

    done()
  }

  /**
   * Handler for OpenZWave "node added" event
   *
   * @param {String} nodeId
   */
  _ozwNodeAdded (nodeId) {
    // We only know the id of the node at this point. The rest of the node data
    // is set when the node is ready (see "node ready" event handler)
    this._nodes.set(nodeId, {
      id: nodeId,
      values: new Map()
    })

    this._log(`Node ${nodeId} added`)
  }

  /**
   * Handler for OpenZWave "node removed" event
   *
   * @param {String} nodeId
   */
  _ozwNodeRemoved (nodeId) {
    this._nodes.delete(nodeId)

    this._log(`Node ${nodeId} removed`)
  }

  /**
   * Handler for OpenZWave "node ready" event
   *
   * @param {String} nodeId
   * @param {Object} nodeData
   */
  _ozwNodeReady (nodeId, nodeData) {
    this._nodes.set(
      nodeId,
      Object.assign(this._nodes.get(nodeId), nodeData)
    )

    this._log(`Node ${nodeId} (${nodeData.manufacturer} ${nodeData.product}) ready`)
  }

  /**
   * Handler for OpenZWave "value added" event
   *
   * @param {String} nodeId
   * @param {String} commandClass
   * @param {Object} value
   */
  _ozwNodeValueAdded (nodeId, commandClass, value) {
    const node = this._nodes.get(nodeId)

    node.values.set(value.value_id, value)

    this._log(`Value ${value.value_id} (${value.label}) added for node ${nodeId}`)
  }

  /**
   * Handler for OpenZWave "value changed" event
   *
   * @param {String} nodeId
   * @param {String} commandClass
   * @param {Object} value
   */
  _ozwNodeValueChanged (nodeId, commandClass, value) {
    const node = this._nodes.get(nodeId)
    const existingNodeValue = node.values.get(value.value_id)
    const previousNodeValueValue = existingNodeValue.value

    existingNodeValue.value = value.value

    this._log(`Value ${existingNodeValue.value_id} (${existingNodeValue.label}) changed for node ${nodeId}: ${previousNodeValueValue} -> ${value.value}`)
  }

  /**
   * Handler for OpenZWave "value removed" event
   *
   * @param {String} nodeId
   * @param {String} commandclass
   * @param {Number} valueInstance
   * @param {Number} valueIndex
   */
  _ozwNodeValueRemoved (nodeId, commandclass, valueInstance, valueIndex) {
    const valueId = `${nodeId}-${commandclass}-${valueInstance}-${valueIndex}`
    const node = this._nodes.get(nodeId)
    const value = node.values.get(valueId)

    node.delete(valueId)

    this._log(`Value ${valueId} (${value.label}) removed from node ${nodeId}`)
  }
}

// http://wiki.micasaverde.com/index.php/ZWave_Command_Classes
ZWave.COMMAND_CLASS_SWITCH_BINARY = 37 // 0x25
ZWave.COMMAND_CLASS_METER = 50 // 0x32

ZWave.METER_INDEX_ELECTRIC_INSTANT_POWER = 8 // bit 2

module.exports = ZWave
