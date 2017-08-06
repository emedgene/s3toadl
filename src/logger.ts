import { Logger, transports } from 'winston';

export let winston = new Logger({
  transports: [
    new transports.Console(),
    new transports.File ({ filename: process.env.TEMP_FOLDER +'/logfile.log' })
  ]
});

winston.remove(transports.Console);
winston.add(transports.Console, {
  timestamp: true,
  level: 'verbose',
  colorize: true
});