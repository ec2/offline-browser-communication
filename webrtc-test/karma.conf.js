const testFile = process.env.TEST_FILE

module.exports = function(config) {
  config.set({
    frameworks: ["mocha", "chai", "webpack"],
    files: [
      testFile
    ],
    preprocessors: {
      '*.mjs': ['webpack']
    },
    webpack: {},
    reporters: ["progress"],
    browsers: ["ChromeHeadless"],
    singleRun: true,
  });
};