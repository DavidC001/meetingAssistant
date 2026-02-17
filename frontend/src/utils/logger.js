/* eslint-disable no-console */

const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  debug: (...args) => {
    if (!isProduction) console.debug(...args);
  },
  info: (...args) => {
    if (!isProduction) console.info(...args);
  },
  log: (...args) => {
    if (!isProduction) console.log(...args);
  },
  warn: (...args) => {
    if (!isProduction) console.warn(...args);
  },
  error: (...args) => {
    if (!isProduction) console.error(...args);
  },
};

export default logger;
