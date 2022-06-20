const testFile = process.env.TEST_FILE;
const browser = process.env.BROWSER;

module.exports = function (config) {
  config.set({
    frameworks: ["mocha", "chai", "webpack"],
    files: [testFile],
    preprocessors: {
      "*.mjs": ["webpack"],
    },
    webpack: {},
    browserConsoleLogOptions: {
      level: "log",
    },
    client: {
      captureConsole: true,
    },
    colors: false,
    logLevel: config.LOG_INFO,
    reporters: ["progress"],
    browsers: [browser],
    customLaunchers: {
      Firefox101: {
          base: 'Firefox',
          name: 'Firefox101',
          command: '/Applications/Firefox101.app/Contents/MacOS/firefox-bin'
      },
      FirefoxDefaultHeadless: {
        base: 'FirefoxHeadless',
        prefs: {
          'dom.min_background_timeout_value': 10000,
          'dom.suspend_inactive.enabled': false,
        }
      },
    },
    singleRun: true,
    browserNoActivityTimeout: 600000,
    browserDisconnectTimeout: 20000,
    flags: [
      '--disable-gpu',
      '--no-sandbox'
  ],
  });
};
