var config = {};

// AWS configurations
config.awsAccess = { "accessKeyId": "[accessId]", "secretAccessKey": "[secretKey]", "region": "[region]" };
config.bucketName = "emg-s3-azure-test";

// Azure Data Lake configurations
config.azureClientId = "[azureClientId]";
config.azureDomain = "[azureDomain]";
config.azureSecret = "[azureSecret]";
config.azureDataLakeAccountName = "[adlAccountName]";

// Local temporary file configurations
config.tempLocalFolder = "./tmp";

module.exports = config;