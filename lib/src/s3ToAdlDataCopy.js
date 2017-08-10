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
        // Initialize clients
        this.awsClient = this.initializeAwsClient(this.awsAccessKeyId, this.awsAccessSecretKey, this.awsRegion);
        this.adlClient = this.initializeAdlClient(this.azureClientId, this.azureDomain, this.azureSecret);
    }
    handler() {
        return __awaiter(this, void 0, void 0, function* () {
            // create temp directory with cache directory inside to download files from s3 and upload it to ADL.
            // In the end of the run the cache directory will be deleted.
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            this.tempFolder += "/cache";
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            const awsModule = new awsS3Module_1.AwsS3Module(this.awsBucketName, this.tempFolder, this.awsClient);
            const adlModule = new azureDataLakeModule_1.AzureDataLakeModule(this.azureAdlAccountName, this.tempFolder, this.adlClient);
            const redisModule = this.useRedis ? new redisModule_1.RedisModule() : null;
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
            let batchNumber = 1;
            do {
                logger_1.winston.info(`Processing batch #${batchNumber}`);
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
                    batchNumber++;
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUksY0FBYyxDQUFDLDZCQUE2QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ1osZ0JBQU8sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDdkQsTUFBTSxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBcktELDBDQXFLQyIsImZpbGUiOiJzcmMvczNUb0FkbERhdGFDb3B5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXN5bmMgZnJvbSBcImFzeW5jXCI7XHJcbmltcG9ydCAqIGFzIHBhcmFsbGVsIGZyb20gXCJhc3luYy1hd2FpdC1wYXJhbGxlbFwiO1xyXG5pbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuaW1wb3J0ICogYXMgYWRsc01hbmFnZW1lbnQgZnJvbSBcImF6dXJlLWFybS1kYXRhbGFrZS1zdG9yZVwiO1xyXG5pbXBvcnQgKiBhcyBtc3Jlc3RBenVyZSBmcm9tIFwibXMtcmVzdC1henVyZVwiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IEF3c1MzTW9kdWxlIH0gZnJvbSBcIi4vYXdzUzNNb2R1bGVcIjtcclxuaW1wb3J0IHsgQXp1cmVEYXRhTGFrZU1vZHVsZSB9IGZyb20gXCIuL2F6dXJlRGF0YUxha2VNb2R1bGVcIjtcclxuaW1wb3J0IHsgY3JlYXRlRGlySWZOb3RFeGlzdHMsIGRlbGV0ZUZpbGUsIGRlbGV0ZUZvbGRlciwgZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkgfSBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5pbXBvcnQgeyB3aW5zdG9uIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XHJcbmltcG9ydCB7IFJlZGlzTW9kdWxlLCBSZWRpc09iamVjdCB9IGZyb20gXCIuL3JlZGlzTW9kdWxlXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgUzNUb0FkbERhdGFDb3B5IHtcclxuICBwdWJsaWMgYXdzQ2xpZW50OiBBV1MuUzM7XHJcbiAgcHVibGljIGFkbENsaWVudDogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQ7XHJcbiAgcHVibGljIGF3c0J1Y2tldE5hbWU6IHN0cmluZztcclxuICBwdWJsaWMgYXp1cmVBZGxBY2NvdW50TmFtZTogc3RyaW5nO1xyXG5cclxuICBwcml2YXRlIGNvbmN1cnJlbmN5TnVtYmVyID0gcHJvY2Vzcy5lbnYuQ09OQ1VSUkVOQ1lfTlVNQkVSIHx8IDEwO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc1NlY3JldEtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzUmVnaW9uOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUNsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZURvbWFpbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVTZWNyZXQ6IHN0cmluZztcclxuICBwcml2YXRlIHVzZVJlZGlzOiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMudmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpO1xyXG5cclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHByb2Nlc3MuZW52LlRFTVBfRk9MREVSO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NLZXlJZCA9IHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXkgPSBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVk7XHJcbiAgICB0aGlzLmF3c1JlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT047XHJcbiAgICB0aGlzLmF3c0J1Y2tldE5hbWUgPSBwcm9jZXNzLmVudi5BV1NfQlVDS0VUX05BTUU7XHJcbiAgICB0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUgPSBwcm9jZXNzLmVudi5BWlVSRV9BRExfQUNDT1VOVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUNsaWVudElkID0gcHJvY2Vzcy5lbnYuQVpVUkVfQ0xJRU5UX0lEO1xyXG4gICAgdGhpcy5henVyZURvbWFpbiA9IHByb2Nlc3MuZW52LkFaVVJFX0RPTUFJTjtcclxuICAgIHRoaXMuYXp1cmVTZWNyZXQgPSBwcm9jZXNzLmVudi5BWlVSRV9TRUNSRVQ7XHJcbiAgICB0aGlzLnVzZVJlZGlzID0gcHJvY2Vzcy5lbnYuVVNFX1JFRElTICE9PSB1bmRlZmluZWQgPyBwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA6IGZhbHNlO1xyXG5cclxuICAgIC8vIEluaXRpYWxpemUgY2xpZW50c1xyXG4gICAgdGhpcy5hd3NDbGllbnQgPSB0aGlzLmluaXRpYWxpemVBd3NDbGllbnQodGhpcy5hd3NBY2Nlc3NLZXlJZCwgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXksIHRoaXMuYXdzUmVnaW9uKTtcclxuICAgIHRoaXMuYWRsQ2xpZW50ID0gdGhpcy5pbml0aWFsaXplQWRsQ2xpZW50KHRoaXMuYXp1cmVDbGllbnRJZCwgdGhpcy5henVyZURvbWFpbiwgdGhpcy5henVyZVNlY3JldCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgIC8vIGNyZWF0ZSB0ZW1wIGRpcmVjdG9yeSB3aXRoIGNhY2hlIGRpcmVjdG9yeSBpbnNpZGUgdG8gZG93bmxvYWQgZmlsZXMgZnJvbSBzMyBhbmQgdXBsb2FkIGl0IHRvIEFETC5cclxuICAgIC8vIEluIHRoZSBlbmQgb2YgdGhlIHJ1biB0aGUgY2FjaGUgZGlyZWN0b3J5IHdpbGwgYmUgZGVsZXRlZC5cclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgKz0gXCIvY2FjaGVcIjtcclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcblxyXG4gICAgY29uc3QgYXdzTW9kdWxlID0gbmV3IEF3c1MzTW9kdWxlKHRoaXMuYXdzQnVja2V0TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCB0aGlzLmF3c0NsaWVudCk7XHJcbiAgICBjb25zdCBhZGxNb2R1bGUgPSBuZXcgQXp1cmVEYXRhTGFrZU1vZHVsZSh0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUsIHRoaXMudGVtcEZvbGRlciwgdGhpcy5hZGxDbGllbnQpO1xyXG4gICAgY29uc3QgcmVkaXNNb2R1bGUgPSB0aGlzLnVzZVJlZGlzID8gbmV3IFJlZGlzTW9kdWxlKCkgOiBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcIlVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKFwiTm90IHVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMuYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NNb2R1bGUsIGFkbE1vZHVsZSwgcmVkaXNNb2R1bGUpO1xyXG5cclxuICAgIC8vIEFmdGVyIGFsbCB1cGxvYWRzIGFyZSBjb21wbGV0ZWQsIGRlbGV0ZSB0aGUgY2FjaGUgZGlyZWN0b3J5IGFuZCBpdHMgc3ViIGRpcmVjdG9yaWVzLlxyXG4gICAgZGVsZXRlRm9sZGVyKHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB3aW5zdG9uLmluZm8oXCJhbGwgZG9uZVwiKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICBHbyBvdmVyIHRoZSBpdGVtcyBpbiBTMyBpbiBiYXRjaGVzIG9mIDEwMDAuXHJcbiAgICogIEZvciBlYWNoIGZpbGUgaW4gYmF0Y2ggY2hlY2sgaWYgaXQgaXMgbWlzc2luZyBmcm9tIEFETCBsYWtlLCBpZiBzbyBkb3dubG9hZCBpdCB0byB0ZW1wIGRpcmVjdG9yeSBhbmQgdXBsb2FkIHRvIEFETC5cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NTM01vZHVsZTogQXdzUzNNb2R1bGUsIGFkbE1vZHVsZTogQXp1cmVEYXRhTGFrZU1vZHVsZSwgcmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBsZXQgYXdzT2JqZWN0c091dHB1dDogQVdTLlMzLkxpc3RPYmplY3RzT3V0cHV0O1xyXG4gICAgbGV0IG1hcmtlciA9IFwiXCI7XHJcbiAgICBsZXQgYmF0Y2hOdW1iZXIgPSAxO1xyXG4gICAgZG8ge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYFByb2Nlc3NpbmcgYmF0Y2ggIyR7YmF0Y2hOdW1iZXJ9YCk7XHJcbiAgICAgIGF3c09iamVjdHNPdXRwdXQgPSBhd2FpdCBhd3NTM01vZHVsZS5saXN0QWxsT2JqZWN0cyhtYXJrZXIpO1xyXG5cclxuICAgICAgaWYgKGF3c09iamVjdHNPdXRwdXQgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cyAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBsZXQgYXdzT2JqZWN0cyA9IGF3c09iamVjdHNPdXRwdXQuQ29udGVudHM7XHJcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgZGlyZWN0b3JpZXMgbmFtZXMgLSBhd3MubGlzdE9iamVjdHMgcmV0dXJucyBhbGwgZmlsZXMgaW4gdGhlIGJ1Y2tldCBpbmNsdWRpbmcgZGlyZWN0b3JpZXMgbmFtZXNcclxuICAgICAgICBhd3NPYmplY3RzID0gYXdzT2JqZWN0cy5maWx0ZXIoKG9iaikgPT4gIW9iai5LZXkuZW5kc1dpdGgoXCIvXCIpKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJvbWlzZUFycmF5ID0gYXdzT2JqZWN0cy5tYXAoa2V5ID0+IHtcclxuICAgICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuc2hvdWxkVXBsb2FkRmlsZShyZWRpc01vZHVsZSwgYWRsTW9kdWxlLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhd3NTM01vZHVsZS5kb3dubG9hZEZpbGVGcm9tUzMoa2V5KTtcclxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBGaWxlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgaW4gQURMIG9yIGlmIGEgbmV3IHZlcnNpb24gb2YgdGhlIGZpbGUgZXhpc3RzIGluIFMzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhZGxNb2R1bGUudXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShrZXkuS2V5KTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUocGF0aC5qb2luKHRoaXMudGVtcEZvbGRlciwga2V5LktleSkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHJlZGlzIHdpdGggdGhlIG5ldyBmaWxlXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VSZWRpcykge1xyXG4gICAgICAgICAgICAgICAgICBhd2FpdCByZWRpc01vZHVsZS5hZGRGaWxlVG9SZWRpcyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciB3YXMgdGhyb3duIHdoaWxlIHdvcmtpbmcgb24gZWxlbWVudCAke2tleS5LZXl9ICR7ZXh9YCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBhd2FpdCBwYXJhbGxlbChwcm9taXNlQXJyYXksIHRoaXMuY29uY3VycmVuY3lOdW1iZXIpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGV4KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG1hcmtlciA9IGF3c09iamVjdHNbYXdzT2JqZWN0cy5sZW5ndGggLSAxXS5LZXk7XHJcbiAgICAgICAgYmF0Y2hOdW1iZXIrKztcclxuICAgICAgfVxyXG4gICAgfSB3aGlsZSAoYXdzT2JqZWN0c091dHB1dC5Jc1RydW5jYXRlZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNob3VsZFVwbG9hZEZpbGUocmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUsIGtleTogQVdTLlMzLk9iamVjdCkge1xyXG4gICAgbGV0IHNob3VsZFVwbG9hZEZpbGU6IGJvb2xlYW47XHJcblxyXG4gICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgbGV0IG9iajogUmVkaXNPYmplY3QgPSBhd2FpdCByZWRpc01vZHVsZS5pc0ZpbGVJblJlZGlzKGtleSk7XHJcbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcclxuICAgICAgICAvLyBPYmplY3QgaXMgbm90IGluIHJlZGlzIC0gY2hlY2sgaW4gQURMIGlmIGl0IHNob3VsZCBiZSB1cGxvYWQgYW5kIHVwZGF0ZSByZWRpcyBhbnl3YXlcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICAgICAgYXdhaXQgcmVkaXNNb2R1bGUuYWRkRmlsZVRvUmVkaXMoa2V5KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBDaGVjayBpZiBmaWxlIHdhcyBtb2RpZmllZCBzaW5jZSB0aGUgbGFzdCB0aW1lIGl0IHdhcyB1cGxvYWRlZFxyXG4gICAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBvYmouRVRhZyAhPT0ga2V5LkVUYWc7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBhd2FpdCBhZGxNb2R1bGUuc2hvdWxkVXBsb2FkVG9BREwoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc2hvdWxkVXBsb2FkRmlsZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IHZhcmlhYmxlc0xpc3QgPSBbXCJBV1NfQUNDRVNTX0tFWV9JRFwiLCBcIkFXU19TRUNSRVRfQUNDRVNTX0tFWVwiLCBcIkFXU19SRUdJT05cIiwgXCJBV1NfQlVDS0VUX05BTUVcIixcclxuICAgICAgXCJBWlVSRV9DTElFTlRfSURcIiwgXCJBWlVSRV9ET01BSU5cIiwgXCJBWlVSRV9TRUNSRVRcIiwgXCJBWlVSRV9BRExfQUNDT1VOVF9OQU1FXCIsIFwiVEVNUF9GT0xERVJcIl07XHJcblxyXG4gICAgdmFyaWFibGVzTGlzdC5mb3JFYWNoKCh2YXJpYWJsZSkgPT4ge1xyXG4gICAgICBpZiAoIXByb2Nlc3MuZW52W3ZhcmlhYmxlXSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgJHt2YXJpYWJsZX0gaXMgbm90IGRlZmluZWRgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdKSB7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcInRydWVcIiAmJiBwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcImZhbHNlXCIpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVudmlyb25tZW50IFZhcmlhYmxlIFVTRV9SRURJUyBzaG91bGQgY29udGFpbiBib29sZWFuIHZhbHVlYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBd3NDbGllbnQoYWNjZXNzS2V5SWQ6IHN0cmluZywgc2VjcmV0QWNjZXNzS2V5OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nKTogQVdTLlMzIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgIHJldHVybiBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYGVycm9yIGluaXRpYWxpemluZyBzMyBjbGllbnQ6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQWRsQ2xpZW50KGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZyk6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICByZXR1cm4gbmV3IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KGNyZWRlbnRpYWxzKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
