var adlsManagement = require("azure-arm-datalake-store");
var config = require('./config');
var filesHelper = require('./filesHelper');
var fs = require('fs');
var msrestAzure = require('ms-rest-azure');

// Azure configuration
//user authentication - Change to service principal authentication
var credentials = new msrestAzure.ApplicationTokenCredentials(config.azureClientId, config.azureDomain, config.azureSecret);
var filesystemClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
var accountName = config.azureDataLakeAccountName;

// Checks if aws file exists in ADL, or if S3 holds a newer version of file
exports.shouldUploadToADL = function (awsFile) {
  var fileFullName = awsFile.Key;
  return filesystemClient.fileSystem.getFileStatus(accountName, fileFullName).then(file => {
    console.log("file: " + fileFullName + " exists in data lake");

    // If file exist in Azure Data Lake but it's been updated in aws - upload it again
    if (file.fileStatus.modificationTime < awsFile.LastModified.getTime()) {
      return true;
    }

    return false;
  }).catch((ex) => {
    console.log("file: " + fileFullName + " doesn't exists in ADL");
    return true;
  });
}

// upload local file to ADL.
// Validates that all directories in the file path exists in ADL files system - if not create the missing directories
exports.uploadFileToAzureDataLake = function (filePath) {
  var directoriesList = filesHelper.getDirectoriesPathArray(filePath);
  var localFilePath = config.tempLocalFolder + "/" + filePath;

  // Create folders in ADL if needed
  return filesystemClient.fileSystem.mkdirs(accountName, directoriesList.join("/")).then(() => {
    var options = {
      streamContents: fs.createReadStream(localFilePath),
      overwrite: true
    };

    return new Promise((resolve, reject) => {
      // Upload file to Azure Data Lake
      filesystemClient.fileSystem.create(accountName, filePath, options, function (err, result, request, response) {
        if (err) {
          console.log(err);
          return reject(err);
        } else {
          console.log('Upload file ' + filePath + ' successfully');

          // Delete local file
          fs.unlinkSync(localFilePath);
          return resolve();
        }
      });
    });
  })
}