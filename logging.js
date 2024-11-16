const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, errors, colorize } = format;
const path = require('path');
const fs = require('fs');
const { config } = require('../config');

const logFilePath = config.logFilePath;

const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'grey'
    }
};

if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '');
}

const logFormat = printf(({ level, message, timestamp, stack, callerInfo }) => 
    `${stack || message}\n      ${callerInfo.file}:${callerInfo.line} @ ${timestamp} ${level}`
);

const loggerTransports = [
    new transports.File({
        filename: logFilePath,
        format: combine(
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS', timezone: 'Etc/GMT+5' }),
            errors({ stack: true }),
            logFormat
        )
    })
];

if (process.env.PRINT_TO_CONSOLE === 'true') {
    loggerTransports.push(new transports.Console({
        format: combine(
            colorize({ all: true }),
            logFormat
        )
    }));
}

const logger = createLogger({
    levels: customLevels.levels,
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS', timezone: 'Etc/GMT+5' }),
        errors({ stack: true }),
        logFormat
    ),
    transports: loggerTransports
});

function getCallerFile() {
    const originalFunc = Error.prepareStackTrace;
    try {
        const err = new Error();
        Error.prepareStackTrace = (_, stack) => stack;
        const currentfile = err.stack.shift().getFileName();

        for (const caller of err.stack) {
            const callerfile = caller.getFileName();
            const callerline = caller.getLineNumber();

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
}

require('winston').addColors(customLevels.colors);

function logMessage(level, message) {
    if (!message) {
        throw new Error('Log message is null or undefined');
        return;
    }
    if (!customLevels.levels.hasOwnProperty(level)) {
        throw new Error(`Invalid log level: ${level}`);
    }
    const callerInfo = getCallerFile();
    logger[level]({ message, callerInfo });
}

const log = (message) => logMessage('info', message);

['info', 'error', 'warn'].forEach(level => {
    log[level] = (message) => logMessage(level, message);
});

module.exports = { log };
