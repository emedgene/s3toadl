var AWS = require('aws-sdk');
var config = require('./config');
var s3Client = new AWS.S3(config.awsAccess);
var fs = require('fs');
var filesHelper = require('./filesHelper');
var _ = require('underscore');


allKeys = [];

// Get a list of all files in S3 bucket - including sub directories
exports.listAllObjects = function (marker, callback) {
    s3Client.listObjects({ Bucket: config.bucketName, Marker: marker }, function (error, data) {
        if (error) {
            return callback(error, allKeys)
        }

        allKeys.push(data.Contents);

        if (data.IsTruncated)
            listAllKeys(data.NextMarker, callback);
        else
            callback(error, allKeys[0]);
    });
}

// Download file from S3 to local directory
exports.downloadFileFromS3 = function (awsFile) {
    var params = { Bucket: config.bucketName, Key: awsFile.Key };
    var directoriesList = filesHelper.getDirectoriesPathArray(awsFile.Key);

    var path = config.tempLocalFolder;
    _.each(directoriesList, function (dir) {
        path = filesHelper.createDirIfNotExists(path, dir);
    });

    var file = fs.createWriteStream(config.tempLocalFolder + "/" + awsFile.Key);

    return new Promise((resolve, reject) => {
        s3Client.getObject(params).createReadStream()
            .on('end', () => {
                return resolve();
            })
            .on('error', (error) => {
                return reject(error);
            })
            .pipe(file)
    });
}