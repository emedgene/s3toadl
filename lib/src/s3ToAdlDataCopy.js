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
const redis = require("redis");
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
            const redisModule = this.useRedis ? new redisModule_1.RedisModule(this.initializeRedisClient(this.redisPort, this.redisHost)) : null;
            if (this.useRedis) {
                logger_1.winston.info("Using Redis");
            }
            else {
                logger_1.winston.info("Not using Redis");
            }
            yield this.batchIterationOverS3Items(awsModule, adlModule, redisModule);
            // After all uploads are completed, delete the cache directory and its sub directories.
            yield filesHelper_1.deleteFolder(this.tempFolder);
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
                                    filesHelper_1.deleteFile(path.join(this.tempFolder, key.Key));
                                    // Update redis with the new file
                                    if (this.useRedis) {
                                        yield redisModule.addFileToRedis(key);
                                    }
                                }
                            }
                            catch (ex) {
                                logger_1.winston.error(`error was thrown while working on element ${key.Key} ${ex}`);
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
                    // if file already exists in ADL, just update redis.
                    if (!shouldUploadFile) {
                        yield redisModule.addFileToRedis(key);
                    }
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
    initializeRedisClient(port, host) {
        try {
            return redis.createClient(port, host);
        }
        catch (ex) {
            logger_1.winston.error(`error initializing redis client ${ex}`);
            throw ex;
        }
    }
}
exports.S3ToAdlDataCopy = S3ToAdlDataCopy;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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dkxELDBDQXVMQyIsImZpbGUiOiJzcmMvczNUb0FkbERhdGFDb3B5LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXN5bmMgZnJvbSBcImFzeW5jXCI7XHJcbmltcG9ydCAqIGFzIHBhcmFsbGVsIGZyb20gXCJhc3luYy1hd2FpdC1wYXJhbGxlbFwiO1xyXG5pbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuaW1wb3J0ICogYXMgYWRsc01hbmFnZW1lbnQgZnJvbSBcImF6dXJlLWFybS1kYXRhbGFrZS1zdG9yZVwiO1xyXG5pbXBvcnQgKiBhcyBtc3Jlc3RBenVyZSBmcm9tIFwibXMtcmVzdC1henVyZVwiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCAqIGFzIHJlZGlzIGZyb20gXCJyZWRpc1wiO1xyXG5pbXBvcnQgeyBBd3NTM01vZHVsZSB9IGZyb20gXCIuL2F3c1MzTW9kdWxlXCI7XHJcbmltcG9ydCB7IEF6dXJlRGF0YUxha2VNb2R1bGUgfSBmcm9tIFwiLi9henVyZURhdGFMYWtlTW9kdWxlXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBkZWxldGVGaWxlLCBkZWxldGVGb2xkZXIsIGdldERpcmVjdG9yaWVzUGF0aEFycmF5IH0gZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBSZWRpc01vZHVsZSwgUmVkaXNPYmplY3QgfSBmcm9tIFwiLi9yZWRpc01vZHVsZVwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFMzVG9BZGxEYXRhQ29weSB7XHJcbiAgcHVibGljIGF3c0NsaWVudDogQVdTLlMzO1xyXG4gIHB1YmxpYyBhZGxDbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50O1xyXG4gIHB1YmxpYyBhd3NCdWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgcHVibGljIGF6dXJlQWRsQWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwdWJsaWMgY29weVByb3BlcnRpZXM6IHsgYmF0Y2hOdW1iZXI6IG51bWJlciwgdXBsb2FkZWRDb3VudDogMCB9ID0geyBiYXRjaE51bWJlcjogMCwgdXBsb2FkZWRDb3VudDogMCB9O1xyXG5cclxuICBwcml2YXRlIGNvbmN1cnJlbmN5TnVtYmVyID0gcHJvY2Vzcy5lbnYuQ09OQ1VSUkVOQ1lfTlVNQkVSIHx8IDEwO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc1NlY3JldEtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzUmVnaW9uOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUNsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZURvbWFpbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVTZWNyZXQ6IHN0cmluZztcclxuICBwcml2YXRlIHVzZVJlZGlzOiBib29sZWFuO1xyXG4gIHByaXZhdGUgcmVkaXNQb3J0OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSByZWRpc0hvc3Q6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLnZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKTtcclxuXHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSBwcm9jZXNzLmVudi5URU1QX0ZPTERFUjtcclxuICAgIHRoaXMuYXdzQWNjZXNzS2V5SWQgPSBwcm9jZXNzLmVudi5BV1NfQUNDRVNTX0tFWV9JRDtcclxuICAgIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5ID0gcHJvY2Vzcy5lbnYuQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZO1xyXG4gICAgdGhpcy5hd3NSZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xyXG4gICAgdGhpcy5hd3NCdWNrZXROYW1lID0gcHJvY2Vzcy5lbnYuQVdTX0JVQ0tFVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUFkbEFjY291bnROYW1lID0gcHJvY2Vzcy5lbnYuQVpVUkVfQURMX0FDQ09VTlRfTkFNRTtcclxuICAgIHRoaXMuYXp1cmVDbGllbnRJZCA9IHByb2Nlc3MuZW52LkFaVVJFX0NMSUVOVF9JRDtcclxuICAgIHRoaXMuYXp1cmVEb21haW4gPSBwcm9jZXNzLmVudi5BWlVSRV9ET01BSU47XHJcbiAgICB0aGlzLmF6dXJlU2VjcmV0ID0gcHJvY2Vzcy5lbnYuQVpVUkVfU0VDUkVUO1xyXG4gICAgdGhpcy51c2VSZWRpcyA9IHByb2Nlc3MuZW52LlVTRV9SRURJUyAhPT0gdW5kZWZpbmVkID8gcHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgOiBmYWxzZTtcclxuICAgIHRoaXMucmVkaXNQb3J0ID0gcHJvY2Vzcy5lbnYuUkVESVNfUE9SVCB8fCBcIjYzNzlcIjtcclxuICAgIHRoaXMucmVkaXNIb3N0ID0gcHJvY2Vzcy5lbnYuUkVESVNfSE9TVCB8fCBcInJlZGlzXCI7XHJcbiAgICAvLyBJbml0aWFsaXplIGNsaWVudHNcclxuICAgIHRoaXMuYXdzQ2xpZW50ID0gdGhpcy5pbml0aWFsaXplQXdzQ2xpZW50KHRoaXMuYXdzQWNjZXNzS2V5SWQsIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5LCB0aGlzLmF3c1JlZ2lvbik7XHJcbiAgICB0aGlzLmFkbENsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUFkbENsaWVudCh0aGlzLmF6dXJlQ2xpZW50SWQsIHRoaXMuYXp1cmVEb21haW4sIHRoaXMuYXp1cmVTZWNyZXQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGhhbmRsZXIoY2IpIHtcclxuICAgIC8vIGNyZWF0ZSB0ZW1wIGRpcmVjdG9yeSB3aXRoIGNhY2hlIGRpcmVjdG9yeSBpbnNpZGUgdG8gZG93bmxvYWQgZmlsZXMgZnJvbSBzMyBhbmQgdXBsb2FkIGl0IHRvIEFETC5cclxuICAgIC8vIEluIHRoZSBlbmQgb2YgdGhlIHJ1biB0aGUgY2FjaGUgZGlyZWN0b3J5IHdpbGwgYmUgZGVsZXRlZC5cclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgKz0gXCIvY2FjaGVcIjtcclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcblxyXG4gICAgY29uc3QgYXdzTW9kdWxlID0gbmV3IEF3c1MzTW9kdWxlKHRoaXMuYXdzQnVja2V0TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCB0aGlzLmF3c0NsaWVudCk7XHJcbiAgICBjb25zdCBhZGxNb2R1bGUgPSBuZXcgQXp1cmVEYXRhTGFrZU1vZHVsZSh0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUsIHRoaXMudGVtcEZvbGRlciwgdGhpcy5hZGxDbGllbnQpO1xyXG4gICAgY29uc3QgcmVkaXNNb2R1bGUgPSB0aGlzLnVzZVJlZGlzID8gbmV3IFJlZGlzTW9kdWxlKHRoaXMuaW5pdGlhbGl6ZVJlZGlzQ2xpZW50KHRoaXMucmVkaXNQb3J0LCB0aGlzLnJlZGlzSG9zdCkpIDogbnVsbDtcclxuXHJcbiAgICBpZiAodGhpcy51c2VSZWRpcykge1xyXG4gICAgICB3aW5zdG9uLmluZm8oXCJVc2luZyBSZWRpc1wiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcIk5vdCB1c2luZyBSZWRpc1wiKTtcclxuICAgIH1cclxuXHJcbiAgICBhd2FpdCB0aGlzLmJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzTW9kdWxlLCBhZGxNb2R1bGUsIHJlZGlzTW9kdWxlKTtcclxuXHJcbiAgICAvLyBBZnRlciBhbGwgdXBsb2FkcyBhcmUgY29tcGxldGVkLCBkZWxldGUgdGhlIGNhY2hlIGRpcmVjdG9yeSBhbmQgaXRzIHN1YiBkaXJlY3Rvcmllcy5cclxuICAgIGF3YWl0IGRlbGV0ZUZvbGRlcih0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgd2luc3Rvbi5pbmZvKFwiYWxsIGRvbmVcIik7XHJcbiAgICBjYigpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogIEdvIG92ZXIgdGhlIGl0ZW1zIGluIFMzIGluIGJhdGNoZXMgb2YgMTAwMC5cclxuICAgKiAgRm9yIGVhY2ggZmlsZSBpbiBiYXRjaCBjaGVjayBpZiBpdCBpcyBtaXNzaW5nIGZyb20gQURMIGxha2UsIGlmIHNvIGRvd25sb2FkIGl0IHRvIHRlbXAgZGlyZWN0b3J5IGFuZCB1cGxvYWQgdG8gQURMLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBiYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c1MzTW9kdWxlOiBBd3NTM01vZHVsZSwgYWRsTW9kdWxlOiBBenVyZURhdGFMYWtlTW9kdWxlLCByZWRpc01vZHVsZTogUmVkaXNNb2R1bGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGxldCBhd3NPYmplY3RzT3V0cHV0OiBBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ7XHJcbiAgICBsZXQgbWFya2VyID0gXCJcIjtcclxuICAgIHRoaXMuY29weVByb3BlcnRpZXMuYmF0Y2hOdW1iZXIgPSAxO1xyXG5cclxuICAgIGRvIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBQcm9jZXNzaW5nIGJhdGNoICMke3RoaXMuY29weVByb3BlcnRpZXMuYmF0Y2hOdW1iZXJ9YCk7XHJcbiAgICAgIGF3c09iamVjdHNPdXRwdXQgPSBhd2FpdCBhd3NTM01vZHVsZS5saXN0QWxsT2JqZWN0cyhtYXJrZXIpO1xyXG5cclxuICAgICAgaWYgKGF3c09iamVjdHNPdXRwdXQgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cyAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBsZXQgYXdzT2JqZWN0cyA9IGF3c09iamVjdHNPdXRwdXQuQ29udGVudHM7XHJcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgZGlyZWN0b3JpZXMgbmFtZXMgLSBhd3MubGlzdE9iamVjdHMgcmV0dXJucyBhbGwgZmlsZXMgaW4gdGhlIGJ1Y2tldCBpbmNsdWRpbmcgZGlyZWN0b3JpZXMgbmFtZXNcclxuICAgICAgICBhd3NPYmplY3RzID0gYXdzT2JqZWN0cy5maWx0ZXIoKG9iaikgPT4gIW9iai5LZXkuZW5kc1dpdGgoXCIvXCIpKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJvbWlzZUFycmF5ID0gYXdzT2JqZWN0cy5tYXAoa2V5ID0+IHtcclxuICAgICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuc2hvdWxkVXBsb2FkRmlsZShyZWRpc01vZHVsZSwgYWRsTW9kdWxlLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhd3NTM01vZHVsZS5kb3dubG9hZEZpbGVGcm9tUzMoa2V5KTtcclxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBGaWxlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgaW4gQURMIG9yIGlmIGEgbmV3IHZlcnNpb24gb2YgdGhlIGZpbGUgZXhpc3RzIGluIFMzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhZGxNb2R1bGUudXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShrZXkuS2V5KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29weVByb3BlcnRpZXMudXBsb2FkZWRDb3VudCsrO1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlRmlsZShwYXRoLmpvaW4odGhpcy50ZW1wRm9sZGVyLCBrZXkuS2V5KSk7XHJcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgcmVkaXMgd2l0aCB0aGUgbmV3IGZpbGVcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgICAgICAgICAgICAgIGF3YWl0IHJlZGlzTW9kdWxlLmFkZEZpbGVUb1JlZGlzKGtleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIHdhcyB0aHJvd24gd2hpbGUgd29ya2luZyBvbiBlbGVtZW50ICR7a2V5LktleX0gJHtleH1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGF3YWl0IHBhcmFsbGVsKHByb21pc2VBcnJheSwgdGhpcy5jb25jdXJyZW5jeU51bWJlcik7XHJcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWFya2VyID0gYXdzT2JqZWN0c1thd3NPYmplY3RzLmxlbmd0aCAtIDFdLktleTtcclxuICAgICAgICB0aGlzLmNvcHlQcm9wZXJ0aWVzLmJhdGNoTnVtYmVyKys7XHJcbiAgICAgIH1cclxuICAgIH0gd2hpbGUgKGF3c09iamVjdHNPdXRwdXQuSXNUcnVuY2F0ZWQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIHNob3VsZFVwbG9hZEZpbGUocmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUsIGtleTogQVdTLlMzLk9iamVjdCkge1xyXG4gICAgbGV0IHNob3VsZFVwbG9hZEZpbGU6IGJvb2xlYW47XHJcblxyXG4gICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgbGV0IG9iajogUmVkaXNPYmplY3QgPSBhd2FpdCByZWRpc01vZHVsZS5pc0ZpbGVJblJlZGlzKGtleSk7XHJcbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcclxuICAgICAgICAvLyBPYmplY3QgaXMgbm90IGluIHJlZGlzIC0gY2hlY2sgaW4gQURMIGlmIGl0IHNob3VsZCBiZSB1cGxvYWQgYW5kIHVwZGF0ZSByZWRpcyBhbnl3YXlcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICAgICAgLy8gaWYgZmlsZSBhbHJlYWR5IGV4aXN0cyBpbiBBREwsIGp1c3QgdXBkYXRlIHJlZGlzLlxyXG4gICAgICAgIGlmICghc2hvdWxkVXBsb2FkRmlsZSkge1xyXG4gICAgICAgICAgYXdhaXQgcmVkaXNNb2R1bGUuYWRkRmlsZVRvUmVkaXMoa2V5KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gQ2hlY2sgaWYgZmlsZSB3YXMgbW9kaWZpZWQgc2luY2UgdGhlIGxhc3QgdGltZSBpdCB3YXMgdXBsb2FkZWRcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gb2JqLkVUYWcgIT09IGtleS5FVGFnO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHNob3VsZFVwbG9hZEZpbGU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKSB7XHJcbiAgICBjb25zdCB2YXJpYWJsZXNMaXN0ID0gW1wiQVdTX0FDQ0VTU19LRVlfSURcIiwgXCJBV1NfU0VDUkVUX0FDQ0VTU19LRVlcIiwgXCJBV1NfUkVHSU9OXCIsIFwiQVdTX0JVQ0tFVF9OQU1FXCIsXHJcbiAgICAgIFwiQVpVUkVfQ0xJRU5UX0lEXCIsIFwiQVpVUkVfRE9NQUlOXCIsIFwiQVpVUkVfU0VDUkVUXCIsIFwiQVpVUkVfQURMX0FDQ09VTlRfTkFNRVwiLCBcIlRFTVBfRk9MREVSXCJdO1xyXG5cclxuICAgIHZhcmlhYmxlc0xpc3QuZm9yRWFjaCgodmFyaWFibGUpID0+IHtcclxuICAgICAgaWYgKCFwcm9jZXNzLmVudlt2YXJpYWJsZV0pIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVudmlyb25tZW50IFZhcmlhYmxlICR7dmFyaWFibGV9IGlzIG5vdCBkZWZpbmVkYCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXSkge1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSAhPT0gXCJ0cnVlXCIgJiYgcHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0udG9Mb3dlckNhc2UoKSAhPT0gXCJmYWxzZVwiKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFbnZpcm9ubWVudCBWYXJpYWJsZSBVU0VfUkVESVMgc2hvdWxkIGNvbnRhaW4gYm9vbGVhbiB2YWx1ZWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQXdzQ2xpZW50KGFjY2Vzc0tleUlkOiBzdHJpbmcsIHNlY3JldEFjY2Vzc0tleTogc3RyaW5nLCByZWdpb246IHN0cmluZyk6IEFXUy5TMyB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjb25maWcgPSB7IGFjY2Vzc0tleUlkLCBzZWNyZXRBY2Nlc3NLZXksIHJlZ2lvbiB9O1xyXG4gICAgICByZXR1cm4gbmV3IEFXUy5TMyhjb25maWcpO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBlcnJvciBpbml0aWFsaXppbmcgczMgY2xpZW50OiAke2V4fWApO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUFkbENsaWVudChjbGllbnRJZDogc3RyaW5nLCBkb21haW46IHN0cmluZywgc2VjcmV0OiBzdHJpbmcpOiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudCB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjcmVkZW50aWFscyA9IG5ldyBtc3Jlc3RBenVyZS5BcHBsaWNhdGlvblRva2VuQ3JlZGVudGlhbHMoY2xpZW50SWQsIGRvbWFpbiwgc2VjcmV0KTtcclxuICAgICAgcmV0dXJuIG5ldyBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudChjcmVkZW50aWFscyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciBpbml0aWFsaXppbmcgQXp1cmUgY2xpZW50ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgICBwcml2YXRlIGluaXRpYWxpemVSZWRpc0NsaWVudChwb3J0OiBzdHJpbmcsIGhvc3Q6IHN0cmluZyk6IHJlZGlzLmNsaWVudCB7XHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gcmVkaXMuY3JlYXRlQ2xpZW50KHBvcnQsIGhvc3QpO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5lcnJvcihgZXJyb3IgaW5pdGlhbGl6aW5nIHJlZGlzIGNsaWVudCAke2V4fWApO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcbn0iXSwic291cmNlUm9vdCI6Ii4uIn0=
