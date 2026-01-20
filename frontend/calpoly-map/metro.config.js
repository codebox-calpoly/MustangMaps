const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Treat .geojson files as assets (so Metro doesn't parse them as JS)
config.resolver.assetExts = [...config.resolver.assetExts, "geojson"];

module.exports = config;
