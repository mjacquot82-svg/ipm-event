// © 2026 1001538341 ONTARIO INC. All Rights Reserved.

export default {
  expo: {
    name: "IPM 2026",
    slug: "ipm-2026",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "ipm2026",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    jsEngine: "jsc",
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Navigate to event locations at IPM 2026",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Track your path through the IPM grounds"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#F5F5F0"
      },
      edgeToEdgeEnabled: true,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      package: "com.mjacquot.ipm2026"
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-notifications",
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
      ]
      // Note: @rnmapbox/maps requires a development build, not Expo Go
      // Uncomment when building with EAS:
      // [
      //   "@rnmapbox/maps",
      //   {
      //     RNMapboxMapsImpl: "mapbox",
      //     RNMapboxMapsDownloadToken: "sk.eyJ1IjoibWphY3F1b3QiLCJhIjoiY21tdmRwcXVuMDJsbjJycHBrcXV6czl3dyJ9.pUiimStUZ4mIXhkErun2MQ"
      //   }
      // ]
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
