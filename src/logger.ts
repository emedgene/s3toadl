import * as path from "path";
import { transports, Logger } from "winston";

const tempFolder = process.env.TEMP_FOLDER || ".";

export let winston = new Logger({
  transports: [
    new transports.Console(),
    new transports.File({
      filename: tempFolder + "/logfile.log",
    }),
  ],
});

winston.remove(transports.Console);
winston.add(transports.Console, {
  timestamp: true,
  level: "verbose",
  colorize: true,
});