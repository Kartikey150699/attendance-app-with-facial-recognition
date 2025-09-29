module.exports = function override(config, env) {
  // Ignore Mediapipe source map warnings
  config.ignoreWarnings = [
    ...(config.ignoreWarnings || []),
    {
      module: /@mediapipe\/tasks-vision/,
      message: /Failed to parse source map/,
    },
  ];
  return config;
};