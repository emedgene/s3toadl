var adlsManagement = require("azure-arm-datalake-store");
var filesHelper = require('./filesHelper');
var fs = require('fs');
var msrestAzure = require('ms-rest-azure');
var winston = require('winston');

// Azure configuration
//user authentication - Change to service principal authentication
var credentials = new msrestAzure.ApplicationTokenCredentials(process.env.AZURE_CLIENT_ID, process.env.AZURE_DOMAIN, process.env.AZURE_SECRET);
var filesystemClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
var accountName = process.env.AZURE_ADL_ACCOUNT_NAME;

// Checks if aws file exists in ADL, or if S3 holds a newer version of file
exports.shouldUploadToADL = function (awsFile) {
  var fileFullName = awsFile.Key;
  return filesystemClient.fileSystem.getFileStatus(accountName, fileFullName).then(file => {
    winston.log('info', "file: %s already exists in data lake", fileFullName);

    // If file exist in Azure Data Lake but it's been updated in aws - upload it again
    if (file.fileStatus.modificationTime < awsFile.LastModified.getTime()) {
      return true;
    }

    return false;
  }).catch((ex) => {
    winston.log('info', "file: %s doesn't exists in ADL", fileFullName);
    return true;
  });
}

// upload local file to ADL.
// Validates that all directories in the file path exists in ADL files system - if not create the missing directories
exports.uploadFileToAzureDataLake = function (filePath) {
  var directoriesList = filesHelper.getDirectoriesPathArray(filePath);
  var localFilePath = process.env.TEMP_FOLDER + "/" + filePath;

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
          winston.error(err);
          return reject(err);
        } else {
          winston.log('info', 'Upload file %s successfully', filePath);

          // Delete local file
          fs.unlinkSync(localFilePath);
          return resolve();
        }
      });
    });
  })
}