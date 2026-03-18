// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

export default {
  expo: {
    name: "IPM 2026",
    slug: "ipm-2026",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "ipm2026",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Navigate to event locations at IPM 2026",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Track your path through the IPM grounds"
      },
      config: {
        googleMapsApiKey: "GOOGLE_MAPS_API_KEY_PLACEHOLDER"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#2D2926"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: "GOOGLE_MAPS_API_KEY_PLACEHOLDER"
        }
      },
      package: "com.mjacquot.ipm2026"
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-build-properties",
        {
          android: {
            extraMavenRepos: [
              "https://api.mapbox.com/downloads/v2/releases/maven"
            ]
          }
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 280,
          resizeMode: "contain",
          backgroundColor: "#2D2926"
        }
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Navigate to event locations at IPM 2026",
          locationWhenInUsePermission: "Navigate to event locations at IPM 2026"
        }
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsImpl: "mapbox",
          RNMapboxMapsDownloadToken: "sk.eyJ1IjoibWphY3F1b3QiLCJhIjoiY21tdmRwcXVuMDJsbjJycHBrcXV6czl3dyJ9.pUiimStUZ4mIXhkErun2MQ"
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "your-project-id"
      }
    }
  }
};
