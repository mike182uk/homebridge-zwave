const { EventEmitter } = require('events')
const OpenZWave = require('openzwave-shared')

const EVENT_NODE_READY = 'node.ready'
const EVENT_NODE_VALUE_UPDATED = 'node.value.updated'

class ZWave {
  /**
   * ZWave constructor
   *
   * @param {string} devicePath
   * @param {Function} log
   */
  constructor (devicePath, log) {
    this._devicePath = devicePath
    this._log = log

    this._eventEmitter = new EventEmitter()
    this._nodes = new Map()
    this._ready = false
  }

  /**
   * Initialize the ZWave network
   *
   * @param {Function} done
   */
  init (done) {
    const ozw = this._ozw = new OpenZWave({
      Logging: false, //// disable file logging (OZWLog.txt)
      SaveConfiguration: true,
      ConsoleOutput: true, // enable console logging
      NotifyTransactions: true
    })

    //Driver Events
    ozw.on('driver ready', this._ozwDriverReady.bind(this))
    ozw.on('driver failed', this._ozwDriverFailed.bind(this, done))
    ozw.on('scan complete', this._ozwScanComplete.bind(this, done))

    //Node Events
    ozw.on('node added', this._ozwNodeAdded.bind(this))
    ozw.on('node removed', this._ozwNodeRemoved.bind(this))
    //ozw.on('node naming',this._ozwNodeNaming.bind(this)) //Useful information about the node is returned as a plain JS object. It includes elements like 'manufacturer', 'product', 'type' and 'name' amongst others.
    //ozw.on('node available',this._ozwNodeAvailable.bind(this)) //This corresponds to OpenZWave's EssentialNodeQueriesComplete notification, which means that the node is now available for operation, but don't expect all of its info structures (nodeinfo, see below) to be filled in.
    ozw.on('node ready', this._ozwNodeReady.bind(this))//This corresponds to OpenZWave's NodeQueriesComplete notification. The node is now ready for operation, and information about the node is available in the nodeinfo object:

    //Value Events
    ozw.on('value added', this._ozwNodeValueAdded.bind(this))
    ozw.on('value changed', this._ozwNodeValueChanged.bind(this))
    ozw.on('value refreshed', this._ozwNodeValueRefreshed.bind(this))
    ozw.on('value removed', this._ozwNodeValueRemoved.bind(this))

    ozw.on('notification', this._ozwNodeNotification.bind(this))

    ozw.connect(this._devicePath)
  }
  /**
   * Shuttingdown the ZWave network
   *
   * @param {Function} done
   */
  sigint (done) {
    const ozw = this._ozw
    //ozw.disconnect()//this._devicePath)
    ozw.disconnect(this._devicePath)
    //zwave.disconnect('/dev/ttyUSB0');
  }

  /**
   * Find the first node value matching a given criteria
   *
   * @param   {number} nodeId
   * @param   {Object} criteria
   * @returns {Object}
   */
  findNodeValue (nodeId, criteria) {
    // For convenience, assume instance is 1 unless told otherwise
    criteria = Object.assign({ instance: 1 }, criteria)

    const node = this._nodes.get(nodeId)

    return Array.from(node.values.values())
      .find(value => {
        return !Object.entries(criteria)
          .map(([k, v]) => value[k] === v)
          .includes(false)
      })
  }


  /**
   * Add a handler for when a node is ready
   *
   * @param {string} nodeId
   * @param {Function} callback
   */
  onNodeReady (nodeId, callback) {
    this._eventEmitter.on(EVENT_NODE_READY, (node) => {
      if (nodeId === node.id) {
        callback(node)
      }
    })
  }

  /**
   * Add a handler for when a node value changes
   *
   * @param {string} nodeValueId
   * @param {Function} callback
   */
  onNodeValueChanged (nodeValueId, callback) {
    this._eventEmitter.on(EVENT_NODE_VALUE_UPDATED, (updatedNodeValueId, value) => {
      if (updatedNodeValueId === nodeValueId) {
        callback(value)
      }
    })
  }

  /**
   * Update a node value by its ID
   *
   * @param {string} id
   * @param {*} newValue
   */
  updateNodeValueById (id, newValue) {
    const [
      nodeId,
      commandClass,
      valueInstance,
      valueIndex
    ] = id.split('-')

    this._ozw.setValue(
      nodeId,
      commandClass,
      valueInstance,
      valueIndex,
      newValue
    )
  }

  /**
   * Generate a node value id
   *
   * @param   {Object}
   * @returns {string}
   */
  generateNodeValueId ({ nodeId, commandClass, valueInstance, valueIndex }) {
    valueInstance = valueInstance || 1
    valueIndex = valueIndex || 0

    return `${nodeId}-${commandClass}-${valueInstance}-${valueIndex}`
  }

  /**
   * Handler for OpenZWave "driver ready" event
   *
   * @param {string} homeId
   */
  _ozwDriverReady (homeId) {
    console.log('Scanning homeid=0x%s...', homeId.toString(16));
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
    this._ready = true

    this._log('Scan complete')

    done()
  }

  /**
   * Handler for OpenZWave "node added" event
   *
   * @param {string} nodeId
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
   * @param {string} nodeId
   */
  _ozwNodeRemoved (nodeId) {
    this._nodes.delete(nodeId)

    this._log(`Node ${nodeId} removed`)
  }

