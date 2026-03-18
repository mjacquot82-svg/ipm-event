// © 2026 1001538341 ONTARIO INC. All Rights Reserved.
// Custom plugin to write Mapbox token to gradle.properties and settings.gradle

const { withGradleProperties, withSettingsGradle } = require("expo/config-plugins");

const MAPBOX_TOKEN = "sk.eyJ1IjoibWphY3F1b3QiLCJhIjoiY21tdmRwcXVuMDJsbjJycHBrcXV6czl3dyJ9.pUiimStUZ4mIXhkErun2MQ";

const withMapboxToken = (config) => {
  // First, add to gradle.properties
  config = withGradleProperties(config, (config) => {
    // Remove any existing MAPBOX tokens first
    config.modResults = config.modResults.filter(
      (item) => item.key !== "MAPBOX_DOWNLOADS_TOKEN" && item.key !== "RNMAPBOX_MAPS_DOWNLOAD_TOKEN"
    );
    
    // Add the tokens
    config.modResults.push({
      type: "property",
      key: "MAPBOX_DOWNLOADS_TOKEN",
      value: MAPBOX_TOKEN,
    });
    config.modResults.push({
      type: "property",
      key: "RNMAPBOX_MAPS_DOWNLOAD_TOKEN",
      value: MAPBOX_TOKEN,
    });
    return config;
  });

  // Then, modify settings.gradle to ensure the Maven repo has credentials
  config = withSettingsGradle(config, (config) => {
    const mapboxMavenRepo = `
        maven {
            url 'https://api.mapbox.com/downloads/v2/releases/maven'
            authentication {
                basic(BasicAuthentication)
            }
            credentials {
                username = "mapbox"
                password = "${MAPBOX_TOKEN}"
            }
        }`;
    
    // Check if the Mapbox repo is already configured
    if (!config.modResults.contents.includes("api.mapbox.com/downloads/v2/releases/maven")) {
      // Add after the first maven repo in dependencyResolutionManagement
      config.modResults.contents = config.modResults.contents.replace(
        /dependencyResolutionManagement\s*\{[^}]*repositories\s*\{/,
        (match) => match + mapboxMavenRepo
      );
    }
    
    return config;
  });

  return config;
};

module.exports = withMapboxToken;
