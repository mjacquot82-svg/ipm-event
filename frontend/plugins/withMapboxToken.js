// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Custom plugin to write Mapbox token to gradle.properties

const { withGradleProperties } = require("expo/config-plugins");

const withMapboxToken = (config) => {
  return withGradleProperties(config, (config) => {
    // Add both variable names to ensure compatibility
    config.modResults.push({
      type: "property",
      key: "MAPBOX_DOWNLOADS_TOKEN",
      value: "sk.eyJ1IjoibWphY3F1b3QiLCJhIjoiY21tdmRwcXVuMDJsbjJycHBrcXV6czl3dyJ9.pUiimStUZ4mIXhkErun2MQ",
    });
    config.modResults.push({
      type: "property",
      key: "RNMAPBOX_MAPS_DOWNLOAD_TOKEN",
      value: "sk.eyJ1IjoibWphY3F1b3QiLCJhIjoiY21tdmRwcXVuMDJsbjJycHBrcXV6czl3dyJ9.pUiimStUZ4mIXhkErun2MQ",
    });
    return config;
  });
};

module.exports = withMapboxToken;