  /**
   * Handler for OpenZWave "node ready" event
   *
   * @param {string} nodeId
   * @param {Object} nodeData
   */
  _ozwNodeReady (nodeId, nodeData) {
    const node = Object.assign(this._nodes.get(nodeId), nodeData)

    this._nodes.set(nodeId, node)

    this._log(`Node ${nodeId} (${nodeData.manufacturer} ${nodeData.product}) ready`)

    this._eventEmitter.emit(EVENT_NODE_READY, node)
  }

  /**
   * Handler for OpenZWave "value added" event
   *
   * @param {string} nodeId
   * @param {string} commandClass
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
   * @param {string} nodeId
   * @param {string} commandClass
   * @param {Object} value
   */
  _ozwNodeValueChanged (nodeId, commandClass, value) {
    const node = this._nodes.get(nodeId)
    const existingNodeValue = node.values.get(value.value_id)
    const previousNodeValueValue = existingNodeValue.value

    existingNodeValue.value = value.value

    this._log(`Value ${existingNodeValue.value_id} (${existingNodeValue.label}) changed for node ${nodeId}: ${previousNodeValueValue} -> ${value.value}`)

    // If the ZWave network has been initialized, emit the internal event.
    if (this._ready) {
      this._eventEmitter.emit(EVENT_NODE_VALUE_UPDATED, existingNodeValue.value_id, value.value)
    }
  }

  /**
   * Handler for OpenZWave "value changed" event
   *
   * @param {string} nodeId
   * @param {string} commandClass
   * @param {Object} value
   */
  _ozwNodeValueRefreshed (nodeId, commandClass, value) {
    //const node = this._nodes.get(nodeId)
    //const existingNodeValue = node.values.get(value.value_id)
    //const previousNodeValueValue = existingNodeValue.value

    //existingNodeValue.value = value.value
    //if (nodeId === MONITOR_NODE) {
    //  console.log(`Node[${nodeId}], [${commandClass}]: Value Refreshed ${existingNodeValue.value_id} (${existingNodeValue.label}) : ${previousNodeValueValue} -> ${value.value}`)
    //}

    // If the ZWave network has been initialized, emit the internal event.
    //if (this._ready) {
    //  this._eventEmitter.emit(EVENT_NODE_VALUE_UPDATED, existingNodeValue.value_id, value.value)
    //}
  }



  /**
   * Handler for OpenZWave "value removed" event
   *
   * @param {string} nodeId
   * @param {string} commandclass
   * @param {number} valueInstance
   * @param {number} valueIndex
   */
  _ozwNodeValueRemoved (nodeId, commandclass, valueInstance, valueIndex) {
    const valueId = this.generateNodeValueId({ nodeId, commandclass, valueInstance, valueIndex })
    const node = this._nodes.get(nodeId)
    const value = node.values.get(valueId)

    node.delete(valueId)

    this._log(`Value ${valueId} (${value.label}) removed from node ${nodeId}`)
  }

  /**
   * Handler for OpenZWave "notification" event
   *
   * @param {string} nodeId
   * @param {string} commandclass
   * @param {number} valueInstance
   * @param {number} valueIndex
   */
  _ozwNodeNotification (nodeid, notif) {
    var message = ""
    switch (notif) {
    case 0:
        message = "message complete"
        break;
    case 1:
        message = "timeout"
        console.log('Node[%d]: %s', nodeid, message)
        break;
    case 2:
        message = "nop"
        break;
    case 3:
        message = "node awake"
        break;
    case 4:
        message = "node sleep"
        break;
    case 5:
        message = "node dead"
        console.log('Node[%d]: %s', nodeid, message)
        break;
    case 6:
        message = "node alive"
        console.log('Node[%d]: %s', nodeid, message)
        break;
        }
  }
}

// http://wiki.micasaverde.com/index.php/ZWave_Command_Classes
ZWave.COMMAND_CLASS_SWITCH_BINARY = 37
ZWave.COMMAND_CLASS_SWITCH_MULTILEVEL = 38
ZWave.COMMAND_CLASS_SENSOR_MULTILEVEL = 49
ZWave.COMMAND_CLASS_METER = 50
ZWave.COMMAND_CLASS_CONFIGURATION = 112
ZWave.COMMAND_CLASS_ALARM = 113
ZWave.COMMAND_CLASS_MANUFACTURER_SPECIFIC = 114
ZWave.COMMAND_CLASS_BATTERY = 128

ZWave.ALARM_INDEX_HOME_SECURITY = 7
ZWave.BATTERY_INDEX_LEVEL = 0
ZWave.CONFIGURATION_INDEX_CURRENT_POWER_MODE = 9
ZWave.CONFIGURATION_INDEX_LOW_BATTERY = 39
ZWave.MANUFACTURER_SPECIFIC_INDEX_SERIAL_NUMBER = 4
ZWave.METER_INDEX_ELECTRIC_INSTANT_POWER = 2
ZWave.SENSOR_MULTILEVEL_INDEX_HUMIDITY = 5
ZWave.SENSOR_MULTILEVEL_INDEX_LUMINANCE = 3
ZWave.SENSOR_MULTILEVEL_INDEX_TEMPERATURE = 1
ZWave.SWITCH_BINARY_INDEX_SWITCH = 0

module.exports = ZWave
