const testFile = process.env.TEST_FILE
const browser = process.env.BROWSER

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
    browserConsoleLogOptions: {
      level: 'log'
    },
    client : {
        captureConsole : true
    },
    colors: false,
    logLevel: config.LOG_INFO,
    reporters: ["progress"],
    browsers: [browser],
    singleRun: true,
    browserNoActivityTimeout: 600000,
  });
};