import * as fs from "fs";
import * as winston from "winston";

/**
 * Return the names of all the directories in the file path
 * Example: for dir1/dir2/dir3/filename return [dir1, dir2, dir3];
 */
export function getDirectoriesPathArray(filePath: string): string[] {
    const filePathArray = filePath.split("/");
    return filePathArray.slice(0, filePathArray.length - 1);
}

/**
 * Create directory if it not exist.
 * Create it by path and directory name, or by the full path.
 */
export function createDirIfNotExists(path?: string, dirName?: string, fullFilePath?: string): void {
    const fullPath = fullFilePath || path + "/" + dirName;

    if (!fs.existsSync(fullPath)) {
        winston.log("info", "Creating directory %s", fullPath);
        fs.mkdirSync(fullPath);
    }
}
