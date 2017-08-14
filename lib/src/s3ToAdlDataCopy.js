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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RSxDQUFDO1lBQ3hELE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDWixnQkFBTyxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNwRCxNQUFNLEVBQUUsQ0FBQztRQUNYLENBQUM7SUFDSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsTUFBYztRQUMxRSxJQUFJLENBQUM7WUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLE1BQU0sQ0FBQyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTVLRCwwQ0E0S0MiLCJmaWxlIjoic3JjL3MzVG9BZGxEYXRhQ29weS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzeW5jIGZyb20gXCJhc3luY1wiO1xyXG5pbXBvcnQgKiBhcyBwYXJhbGxlbCBmcm9tIFwiYXN5bmMtYXdhaXQtcGFyYWxsZWxcIjtcclxuaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgbXNyZXN0QXp1cmUgZnJvbSBcIm1zLXJlc3QtYXp1cmVcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBBd3NTM01vZHVsZSB9IGZyb20gXCIuL2F3c1MzTW9kdWxlXCI7XHJcbmltcG9ydCB7IEF6dXJlRGF0YUxha2VNb2R1bGUgfSBmcm9tIFwiLi9henVyZURhdGFMYWtlTW9kdWxlXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBkZWxldGVGaWxlLCBkZWxldGVGb2xkZXIsIGdldERpcmVjdG9yaWVzUGF0aEFycmF5IH0gZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBSZWRpc01vZHVsZSwgUmVkaXNPYmplY3QgfSBmcm9tIFwiLi9yZWRpc01vZHVsZVwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFMzVG9BZGxEYXRhQ29weSB7XHJcbiAgcHVibGljIGF3c0NsaWVudDogQVdTLlMzO1xyXG4gIHB1YmxpYyBhZGxDbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50O1xyXG4gIHB1YmxpYyBhd3NCdWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgcHVibGljIGF6dXJlQWRsQWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwdWJsaWMgY29weVByb3BlcnRpZXM6IHsgYmF0Y2hOdW1iZXI6IG51bWJlciwgdXBsb2FkZWRDb3VudDogMCB9ID0geyBiYXRjaE51bWJlcjogMCwgdXBsb2FkZWRDb3VudDogMCB9O1xyXG5cclxuICBwcml2YXRlIGNvbmN1cnJlbmN5TnVtYmVyID0gcHJvY2Vzcy5lbnYuQ09OQ1VSUkVOQ1lfTlVNQkVSIHx8IDEwO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc1NlY3JldEtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzUmVnaW9uOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUNsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZURvbWFpbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVTZWNyZXQ6IHN0cmluZztcclxuICBwcml2YXRlIHVzZVJlZGlzOiBib29sZWFuO1xyXG4gIHByaXZhdGUgcmVkaXNQb3J0OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSByZWRpc0hvc3Q6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLnZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKTtcclxuXHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSBwcm9jZXNzLmVudi5URU1QX0ZPTERFUjtcclxuICAgIHRoaXMuYXdzQWNjZXNzS2V5SWQgPSBwcm9jZXNzLmVudi5BV1NfQUNDRVNTX0tFWV9JRDtcclxuICAgIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5ID0gcHJvY2Vzcy5lbnYuQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZO1xyXG4gICAgdGhpcy5hd3NSZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xyXG4gICAgdGhpcy5hd3NCdWNrZXROYW1lID0gcHJvY2Vzcy5lbnYuQVdTX0JVQ0tFVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUFkbEFjY291bnROYW1lID0gcHJvY2Vzcy5lbnYuQVpVUkVfQURMX0FDQ09VTlRfTkFNRTtcclxuICAgIHRoaXMuYXp1cmVDbGllbnRJZCA9IHByb2Nlc3MuZW52LkFaVVJFX0NMSUVOVF9JRDtcclxuICAgIHRoaXMuYXp1cmVEb21haW4gPSBwcm9jZXNzLmVudi5BWlVSRV9ET01BSU47XHJcbiAgICB0aGlzLmF6dXJlU2VjcmV0ID0gcHJvY2Vzcy5lbnYuQVpVUkVfU0VDUkVUO1xyXG4gICAgdGhpcy51c2VSZWRpcyA9IHByb2Nlc3MuZW52LlVTRV9SRURJUyAhPT0gdW5kZWZpbmVkID8gcHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgOiBmYWxzZTtcclxuICAgIHRoaXMucmVkaXNQb3J0ID0gcHJvY2Vzcy5lbnYuUkVESVNfUE9SVCB8fCBcIjYzNzlcIjtcclxuICAgIHRoaXMucmVkaXNIb3N0ID0gcHJvY2Vzcy5lbnYuUkVESVNfSE9TVCB8fCBcInJlZGlzXCI7XHJcbiAgICAvLyBJbml0aWFsaXplIGNsaWVudHNcclxuICAgIHRoaXMuYXdzQ2xpZW50ID0gdGhpcy5pbml0aWFsaXplQXdzQ2xpZW50KHRoaXMuYXdzQWNjZXNzS2V5SWQsIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5LCB0aGlzLmF3c1JlZ2lvbik7XHJcbiAgICB0aGlzLmFkbENsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUFkbENsaWVudCh0aGlzLmF6dXJlQ2xpZW50SWQsIHRoaXMuYXp1cmVEb21haW4sIHRoaXMuYXp1cmVTZWNyZXQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGhhbmRsZXIoY2IpIHtcclxuICAgIC8vIGNyZWF0ZSB0ZW1wIGRpcmVjdG9yeSB3aXRoIGNhY2hlIGRpcmVjdG9yeSBpbnNpZGUgdG8gZG93bmxvYWQgZmlsZXMgZnJvbSBzMyBhbmQgdXBsb2FkIGl0IHRvIEFETC5cclxuICAgIC8vIEluIHRoZSBlbmQgb2YgdGhlIHJ1biB0aGUgY2FjaGUgZGlyZWN0b3J5IHdpbGwgYmUgZGVsZXRlZC5cclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgKz0gXCIvY2FjaGVcIjtcclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcblxyXG4gICAgY29uc3QgYXdzTW9kdWxlID0gbmV3IEF3c1MzTW9kdWxlKHRoaXMuYXdzQnVja2V0TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCB0aGlzLmF3c0NsaWVudCk7XHJcbiAgICBjb25zdCBhZGxNb2R1bGUgPSBuZXcgQXp1cmVEYXRhTGFrZU1vZHVsZSh0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUsIHRoaXMudGVtcEZvbGRlciwgdGhpcy5hZGxDbGllbnQpO1xyXG4gICAgY29uc3QgcmVkaXNNb2R1bGUgPSB0aGlzLnVzZVJlZGlzID8gbmV3IFJlZGlzTW9kdWxlKHRoaXMucmVkaXNQb3J0LCB0aGlzLnJlZGlzSG9zdCkgOiBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcIlVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKFwiTm90IHVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMuYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NNb2R1bGUsIGFkbE1vZHVsZSwgcmVkaXNNb2R1bGUpO1xyXG5cclxuICAgIC8vIEFmdGVyIGFsbCB1cGxvYWRzIGFyZSBjb21wbGV0ZWQsIGRlbGV0ZSB0aGUgY2FjaGUgZGlyZWN0b3J5IGFuZCBpdHMgc3ViIGRpcmVjdG9yaWVzLlxyXG4gICAgZGVsZXRlRm9sZGVyKHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB3aW5zdG9uLmluZm8oXCJhbGwgZG9uZVwiKTtcclxuICAgIGNiKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAgR28gb3ZlciB0aGUgaXRlbXMgaW4gUzMgaW4gYmF0Y2hlcyBvZiAxMDAwLlxyXG4gICAqICBGb3IgZWFjaCBmaWxlIGluIGJhdGNoIGNoZWNrIGlmIGl0IGlzIG1pc3NpbmcgZnJvbSBBREwgbGFrZSwgaWYgc28gZG93bmxvYWQgaXQgdG8gdGVtcCBkaXJlY3RvcnkgYW5kIHVwbG9hZCB0byBBREwuXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzUzNNb2R1bGU6IEF3c1MzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUsIHJlZGlzTW9kdWxlOiBSZWRpc01vZHVsZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgbGV0IGF3c09iamVjdHNPdXRwdXQ6IEFXUy5TMy5MaXN0T2JqZWN0c091dHB1dDtcclxuICAgIGxldCBtYXJrZXIgPSBcIlwiO1xyXG4gICAgdGhpcy5jb3B5UHJvcGVydGllcy5iYXRjaE51bWJlciA9IDE7XHJcblxyXG4gICAgZG8ge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYFByb2Nlc3NpbmcgYmF0Y2ggIyR7dGhpcy5jb3B5UHJvcGVydGllcy5iYXRjaE51bWJlcn1gKTtcclxuICAgICAgYXdzT2JqZWN0c091dHB1dCA9IGF3YWl0IGF3c1MzTW9kdWxlLmxpc3RBbGxPYmplY3RzKG1hcmtlcik7XHJcblxyXG4gICAgICBpZiAoYXdzT2JqZWN0c091dHB1dCAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzICYmIGF3c09iamVjdHNPdXRwdXQuQ29udGVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGxldCBhd3NPYmplY3RzID0gYXdzT2JqZWN0c091dHB1dC5Db250ZW50cztcclxuICAgICAgICAvLyBGaWx0ZXIgb3V0IHRoZSBkaXJlY3RvcmllcyBuYW1lcyAtIGF3cy5saXN0T2JqZWN0cyByZXR1cm5zIGFsbCBmaWxlcyBpbiB0aGUgYnVja2V0IGluY2x1ZGluZyBkaXJlY3RvcmllcyBuYW1lc1xyXG4gICAgICAgIGF3c09iamVjdHMgPSBhd3NPYmplY3RzLmZpbHRlcigob2JqKSA9PiAhb2JqLktleS5lbmRzV2l0aChcIi9cIikpO1xyXG5cclxuICAgICAgICBjb25zdCBwcm9taXNlQXJyYXkgPSBhd3NPYmplY3RzLm1hcChrZXkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBpZiAoYXdhaXQgdGhpcy5zaG91bGRVcGxvYWRGaWxlKHJlZGlzTW9kdWxlLCBhZGxNb2R1bGUsIGtleSkpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGF3c1MzTW9kdWxlLmRvd25sb2FkRmlsZUZyb21TMyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIEZpbGUgaWYgaXQgZG9lc24ndCBleGlzdCBpbiBBREwgb3IgaWYgYSBuZXcgdmVyc2lvbiBvZiB0aGUgZmlsZSBleGlzdHMgaW4gUzNcclxuICAgICAgICAgICAgICAgIGF3YWl0IGFkbE1vZHVsZS51cGxvYWRGaWxlVG9BenVyZURhdGFMYWtlKGtleS5LZXkpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jb3B5UHJvcGVydGllcy51cGxvYWRlZENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBkZWxldGVGaWxlKHBhdGguam9pbih0aGlzLnRlbXBGb2xkZXIsIGtleS5LZXkpKTtcclxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSByZWRpcyB3aXRoIHRoZSBuZXcgZmlsZVxyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgICAgICAgICAgICAgYXdhaXQgcmVkaXNNb2R1bGUuYWRkRmlsZVRvUmVkaXMoa2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihgZXJyb3Igd2FzIHRocm93biB3aGlsZSB3b3JraW5nIG9uIGVsZW1lbnQgJHtrZXkuS2V5fSAke2V4fWApO1xyXG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgYXdhaXQgcGFyYWxsZWwocHJvbWlzZUFycmF5LCB0aGlzLmNvbmN1cnJlbmN5TnVtYmVyKTtcclxuICAgICAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihleCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYXJrZXIgPSBhd3NPYmplY3RzW2F3c09iamVjdHMubGVuZ3RoIC0gMV0uS2V5O1xyXG4gICAgICAgIHRoaXMuY29weVByb3BlcnRpZXMuYmF0Y2hOdW1iZXIrKztcclxuICAgICAgfVxyXG4gICAgfSB3aGlsZSAoYXdzT2JqZWN0c091dHB1dC5Jc1RydW5jYXRlZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNob3VsZFVwbG9hZEZpbGUocmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUsIGtleTogQVdTLlMzLk9iamVjdCkge1xyXG4gICAgbGV0IHNob3VsZFVwbG9hZEZpbGU6IGJvb2xlYW47XHJcblxyXG4gICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgbGV0IG9iajogUmVkaXNPYmplY3QgPSBhd2FpdCByZWRpc01vZHVsZS5pc0ZpbGVJblJlZGlzKGtleSk7XHJcbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcclxuICAgICAgICAvLyBPYmplY3QgaXMgbm90IGluIHJlZGlzIC0gY2hlY2sgaW4gQURMIGlmIGl0IHNob3VsZCBiZSB1cGxvYWQgYW5kIHVwZGF0ZSByZWRpcyBhbnl3YXlcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICAgICAgYXdhaXQgcmVkaXNNb2R1bGUuYWRkRmlsZVRvUmVkaXMoa2V5KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBDaGVjayBpZiBmaWxlIHdhcyBtb2RpZmllZCBzaW5jZSB0aGUgbGFzdCB0aW1lIGl0IHdhcyB1cGxvYWRlZFxyXG4gICAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBvYmouRVRhZyAhPT0ga2V5LkVUYWc7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBhd2FpdCBhZGxNb2R1bGUuc2hvdWxkVXBsb2FkVG9BREwoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc2hvdWxkVXBsb2FkRmlsZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IHZhcmlhYmxlc0xpc3QgPSBbXCJBV1NfQUNDRVNTX0tFWV9JRFwiLCBcIkFXU19TRUNSRVRfQUNDRVNTX0tFWVwiLCBcIkFXU19SRUdJT05cIiwgXCJBV1NfQlVDS0VUX05BTUVcIixcclxuICAgICAgXCJBWlVSRV9DTElFTlRfSURcIiwgXCJBWlVSRV9ET01BSU5cIiwgXCJBWlVSRV9TRUNSRVRcIiwgXCJBWlVSRV9BRExfQUNDT1VOVF9OQU1FXCIsIFwiVEVNUF9GT0xERVJcIl07XHJcblxyXG4gICAgdmFyaWFibGVzTGlzdC5mb3JFYWNoKCh2YXJpYWJsZSkgPT4ge1xyXG4gICAgICBpZiAoIXByb2Nlc3MuZW52W3ZhcmlhYmxlXSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgJHt2YXJpYWJsZX0gaXMgbm90IGRlZmluZWRgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdKSB7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcInRydWVcIiAmJiBwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcImZhbHNlXCIpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVudmlyb25tZW50IFZhcmlhYmxlIFVTRV9SRURJUyBzaG91bGQgY29udGFpbiBib29sZWFuIHZhbHVlYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBd3NDbGllbnQoYWNjZXNzS2V5SWQ6IHN0cmluZywgc2VjcmV0QWNjZXNzS2V5OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nKTogQVdTLlMzIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgIHJldHVybiBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYGVycm9yIGluaXRpYWxpemluZyBzMyBjbGllbnQ6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQWRsQ2xpZW50KGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZyk6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICByZXR1cm4gbmV3IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KGNyZWRlbnRpYWxzKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
