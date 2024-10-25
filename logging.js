
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors } = format;
const path = require('path');
const fs = require('fs');

const logFilePath = path.join(__dirname, '../server.log');
const successLogFilePath = path.join(__dirname, '../success.log');

if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '');
    console.log(`Log file created: ${logFilePath}`);
    log('Log file created');
}

if (!fs.existsSync(successLogFilePath)) {
    fs.writeFileSync(successLogFilePath, '');
    console.log(`Success log file created: ${successLogFilePath}`);
    log('Success log file created');
}

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${level} \x1b[34m${timestamp}\x1b[0m ${stack || message}`;
});

const loggerTransports = [
    new transports.File({ filename: logFilePath })
];

if (process.env.PRINT_TO_CONSOLE === 'true') {
    loggerTransports.push(new transports.Console({ format: combine(format.colorize(), logFormat) }));
}

const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        errors({ stack: true }),
        logFormat
    ),
    transports: loggerTransports
});

const successLoggerTransports = [
    new transports.File({ filename: successLogFilePath })
];

if (process.env.PRINT_TO_CONSOLE === 'true') {
    successLoggerTransports.push(new transports.Console({ format: combine(format.colorize(), logFormat) }));
}

const successLogger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: successLoggerTransports
});

function getCallerFile() {
    const originalFunc = Error.prepareStackTrace;
    let callerfile;
    let callerline;
    try {
        const err = new Error();
        Error.prepareStackTrace = function (err, stack) { return stack; };
        const currentfile = err.stack.shift().getFileName();

        while (err.stack.length) {
            const caller = err.stack.shift();
            callerfile = caller.getFileName();
            callerline = caller.getLineNumber();

            if (currentfile !== callerfile) {
                const rootPath = path.resolve(__dirname, '../../');
                const relativePath = path.relative(rootPath, callerfile);
                return { file: relativePath, line: callerline };
            }
        }
    } catch (err) {
        console.error(`Error getting caller file: ${err.message}`);
    } finally {
        Error.prepareStackTrace = originalFunc;
    }
    return
    // 'not called through file';
}

async function log(message) {
    if (!message) {
        console.error('Log message is null or undefined');
        return;
    }
    const callerInfo = getCallerFile();
    await logger.info(`\x1b[90m${callerInfo.file}: ${callerInfo.line}\x1b[0m\n${message}`);
}

async function successLog(message) {
    if (!message) {
        console.error('Success log message is null or undefined');
        return;
    }
    await successLogger.info(message);
}

const logIncomingRequest = async (req, res, next) => {
    const start = Date.now();
    await log(`Incoming request: ${req.method} ${req.url}`);
    res.on('finish', async () => {
      const duration = Date.now() - start;
      await log(
        `${req.method} ${req.url} ${res.statusCode} ${res.statusMessage}; ${duration}ms`
      );
    });
    next();
};

module.exports = { log, successLog, logIncomingRequest };
