var async = require('async');
var awsS3Module = require('./awsS3Module');
var config = require('./config');
var adlModule = require('./azureDataLakeModule');
var filesHelper = require('./filesHelper');
var rimraf = require('rimraf');

function handler() {
  // create temp directory to download files from s3 and upload it to ADL.
  // In the end of the run this directory will be deleted.
  var dir = filesHelper.createDirIfNotExists(null, null, config.tempLocalFolder);

  // get all existing files in S3 bucket
  awsS3Module.listAllObjects(null, function (error, awsObjects) {
    if (error) {
      return console.error(error);
    }

    // Filter out the directories names - aws.listObjects returns all files in the bucket including directories names
    awsObjects = awsObjects.filter(obj => !obj.Key.endsWith("/"));

    // Iterate over all files in S3
    async.each(awsObjects, function (key, callback) {
      console.log(key.Key);

      // Check if file exists in Azure data lake 
      adlModule.shouldUploadToADL(key).then(shouldUploadFile => {
        // Upload File if it doesn't exist in ADL or if a new version of the file exists in S3 
        if (shouldUploadFile) { 
          awsS3Module.downloadFileFromS3(key).then(() => {
            // When finished downloading file from s3 - start uploading it to ADL
            adlModule.uploadFileToAzureDataLake(key.Key).then(() => {
              callback();
            })
          });
        } else {
          callback();
        }
      });
    }, function () {
      // After all uploads are completed, delete the temp directory and its sub directories.
      rimraf(config.tempLocalFolder, (err) => {
        if (err) {
          console.log(err);
        }
        console.log("all done");
      });
    })
  })
}


handler();