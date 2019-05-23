module.exports = (homebridge) => {
  const PLUGIN_NAME = 'homebridge-zwave'
  const PLATFORM_NAME = 'ZWavePlatform'

  homebridge.registerPlatform(
    PLUGIN_NAME,
    PLATFORM_NAME,
    require('./lib/Platform')(
      PLUGIN_NAME,
      PLATFORM_NAME,
      homebridge
    ),
    true // ensure platform is registered as a dynamic platform
  )
}
