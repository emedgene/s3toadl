"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const parallel = require("async-await-parallel");
const AWS = require("aws-sdk");
const adlsManagement = require("azure-arm-datalake-store");
const msrestAzure = require("ms-rest-azure");
const path = require("path");
const awsS3Module_1 = require("./awsS3Module");
const azureDataLakeModule_1 = require("./azureDataLakeModule");
const filesHelper_1 = require("./filesHelper");
const logger_1 = require("./logger");
const redisModule_1 = require("./redisModule");
class S3ToAdlDataCopy {
    constructor() {
        this.copyProperties = { batchNumber: 0, uploadedCount: 0 };
        this.concurrencyNumber = process.env.CONCURRENCY_NUMBER || 10;
        this.validateEnvironmentVariables();
        this.tempFolder = process.env.TEMP_FOLDER;
        this.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
        this.awsAccessSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
        this.awsRegion = process.env.AWS_REGION;
        this.awsBucketName = process.env.AWS_BUCKET_NAME;
        this.azureAdlAccountName = process.env.AZURE_ADL_ACCOUNT_NAME;
        this.azureClientId = process.env.AZURE_CLIENT_ID;
        this.azureDomain = process.env.AZURE_DOMAIN;
        this.azureSecret = process.env.AZURE_SECRET;
        this.useRedis = process.env.USE_REDIS !== undefined ? process.env["USE_REDIS"].toLowerCase() === "true" : false;
        this.redisPort = process.env.REDIS_PORT || "6379";
        this.redisHost = process.env.REDIS_HOST || "redis";
        // Initialize clients
        this.awsClient = this.initializeAwsClient(this.awsAccessKeyId, this.awsAccessSecretKey, this.awsRegion);
        this.adlClient = this.initializeAdlClient(this.azureClientId, this.azureDomain, this.azureSecret);
    }
    handler(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            // create temp directory with cache directory inside to download files from s3 and upload it to ADL.
            // In the end of the run the cache directory will be deleted.
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            this.tempFolder += "/cache";
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            const awsModule = new awsS3Module_1.AwsS3Module(this.awsBucketName, this.tempFolder, this.awsClient);
            const adlModule = new azureDataLakeModule_1.AzureDataLakeModule(this.azureAdlAccountName, this.tempFolder, this.adlClient);
            const redisModule = this.useRedis ? new redisModule_1.RedisModule(this.redisPort, this.redisHost) : null;
            if (this.useRedis) {
                logger_1.winston.info("Using Redis");
            }
            else {
                logger_1.winston.info("Not using Redis");
            }
            yield this.batchIterationOverS3Items(awsModule, adlModule, redisModule);
            // After all uploads are completed, delete the cache directory and its sub directories.
            filesHelper_1.deleteFolder(this.tempFolder);
            logger_1.winston.info("all done");
            cb();
        });
    }
    /**
     *  Go over the items in S3 in batches of 1000.
     *  For each file in batch check if it is missing from ADL lake, if so download it to temp directory and upload to ADL.
     */
    batchIterationOverS3Items(awsS3Module, adlModule, redisModule) {
        return __awaiter(this, void 0, void 0, function* () {
            let awsObjectsOutput;
            let marker = "";
            this.copyProperties.batchNumber = 1;
            do {
                logger_1.winston.info(`Processing batch #${this.copyProperties.batchNumber}`);
                awsObjectsOutput = yield awsS3Module.listAllObjects(marker);
                if (awsObjectsOutput && awsObjectsOutput.Contents && awsObjectsOutput.Contents.length > 0) {
                    let awsObjects = awsObjectsOutput.Contents;
                    // Filter out the directories names - aws.listObjects returns all files in the bucket including directories names
                    awsObjects = awsObjects.filter((obj) => !obj.Key.endsWith("/"));
                    const promiseArray = awsObjects.map(key => {
                        return () => __awaiter(this, void 0, void 0, function* () {
                            try {
                                if (yield this.shouldUploadFile(redisModule, adlModule, key)) {
                                    yield awsS3Module.downloadFileFromS3(key);
                                    // Upload File if it doesn't exist in ADL or if a new version of the file exists in S3
                                    yield adlModule.uploadFileToAzureDataLake(key.Key);
                                    this.copyProperties.uploadedCount++;
                                    yield filesHelper_1.deleteFile(path.join(this.tempFolder, key.Key));
                                    // Update redis with the new file
                                    if (this.useRedis) {
                                        yield redisModule.addFileToRedis(key);
                                    }
                                }
                            }
                            catch (ex) {
                                logger_1.winston.error(`error was thrown while working on element ${key.Key} ${ex}`);
                                return null;
                            }
                        });
                    });
                    try {
                        yield parallel(promiseArray, this.concurrencyNumber);
                    }
                    catch (ex) {
                        logger_1.winston.error(ex);
                    }
                    marker = awsObjects[awsObjects.length - 1].Key;
                    this.copyProperties.batchNumber++;
                }
            } while (awsObjectsOutput.IsTruncated);
        });
    }
    shouldUploadFile(redisModule, adlModule, key) {
        return __awaiter(this, void 0, void 0, function* () {
            let shouldUploadFile;
            if (this.useRedis) {
                let obj = yield redisModule.isFileInRedis(key);
                if (obj === null) {
                    // Object is not in redis - check in ADL if it should be upload and update redis anyway
                    shouldUploadFile = yield adlModule.shouldUploadToADL(key);
                    yield redisModule.addFileToRedis(key);
                }
                else {
                    // Check if file was modified since the last time it was uploaded
                    shouldUploadFile = obj.ETag !== key.ETag;
                }
            }
            else {
                shouldUploadFile = yield adlModule.shouldUploadToADL(key);
            }
            return shouldUploadFile;
        });
    }
    validateEnvironmentVariables() {
        const variablesList = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME",
            "AZURE_CLIENT_ID", "AZURE_DOMAIN", "AZURE_SECRET", "AZURE_ADL_ACCOUNT_NAME", "TEMP_FOLDER"];
        variablesList.forEach((variable) => {
            if (!process.env[variable]) {
                throw new Error(`Environment Variable ${variable} is not defined`);
            }
        });
        if (process.env["USE_REDIS"]) {
            if (process.env["USE_REDIS"].toLowerCase() !== "true" && process.env["USE_REDIS"].toLowerCase() !== "false") {
                throw new Error(`Environment Variable USE_REDIS should contain boolean value`);
            }
        }
    }
    initializeAwsClient(accessKeyId, secretAccessKey, region) {
        try {
            const config = { accessKeyId, secretAccessKey, region };
            return new AWS.S3(config);
        }
        catch (ex) {
            logger_1.winston.info(`error initializing s3 client: ${ex}`);
            throw ex;
        }
    }
    initializeAdlClient(clientId, domain, secret) {
        try {
            const credentials = new msrestAzure.ApplicationTokenCredentials(clientId, domain, secret);
            return new adlsManagement.DataLakeStoreFileSystemClient(credentials);
        }
        catch (ex) {
            logger_1.winston.error(`error initializing Azure client ${ex}`);
            throw ex;
        }
    }
}
exports.S3ToAdlDataCopy = S3ToAdlDataCopy;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zM1RvQWRsRGF0YUNvcHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLGlEQUFpRDtBQUNqRCwrQkFBK0I7QUFDL0IsMkRBQTJEO0FBQzNELDZDQUE2QztBQUM3Qyw2QkFBNkI7QUFDN0IsK0NBQTRDO0FBQzVDLCtEQUE0RDtBQUM1RCwrQ0FBd0c7QUFDeEcscUNBQW1DO0FBQ25DLCtDQUF5RDtBQUV6RDtJQW1CRTtRQWRPLG1CQUFjLEdBQThDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRSxhQUFhLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFFaEcsc0JBQWlCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLENBQUM7UUFhL0QsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7UUFFcEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQztRQUMxQyxJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7UUFDcEQsSUFBSSxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUM7UUFDNUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQztRQUN4QyxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDO1FBQ2pELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixDQUFDO1FBQzlELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUM7UUFDakQsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztRQUM1QyxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1FBQzVDLElBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEtBQUssU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsV0FBVyxFQUFFLEtBQUssTUFBTSxHQUFHLEtBQUssQ0FBQztRQUNoSCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQztRQUNsRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLE9BQU8sQ0FBQztRQUVuRCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDcEcsQ0FBQztJQUVZLE9BQU8sQ0FBQyxFQUFFOztZQUNyQixvR0FBb0c7WUFDcEcsNkRBQTZEO1lBQzdELGtDQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxVQUFVLElBQUksUUFBUSxDQUFDO1lBQzVCLGtDQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBRWxELE1BQU0sU0FBUyxHQUFHLElBQUkseUJBQVcsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZGLE1BQU0sU0FBUyxHQUFHLElBQUkseUNBQW1CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3JHLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztZQUUzRixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsZ0JBQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDOUIsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLGdCQUFPLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDbEMsQ0FBQztZQUVELE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFFeEUsdUZBQXVGO1lBQ3ZGLDBCQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzlCLGdCQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pCLEVBQUUsRUFBRSxDQUFDO1FBQ1AsQ0FBQztLQUFBO0lBRUQ7OztPQUdHO0lBQ1UseUJBQXlCLENBQUMsV0FBd0IsRUFBRSxTQUE4QixFQUFFLFdBQXdCOztZQUN2SCxJQUFJLGdCQUEwQyxDQUFDO1lBQy9DLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7WUFFcEMsR0FBRyxDQUFDO2dCQUNGLGdCQUFPLENBQUMsSUFBSSxDQUFDLHFCQUFxQixJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7Z0JBQ3JFLGdCQUFnQixHQUFHLE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFNUQsRUFBRSxDQUFDLENBQUMsZ0JBQWdCLElBQUksZ0JBQWdCLENBQUMsUUFBUSxJQUFJLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDMUYsSUFBSSxVQUFVLEdBQUcsZ0JBQWdCLENBQUMsUUFBUSxDQUFDO29CQUMzQyxpSEFBaUg7b0JBQ2pILFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztvQkFFaEUsTUFBTSxZQUFZLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxHQUFHO3dCQUNyQyxNQUFNLENBQUM7NEJBQ0wsSUFBSSxDQUFDO2dDQUNILEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO29DQUM3RCxNQUFNLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQ0FDMUMsc0ZBQXNGO29DQUN0RixNQUFNLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7b0NBQ25ELElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLENBQUM7b0NBQ3BDLE1BQU0sd0JBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0NBQ3RELGlDQUFpQztvQ0FDakMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7d0NBQ2xCLE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQ0FDeEMsQ0FBQztnQ0FDSCxDQUFDOzRCQUNILENBQUM7NEJBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQ0FDWixnQkFBTyxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsR0FBRyxDQUFDLEdBQUcsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dDQUM1RSxNQUFNLENBQUMsSUFBSSxDQUFDOzRCQUNkLENBQUM7d0JBQ0gsQ0FBQyxDQUFBLENBQUM7b0JBQ0osQ0FBQyxDQUFDLENBQUM7b0JBRUgsSUFBSSxDQUFDO3dCQUNILE1BQU0sUUFBUSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztvQkFDdkQsQ0FBQztvQkFBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNwQixDQUFDO29CQUVELE1BQU0sR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7b0JBQy9DLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLENBQUM7Z0JBQ3BDLENBQUM7WUFDSCxDQUFDLFFBQVEsZ0JBQWdCLENBQUMsV0FBVyxFQUFFO1FBQ3pDLENBQUM7S0FBQTtJQUVhLGdCQUFnQixDQUFDLFdBQXdCLEVBQUUsU0FBOEIsRUFBRSxHQUFrQjs7WUFDekcsSUFBSSxnQkFBeUIsQ0FBQztZQUU5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsSUFBSSxHQUFHLEdBQWdCLE1BQU0sV0FBVyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDNUQsRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2pCLHVGQUF1RjtvQkFDdkYsZ0JBQWdCLEdBQUcsTUFBTSxTQUFTLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQzFELE1BQU0sV0FBVyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixpRUFBaUU7b0JBQ2pFLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksQ0FBQztnQkFDM0MsQ0FBQztZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixnQkFBZ0IsR0FBRyxNQUFNLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM1RCxDQUFDO1lBRUQsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQzFCLENBQUM7S0FBQTtJQUVPLDRCQUE0QjtRQUNsQyxNQUFNLGFBQWEsR0FBRyxDQUFDLG1CQUFtQixFQUFFLHVCQUF1QixFQUFFLFlBQVksRUFBRSxpQkFBaUI7WUFDbEcsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSx3QkFBd0IsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUU5RixhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUTtZQUM3QixFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixRQUFRLGlCQUFpQixDQUFDLENBQUM7WUFDckUsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDN0IsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxNQUFNLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDO2dCQUM1RyxNQUFNLElBQUksS0FBSyxDQUFDLDZEQUE2RCxDQUFDLENBQUM7WUFDakYsQ0FBQztRQUNILENBQUM7SUFFSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsV0FBbUIsRUFBRSxlQUF1QixFQUFFLE1BQWM7UUFDdEYsSUFBSSxDQUFDO1lBQ0gsTUFBTSxNQUFNLEdBQUcsRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDWixnQkFBTyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNwRCxNQUFNLEVBQUUsQ0FBQztRQUNYLENBQUM7SUFDSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsTUFBYztRQUMxRSxJQUFJLENBQUM7WUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLE1BQU0sQ0FBQyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTdLRCwwQ0E2S0MiLCJmaWxlIjoic3JjL3MzVG9BZGxEYXRhQ29weS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzeW5jIGZyb20gXCJhc3luY1wiO1xyXG5pbXBvcnQgKiBhcyBwYXJhbGxlbCBmcm9tIFwiYXN5bmMtYXdhaXQtcGFyYWxsZWxcIjtcclxuaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgbXNyZXN0QXp1cmUgZnJvbSBcIm1zLXJlc3QtYXp1cmVcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBBd3NTM01vZHVsZSB9IGZyb20gXCIuL2F3c1MzTW9kdWxlXCI7XHJcbmltcG9ydCB7IEF6dXJlRGF0YUxha2VNb2R1bGUgfSBmcm9tIFwiLi9henVyZURhdGFMYWtlTW9kdWxlXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBkZWxldGVGaWxlLCBkZWxldGVGb2xkZXIsIGdldERpcmVjdG9yaWVzUGF0aEFycmF5IH0gZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBSZWRpc01vZHVsZSwgUmVkaXNPYmplY3QgfSBmcm9tIFwiLi9yZWRpc01vZHVsZVwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFMzVG9BZGxEYXRhQ29weSB7XHJcbiAgcHVibGljIGF3c0NsaWVudDogQVdTLlMzO1xyXG4gIHB1YmxpYyBhZGxDbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50O1xyXG4gIHB1YmxpYyBhd3NCdWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgcHVibGljIGF6dXJlQWRsQWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwdWJsaWMgY29weVByb3BlcnRpZXM6IHsgYmF0Y2hOdW1iZXI6IG51bWJlciwgdXBsb2FkZWRDb3VudDogMCB9ID0geyBiYXRjaE51bWJlcjogMCwgdXBsb2FkZWRDb3VudDogMCB9O1xyXG5cclxuICBwcml2YXRlIGNvbmN1cnJlbmN5TnVtYmVyID0gcHJvY2Vzcy5lbnYuQ09OQ1VSUkVOQ1lfTlVNQkVSIHx8IDEwO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc1NlY3JldEtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzUmVnaW9uOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUNsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZURvbWFpbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVTZWNyZXQ6IHN0cmluZztcclxuICBwcml2YXRlIHVzZVJlZGlzOiBib29sZWFuO1xyXG4gIHByaXZhdGUgcmVkaXNQb3J0OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSByZWRpc0hvc3Q6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLnZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKTtcclxuXHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSBwcm9jZXNzLmVudi5URU1QX0ZPTERFUjtcclxuICAgIHRoaXMuYXdzQWNjZXNzS2V5SWQgPSBwcm9jZXNzLmVudi5BV1NfQUNDRVNTX0tFWV9JRDtcclxuICAgIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5ID0gcHJvY2Vzcy5lbnYuQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZO1xyXG4gICAgdGhpcy5hd3NSZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xyXG4gICAgdGhpcy5hd3NCdWNrZXROYW1lID0gcHJvY2Vzcy5lbnYuQVdTX0JVQ0tFVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUFkbEFjY291bnROYW1lID0gcHJvY2Vzcy5lbnYuQVpVUkVfQURMX0FDQ09VTlRfTkFNRTtcclxuICAgIHRoaXMuYXp1cmVDbGllbnRJZCA9IHByb2Nlc3MuZW52LkFaVVJFX0NMSUVOVF9JRDtcclxuICAgIHRoaXMuYXp1cmVEb21haW4gPSBwcm9jZXNzLmVudi5BWlVSRV9ET01BSU47XHJcbiAgICB0aGlzLmF6dXJlU2VjcmV0ID0gcHJvY2Vzcy5lbnYuQVpVUkVfU0VDUkVUO1xyXG4gICAgdGhpcy51c2VSZWRpcyA9IHByb2Nlc3MuZW52LlVTRV9SRURJUyAhPT0gdW5kZWZpbmVkID8gcHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgOiBmYWxzZTtcclxuICAgIHRoaXMucmVkaXNQb3J0ID0gcHJvY2Vzcy5lbnYuUkVESVNfUE9SVCB8fCBcIjYzNzlcIjtcclxuICAgIHRoaXMucmVkaXNIb3N0ID0gcHJvY2Vzcy5lbnYuUkVESVNfSE9TVCB8fCBcInJlZGlzXCI7XHJcblxyXG4gICAgLy8gSW5pdGlhbGl6ZSBjbGllbnRzXHJcbiAgICB0aGlzLmF3c0NsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUF3c0NsaWVudCh0aGlzLmF3c0FjY2Vzc0tleUlkLCB0aGlzLmF3c0FjY2Vzc1NlY3JldEtleSwgdGhpcy5hd3NSZWdpb24pO1xyXG4gICAgdGhpcy5hZGxDbGllbnQgPSB0aGlzLmluaXRpYWxpemVBZGxDbGllbnQodGhpcy5henVyZUNsaWVudElkLCB0aGlzLmF6dXJlRG9tYWluLCB0aGlzLmF6dXJlU2VjcmV0KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBoYW5kbGVyKGNiKSB7XHJcbiAgICAvLyBjcmVhdGUgdGVtcCBkaXJlY3Rvcnkgd2l0aCBjYWNoZSBkaXJlY3RvcnkgaW5zaWRlIHRvIGRvd25sb2FkIGZpbGVzIGZyb20gczMgYW5kIHVwbG9hZCBpdCB0byBBREwuXHJcbiAgICAvLyBJbiB0aGUgZW5kIG9mIHRoZSBydW4gdGhlIGNhY2hlIGRpcmVjdG9yeSB3aWxsIGJlIGRlbGV0ZWQuXHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgdGhpcy50ZW1wRm9sZGVyICs9IFwiL2NhY2hlXCI7XHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG5cclxuICAgIGNvbnN0IGF3c01vZHVsZSA9IG5ldyBBd3NTM01vZHVsZSh0aGlzLmF3c0J1Y2tldE5hbWUsIHRoaXMudGVtcEZvbGRlciwgdGhpcy5hd3NDbGllbnQpO1xyXG4gICAgY29uc3QgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUodGhpcy5henVyZUFkbEFjY291bnROYW1lLCB0aGlzLnRlbXBGb2xkZXIsIHRoaXMuYWRsQ2xpZW50KTtcclxuICAgIGNvbnN0IHJlZGlzTW9kdWxlID0gdGhpcy51c2VSZWRpcyA/IG5ldyBSZWRpc01vZHVsZSh0aGlzLnJlZGlzUG9ydCwgdGhpcy5yZWRpc0hvc3QpIDogbnVsbDtcclxuXHJcbiAgICBpZiAodGhpcy51c2VSZWRpcykge1xyXG4gICAgICB3aW5zdG9uLmluZm8oXCJVc2luZyBSZWRpc1wiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcIk5vdCB1c2luZyBSZWRpc1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0aGlzLmJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzTW9kdWxlLCBhZGxNb2R1bGUsIHJlZGlzTW9kdWxlKTtcclxuXHJcbiAgICAvLyBBZnRlciBhbGwgdXBsb2FkcyBhcmUgY29tcGxldGVkLCBkZWxldGUgdGhlIGNhY2hlIGRpcmVjdG9yeSBhbmQgaXRzIHN1YiBkaXJlY3Rvcmllcy5cclxuICAgIGRlbGV0ZUZvbGRlcih0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgd2luc3Rvbi5pbmZvKFwiYWxsIGRvbmVcIik7XHJcbiAgICBjYigpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogIEdvIG92ZXIgdGhlIGl0ZW1zIGluIFMzIGluIGJhdGNoZXMgb2YgMTAwMC5cclxuICAgKiAgRm9yIGVhY2ggZmlsZSBpbiBiYXRjaCBjaGVjayBpZiBpdCBpcyBtaXNzaW5nIGZyb20gQURMIGxha2UsIGlmIHNvIGRvd25sb2FkIGl0IHRvIHRlbXAgZGlyZWN0b3J5IGFuZCB1cGxvYWQgdG8gQURMLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBiYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c1MzTW9kdWxlOiBBd3NTM01vZHVsZSwgYWRsTW9kdWxlOiBBenVyZURhdGFMYWtlTW9kdWxlLCByZWRpc01vZHVsZTogUmVkaXNNb2R1bGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGxldCBhd3NPYmplY3RzT3V0cHV0OiBBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ7XHJcbiAgICBsZXQgbWFya2VyID0gXCJcIjtcclxuICAgIHRoaXMuY29weVByb3BlcnRpZXMuYmF0Y2hOdW1iZXIgPSAxO1xyXG5cclxuICAgIGRvIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBQcm9jZXNzaW5nIGJhdGNoICMke3RoaXMuY29weVByb3BlcnRpZXMuYmF0Y2hOdW1iZXJ9YCk7XHJcbiAgICAgIGF3c09iamVjdHNPdXRwdXQgPSBhd2FpdCBhd3NTM01vZHVsZS5saXN0QWxsT2JqZWN0cyhtYXJrZXIpO1xyXG5cclxuICAgICAgaWYgKGF3c09iamVjdHNPdXRwdXQgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cyAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBsZXQgYXdzT2JqZWN0cyA9IGF3c09iamVjdHNPdXRwdXQuQ29udGVudHM7XHJcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgZGlyZWN0b3JpZXMgbmFtZXMgLSBhd3MubGlzdE9iamVjdHMgcmV0dXJucyBhbGwgZmlsZXMgaW4gdGhlIGJ1Y2tldCBpbmNsdWRpbmcgZGlyZWN0b3JpZXMgbmFtZXNcclxuICAgICAgICBhd3NPYmplY3RzID0gYXdzT2JqZWN0cy5maWx0ZXIoKG9iaikgPT4gIW9iai5LZXkuZW5kc1dpdGgoXCIvXCIpKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJvbWlzZUFycmF5ID0gYXdzT2JqZWN0cy5tYXAoa2V5ID0+IHtcclxuICAgICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuc2hvdWxkVXBsb2FkRmlsZShyZWRpc01vZHVsZSwgYWRsTW9kdWxlLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhd3NTM01vZHVsZS5kb3dubG9hZEZpbGVGcm9tUzMoa2V5KTtcclxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBGaWxlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgaW4gQURMIG9yIGlmIGEgbmV3IHZlcnNpb24gb2YgdGhlIGZpbGUgZXhpc3RzIGluIFMzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhZGxNb2R1bGUudXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShrZXkuS2V5KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29weVByb3BlcnRpZXMudXBsb2FkZWRDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgZGVsZXRlRmlsZShwYXRoLmpvaW4odGhpcy50ZW1wRm9sZGVyLCBrZXkuS2V5KSk7XHJcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgcmVkaXMgd2l0aCB0aGUgbmV3IGZpbGVcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHJlZGlzTW9kdWxlLmFkZEZpbGVUb1JlZGlzKGtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIHdhcyB0aHJvd24gd2hpbGUgd29ya2luZyBvbiBlbGVtZW50ICR7a2V5LktleX0gJHtleH1gKTtcclxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGF3YWl0IHBhcmFsbGVsKHByb21pc2VBcnJheSwgdGhpcy5jb25jdXJyZW5jeU51bWJlcik7XHJcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWFya2VyID0gYXdzT2JqZWN0c1thd3NPYmplY3RzLmxlbmd0aCAtIDFdLktleTtcclxuICAgICAgICB0aGlzLmNvcHlQcm9wZXJ0aWVzLmJhdGNoTnVtYmVyKys7XHJcbiAgICAgIH1cclxuICAgIH0gd2hpbGUgKGF3c09iamVjdHNPdXRwdXQuSXNUcnVuY2F0ZWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzaG91bGRVcGxvYWRGaWxlKHJlZGlzTW9kdWxlOiBSZWRpc01vZHVsZSwgYWRsTW9kdWxlOiBBenVyZURhdGFMYWtlTW9kdWxlLCBrZXk6IEFXUy5TMy5PYmplY3QpIHtcclxuICAgIGxldCBzaG91bGRVcGxvYWRGaWxlOiBib29sZWFuO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgIGxldCBvYmo6IFJlZGlzT2JqZWN0ID0gYXdhaXQgcmVkaXNNb2R1bGUuaXNGaWxlSW5SZWRpcyhrZXkpO1xyXG4gICAgICBpZiAob2JqID09PSBudWxsKSB7XHJcbiAgICAgICAgLy8gT2JqZWN0IGlzIG5vdCBpbiByZWRpcyAtIGNoZWNrIGluIEFETCBpZiBpdCBzaG91bGQgYmUgdXBsb2FkIGFuZCB1cGRhdGUgcmVkaXMgYW55d2F5XHJcbiAgICAgICAgc2hvdWxkVXBsb2FkRmlsZSA9IGF3YWl0IGFkbE1vZHVsZS5zaG91bGRVcGxvYWRUb0FETChrZXkpO1xyXG4gICAgICAgIGF3YWl0IHJlZGlzTW9kdWxlLmFkZEZpbGVUb1JlZGlzKGtleSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgZmlsZSB3YXMgbW9kaWZpZWQgc2luY2UgdGhlIGxhc3QgdGltZSBpdCB3YXMgdXBsb2FkZWRcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gb2JqLkVUYWcgIT09IGtleS5FVGFnO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHNob3VsZFVwbG9hZEZpbGU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKSB7XHJcbiAgICBjb25zdCB2YXJpYWJsZXNMaXN0ID0gW1wiQVdTX0FDQ0VTU19LRVlfSURcIiwgXCJBV1NfU0VDUkVUX0FDQ0VTU19LRVlcIiwgXCJBV1NfUkVHSU9OXCIsIFwiQVdTX0JVQ0tFVF9OQU1FXCIsXHJcbiAgICAgIFwiQVpVUkVfQ0xJRU5UX0lEXCIsIFwiQVpVUkVfRE9NQUlOXCIsIFwiQVpVUkVfU0VDUkVUXCIsIFwiQVpVUkVfQURMX0FDQ09VTlRfTkFNRVwiLCBcIlRFTVBfRk9MREVSXCJdO1xyXG5cclxuICAgIHZhcmlhYmxlc0xpc3QuZm9yRWFjaCgodmFyaWFibGUpID0+IHtcclxuICAgICAgaWYgKCFwcm9jZXNzLmVudlt2YXJpYWJsZV0pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVudmlyb25tZW50IFZhcmlhYmxlICR7dmFyaWFibGV9IGlzIG5vdCBkZWZpbmVkYCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXSkge1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSAhPT0gXCJ0cnVlXCIgJiYgcHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSAhPT0gXCJmYWxzZVwiKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFbnZpcm9ubWVudCBWYXJpYWJsZSBVU0VfUkVESVMgc2hvdWxkIGNvbnRhaW4gYm9vbGVhbiB2YWx1ZWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQXdzQ2xpZW50KGFjY2Vzc0tleUlkOiBzdHJpbmcsIHNlY3JldEFjY2Vzc0tleTogc3RyaW5nLCByZWdpb246IHN0cmluZyk6IEFXUy5TMyB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjb25maWcgPSB7IGFjY2Vzc0tleUlkLCBzZWNyZXRBY2Nlc3NLZXksIHJlZ2lvbiB9O1xyXG4gICAgICByZXR1cm4gbmV3IEFXUy5TMyhjb25maWcpO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBlcnJvciBpbml0aWFsaXppbmcgczMgY2xpZW50OiAke2V4fWApO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUFkbENsaWVudChjbGllbnRJZDogc3RyaW5nLCBkb21haW46IHN0cmluZywgc2VjcmV0OiBzdHJpbmcpOiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjcmVkZW50aWFscyA9IG5ldyBtc3Jlc3RBenVyZS5BcHBsaWNhdGlvblRva2VuQ3JlZGVudGlhbHMoY2xpZW50SWQsIGRvbWFpbiwgc2VjcmV0KTtcclxuICAgICAgcmV0dXJuIG5ldyBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudChjcmVkZW50aWFscyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciBpbml0aWFsaXppbmcgQXp1cmUgY2xpZW50ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxufSJdLCJzb3VyY2VSb290IjoiLi4ifQ==
