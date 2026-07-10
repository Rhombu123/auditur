const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Keep server-only PDF parsing code out of the mobile bundle.
config.resolver.blockList = [
  /\/api\/.*/,
  /\/lib\/extract-pdf-text\.ts$/,
  /\/lib\/db\/.*/,
  /\/lib\/supabase\/admin\.ts$/,
];

module.exports = config;
