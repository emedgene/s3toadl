var fs = require('fs');

// Return the names of all the directories in the file path 
// Example: for dir1/dir2/dir3/filename return [dir1, dir2, dir3];
exports.getDirectoriesPathArray = function (filePath) {
    var filePathArray = filePath.split("/");
    return filePathArray.slice(0, filePathArray.length - 1);
}

// Create directory if it not exist.
// Create it by path and directory name, or by the full path.
exports.createDirIfNotExists = function (path, dirName, fullPath) {
    var fullPath = fullPath || path + "/" + dirName;
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath);
    }

    return fullPath;
}