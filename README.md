# homebridge-zwave

A [ZWave](https://www.z-wave.com/) plugin for [Homebridge](https://github.com/nfarina/homebridge).

## Index

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Notes](#notes)
- [FAQ's](#faqs)

## Prerequisites

1. Node.JS >= 10
2. Homebridge >= 0.4.45
3. [OpenZWave](http://www.openzwave.com/)

## Installation

```
npm i -g <TODO>
```

## Usage

Register the plugin with Homebridge by adding a new entry to the `platforms` section of your Homebridge config:

```json
{
  "platform": "ZWavePlatform",
  "name": "ZWavePlatform",
  "zwave": {
    "devicePath": "/dev/cu.usbmodem14201"
  },
  "accessories": [
    {
      "zwaveNodeId": 2,
      "displayName": "Desk Power Socket",
      "homekitCategory": "Outlet",
      "homekitServices": [
        "Outlet"
      ]
    },
    {
      "zwaveNodeId": 6,
      "displayName": "Office Multisensor",
      "homekitCategory": "Sensor",
      "homekitServices": [
        "HumiditySensor",
        "TemperatureSensor"
      ]
    }
  ],
  "noCache": false
}
```

If you do not have a `platforms` section in your Homebridge config you will need to define one.

`zwave.devicePath` is the path to your ZWave controller. This can vary based on the controller manufacturer and the operating system you are using.

`accessories` is where you will map a ZWave node to a HomeKit accessory. To define an accessory the information needed is:

- `zwaveNodeId` - the ID of the node in the ZWave network that this accessory is for
- `displayName` - the name that will be used for this accessory
- `homekitCategory` - the type of accessory HomeKit will see this accessory as. Supported categories are:
  - `Outlet`
  - `Sensor`
- `homekitServices` - the HomeKit services provided by this accessory. Supported services are:
  - If `homekitCategory` is `Outlet`:
    - `Outlet`
  - If `homekitCategory` is `Sensor`:
    - `HumiditySensor`
    - `LightSensor`
    - `TemperatureSensor`

`noCache` sets whether accessories registered by this plugin should be cached or not. By default this value is `false`. Set to `true` to disable the cache.

## Notes

TODO

### Devices tested with the plugin

- [Aeotec Z-Stick Gen5](https://aeotec.com/z-wave-usb-stick)
- [Aeotec Smart Switch 6](https://aeotec.com/z-wave-plug-in-switch) (UK version)

## FAQ's

TODO
