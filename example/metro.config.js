const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// The local file:.. dependency also has development dependencies. Resolve all
// runtime imports from the example first so React Native is initialized once.
config.watchFolders = [path.resolve(__dirname, "..")];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../node_modules"),
];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
