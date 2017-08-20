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
            const adlModule = new azureDataLakeModule_1.AzureDataLakeModule(this.azureAdlAccountName, this.tempFolder, this.adlClient, this.awsBucketName);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUM7SUFDSCxDQUFDO0NBQ0Y7QUF2TEQsMENBdUxDIiwiZmlsZSI6InNyYy9zM1RvQWRsRGF0YUNvcHkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3luYyBmcm9tIFwiYXN5bmNcIjtcclxuaW1wb3J0ICogYXMgcGFyYWxsZWwgZnJvbSBcImFzeW5jLWF3YWl0LXBhcmFsbGVsXCI7XHJcbmltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgKiBhcyBhZGxzTWFuYWdlbWVudCBmcm9tIFwiYXp1cmUtYXJtLWRhdGFsYWtlLXN0b3JlXCI7XHJcbmltcG9ydCAqIGFzIG1zcmVzdEF6dXJlIGZyb20gXCJtcy1yZXN0LWF6dXJlXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgcmVkaXMgZnJvbSBcInJlZGlzXCI7XHJcbmltcG9ydCB7IEF3c1MzTW9kdWxlIH0gZnJvbSBcIi4vYXdzUzNNb2R1bGVcIjtcclxuaW1wb3J0IHsgQXp1cmVEYXRhTGFrZU1vZHVsZSB9IGZyb20gXCIuL2F6dXJlRGF0YUxha2VNb2R1bGVcIjtcclxuaW1wb3J0IHsgY3JlYXRlRGlySWZOb3RFeGlzdHMsIGRlbGV0ZUZpbGUsIGRlbGV0ZUZvbGRlciwgZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkgfSBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5pbXBvcnQgeyB3aW5zdG9uIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XHJcbmltcG9ydCB7IFJlZGlzTW9kdWxlLCBSZWRpc09iamVjdCB9IGZyb20gXCIuL3JlZGlzTW9kdWxlXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgUzNUb0FkbERhdGFDb3B5IHtcclxuICBwdWJsaWMgYXdzQ2xpZW50OiBBV1MuUzM7XHJcbiAgcHVibGljIGFkbENsaWVudDogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQ7XHJcbiAgcHVibGljIGF3c0J1Y2tldE5hbWU6IHN0cmluZztcclxuICBwdWJsaWMgYXp1cmVBZGxBY2NvdW50TmFtZTogc3RyaW5nO1xyXG4gIHB1YmxpYyBjb3B5UHJvcGVydGllczogeyBiYXRjaE51bWJlcjogbnVtYmVyLCB1cGxvYWRlZENvdW50OiAwIH0gPSB7IGJhdGNoTnVtYmVyOiAwLCB1cGxvYWRlZENvdW50OiAwIH07XHJcblxyXG4gIHByaXZhdGUgY29uY3VycmVuY3lOdW1iZXIgPSBwcm9jZXNzLmVudi5DT05DVVJSRU5DWV9OVU1CRVIgfHwgMTA7XHJcbiAgcHJpdmF0ZSB0ZW1wRm9sZGVyOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NBY2Nlc3NLZXlJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzU2VjcmV0S2V5OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NSZWdpb246IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlQ2xpZW50SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlRG9tYWluOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZVNlY3JldDogc3RyaW5nO1xyXG4gIHByaXZhdGUgdXNlUmVkaXM6IGJvb2xlYW47XHJcbiAgcHJpdmF0ZSByZWRpc1BvcnQ6IHN0cmluZztcclxuICBwcml2YXRlIHJlZGlzSG9zdDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMudmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpO1xyXG5cclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHByb2Nlc3MuZW52LlRFTVBfRk9MREVSO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NLZXlJZCA9IHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXkgPSBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVk7XHJcbiAgICB0aGlzLmF3c1JlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT047XHJcbiAgICB0aGlzLmF3c0J1Y2tldE5hbWUgPSBwcm9jZXNzLmVudi5BV1NfQlVDS0VUX05BTUU7XHJcbiAgICB0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUgPSBwcm9jZXNzLmVudi5BWlVSRV9BRExfQUNDT1VOVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUNsaWVudElkID0gcHJvY2Vzcy5lbnYuQVpVUkVfQ0xJRU5UX0lEO1xyXG4gICAgdGhpcy5henVyZURvbWFpbiA9IHByb2Nlc3MuZW52LkFaVVJFX0RPTUFJTjtcclxuICAgIHRoaXMuYXp1cmVTZWNyZXQgPSBwcm9jZXNzLmVudi5BWlVSRV9TRUNSRVQ7XHJcbiAgICB0aGlzLnVzZVJlZGlzID0gcHJvY2Vzcy5lbnYuVVNFX1JFRElTICE9PSB1bmRlZmluZWQgPyBwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA6IGZhbHNlO1xyXG4gICAgdGhpcy5yZWRpc1BvcnQgPSBwcm9jZXNzLmVudi5SRURJU19QT1JUIHx8IFwiNjM3OVwiO1xyXG4gICAgdGhpcy5yZWRpc0hvc3QgPSBwcm9jZXNzLmVudi5SRURJU19IT1NUIHx8IFwicmVkaXNcIjtcclxuICAgIC8vIEluaXRpYWxpemUgY2xpZW50c1xyXG4gICAgdGhpcy5hd3NDbGllbnQgPSB0aGlzLmluaXRpYWxpemVBd3NDbGllbnQodGhpcy5hd3NBY2Nlc3NLZXlJZCwgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXksIHRoaXMuYXdzUmVnaW9uKTtcclxuICAgIHRoaXMuYWRsQ2xpZW50ID0gdGhpcy5pbml0aWFsaXplQWRsQ2xpZW50KHRoaXMuYXp1cmVDbGllbnRJZCwgdGhpcy5henVyZURvbWFpbiwgdGhpcy5henVyZVNlY3JldCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgaGFuZGxlcihjYikge1xyXG4gICAgLy8gY3JlYXRlIHRlbXAgZGlyZWN0b3J5IHdpdGggY2FjaGUgZGlyZWN0b3J5IGluc2lkZSB0byBkb3dubG9hZCBmaWxlcyBmcm9tIHMzIGFuZCB1cGxvYWQgaXQgdG8gQURMLlxyXG4gICAgLy8gSW4gdGhlIGVuZCBvZiB0aGUgcnVuIHRoZSBjYWNoZSBkaXJlY3Rvcnkgd2lsbCBiZSBkZWxldGVkLlxyXG4gICAgY3JlYXRlRGlySWZOb3RFeGlzdHMobnVsbCwgbnVsbCwgdGhpcy50ZW1wRm9sZGVyKTtcclxuICAgIHRoaXMudGVtcEZvbGRlciArPSBcIi9jYWNoZVwiO1xyXG4gICAgY3JlYXRlRGlySWZOb3RFeGlzdHMobnVsbCwgbnVsbCwgdGhpcy50ZW1wRm9sZGVyKTtcclxuXHJcbiAgICBjb25zdCBhd3NNb2R1bGUgPSBuZXcgQXdzUzNNb2R1bGUodGhpcy5hd3NCdWNrZXROYW1lLCB0aGlzLnRlbXBGb2xkZXIsIHRoaXMuYXdzQ2xpZW50KTtcclxuICAgIGNvbnN0IGFkbE1vZHVsZSA9IG5ldyBBenVyZURhdGFMYWtlTW9kdWxlKHRoaXMuYXp1cmVBZGxBY2NvdW50TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCB0aGlzLmFkbENsaWVudCwgdGhpcy5hd3NCdWNrZXROYW1lKTtcclxuICAgIGNvbnN0IHJlZGlzTW9kdWxlID0gdGhpcy51c2VSZWRpcyA/IG5ldyBSZWRpc01vZHVsZSh0aGlzLmluaXRpYWxpemVSZWRpc0NsaWVudCh0aGlzLnJlZGlzUG9ydCwgdGhpcy5yZWRpc0hvc3QpKSA6IG51bGw7XHJcblxyXG4gICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKFwiVXNpbmcgUmVkaXNcIik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB3aW5zdG9uLmluZm8oXCJOb3QgdXNpbmcgUmVkaXNcIik7XHJcbiAgICB9XHJcblxyXG4gICAgYXdhaXQgdGhpcy5iYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c01vZHVsZSwgYWRsTW9kdWxlLCByZWRpc01vZHVsZSk7XHJcblxyXG4gICAgLy8gQWZ0ZXIgYWxsIHVwbG9hZHMgYXJlIGNvbXBsZXRlZCwgZGVsZXRlIHRoZSBjYWNoZSBkaXJlY3RvcnkgYW5kIGl0cyBzdWIgZGlyZWN0b3JpZXMuXHJcbiAgICBhd2FpdCBkZWxldGVGb2xkZXIodGhpcy50ZW1wRm9sZGVyKTtcclxuICAgIHdpbnN0b24uaW5mbyhcImFsbCBkb25lXCIpO1xyXG4gICAgY2IoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICBHbyBvdmVyIHRoZSBpdGVtcyBpbiBTMyBpbiBiYXRjaGVzIG9mIDEwMDAuXHJcbiAgICogIEZvciBlYWNoIGZpbGUgaW4gYmF0Y2ggY2hlY2sgaWYgaXQgaXMgbWlzc2luZyBmcm9tIEFETCBsYWtlLCBpZiBzbyBkb3dubG9hZCBpdCB0byB0ZW1wIGRpcmVjdG9yeSBhbmQgdXBsb2FkIHRvIEFETC5cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NTM01vZHVsZTogQXdzUzNNb2R1bGUsIGFkbE1vZHVsZTogQXp1cmVEYXRhTGFrZU1vZHVsZSwgcmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBsZXQgYXdzT2JqZWN0c091dHB1dDogQVdTLlMzLkxpc3RPYmplY3RzT3V0cHV0O1xyXG4gICAgbGV0IG1hcmtlciA9IFwiXCI7XHJcbiAgICB0aGlzLmNvcHlQcm9wZXJ0aWVzLmJhdGNoTnVtYmVyID0gMTtcclxuXHJcbiAgICBkbyB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhgUHJvY2Vzc2luZyBiYXRjaCAjJHt0aGlzLmNvcHlQcm9wZXJ0aWVzLmJhdGNoTnVtYmVyfWApO1xyXG4gICAgICBhd3NPYmplY3RzT3V0cHV0ID0gYXdhaXQgYXdzUzNNb2R1bGUubGlzdEFsbE9iamVjdHMobWFya2VyKTtcclxuXHJcbiAgICAgIGlmIChhd3NPYmplY3RzT3V0cHV0ICYmIGF3c09iamVjdHNPdXRwdXQuQ29udGVudHMgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgbGV0IGF3c09iamVjdHMgPSBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzO1xyXG4gICAgICAgIC8vIEZpbHRlciBvdXQgdGhlIGRpcmVjdG9yaWVzIG5hbWVzIC0gYXdzLmxpc3RPYmplY3RzIHJldHVybnMgYWxsIGZpbGVzIGluIHRoZSBidWNrZXQgaW5jbHVkaW5nIGRpcmVjdG9yaWVzIG5hbWVzXHJcbiAgICAgICAgYXdzT2JqZWN0cyA9IGF3c09iamVjdHMuZmlsdGVyKChvYmopID0+ICFvYmouS2V5LmVuZHNXaXRoKFwiL1wiKSk7XHJcblxyXG4gICAgICAgIGNvbnN0IHByb21pc2VBcnJheSA9IGF3c09iamVjdHMubWFwKGtleSA9PiB7XHJcbiAgICAgICAgICByZXR1cm4gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIGlmIChhd2FpdCB0aGlzLnNob3VsZFVwbG9hZEZpbGUocmVkaXNNb2R1bGUsIGFkbE1vZHVsZSwga2V5KSkge1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgYXdzUzNNb2R1bGUuZG93bmxvYWRGaWxlRnJvbVMzKGtleSk7XHJcbiAgICAgICAgICAgICAgICAvLyBVcGxvYWQgRmlsZSBpZiBpdCBkb2Vzbid0IGV4aXN0IGluIEFETCBvciBpZiBhIG5ldyB2ZXJzaW9uIG9mIHRoZSBmaWxlIGV4aXN0cyBpbiBTM1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgYWRsTW9kdWxlLnVwbG9hZEZpbGVUb0F6dXJlRGF0YUxha2Uoa2V5LktleSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvcHlQcm9wZXJ0aWVzLnVwbG9hZGVkQ291bnQrKztcclxuICAgICAgICAgICAgICAgIGRlbGV0ZUZpbGUocGF0aC5qb2luKHRoaXMudGVtcEZvbGRlciwga2V5LktleSkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHJlZGlzIHdpdGggdGhlIG5ldyBmaWxlXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VSZWRpcykge1xyXG4gICAgICAgICAgICAgICAgICBhd2FpdCByZWRpc01vZHVsZS5hZGRGaWxlVG9SZWRpcyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciB3YXMgdGhyb3duIHdoaWxlIHdvcmtpbmcgb24gZWxlbWVudCAke2tleS5LZXl9ICR7ZXh9YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBhd2FpdCBwYXJhbGxlbChwcm9taXNlQXJyYXksIHRoaXMuY29uY3VycmVuY3lOdW1iZXIpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGV4KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG1hcmtlciA9IGF3c09iamVjdHNbYXdzT2JqZWN0cy5sZW5ndGggLSAxXS5LZXk7XHJcbiAgICAgICAgdGhpcy5jb3B5UHJvcGVydGllcy5iYXRjaE51bWJlcisrO1xyXG4gICAgICB9XHJcbiAgICB9IHdoaWxlIChhd3NPYmplY3RzT3V0cHV0LklzVHJ1bmNhdGVkKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBzaG91bGRVcGxvYWRGaWxlKHJlZGlzTW9kdWxlOiBSZWRpc01vZHVsZSwgYWRsTW9kdWxlOiBBenVyZURhdGFMYWtlTW9kdWxlLCBrZXk6IEFXUy5TMy5PYmplY3QpIHtcclxuICAgIGxldCBzaG91bGRVcGxvYWRGaWxlOiBib29sZWFuO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgIGxldCBvYmo6IFJlZGlzT2JqZWN0ID0gYXdhaXQgcmVkaXNNb2R1bGUuaXNGaWxlSW5SZWRpcyhrZXkpO1xyXG4gICAgICBpZiAob2JqID09PSBudWxsKSB7XHJcbiAgICAgICAgLy8gT2JqZWN0IGlzIG5vdCBpbiByZWRpcyAtIGNoZWNrIGluIEFETCBpZiBpdCBzaG91bGQgYmUgdXBsb2FkIGFuZCB1cGRhdGUgcmVkaXMgYW55d2F5XHJcbiAgICAgICAgc2hvdWxkVXBsb2FkRmlsZSA9IGF3YWl0IGFkbE1vZHVsZS5zaG91bGRVcGxvYWRUb0FETChrZXkpO1xyXG4gICAgICAgIC8vIGlmIGZpbGUgYWxyZWFkeSBleGlzdHMgaW4gQURMLCBqdXN0IHVwZGF0ZSByZWRpcy5cclxuICAgICAgICBpZiAoIXNob3VsZFVwbG9hZEZpbGUpIHtcclxuICAgICAgICAgIGF3YWl0IHJlZGlzTW9kdWxlLmFkZEZpbGVUb1JlZGlzKGtleSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIENoZWNrIGlmIGZpbGUgd2FzIG1vZGlmaWVkIHNpbmNlIHRoZSBsYXN0IHRpbWUgaXQgd2FzIHVwbG9hZGVkXHJcbiAgICAgICAgc2hvdWxkVXBsb2FkRmlsZSA9IG9iai5FVGFnICE9PSBrZXkuRVRhZztcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc2hvdWxkVXBsb2FkRmlsZSA9IGF3YWl0IGFkbE1vZHVsZS5zaG91bGRVcGxvYWRUb0FETChrZXkpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBzaG91bGRVcGxvYWRGaWxlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB2YWxpZGF0ZUVudmlyb25tZW50VmFyaWFibGVzKCkge1xyXG4gICAgY29uc3QgdmFyaWFibGVzTGlzdCA9IFtcIkFXU19BQ0NFU1NfS0VZX0lEXCIsIFwiQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZXCIsIFwiQVdTX1JFR0lPTlwiLCBcIkFXU19CVUNLRVRfTkFNRVwiLFxyXG4gICAgICBcIkFaVVJFX0NMSUVOVF9JRFwiLCBcIkFaVVJFX0RPTUFJTlwiLCBcIkFaVVJFX1NFQ1JFVFwiLCBcIkFaVVJFX0FETF9BQ0NPVU5UX05BTUVcIiwgXCJURU1QX0ZPTERFUlwiXTtcclxuXHJcbiAgICB2YXJpYWJsZXNMaXN0LmZvckVhY2goKHZhcmlhYmxlKSA9PiB7XHJcbiAgICAgIGlmICghcHJvY2Vzcy5lbnZbdmFyaWFibGVdKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFbnZpcm9ubWVudCBWYXJpYWJsZSAke3ZhcmlhYmxlfSBpcyBub3QgZGVmaW5lZGApO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAocHJvY2Vzcy5lbnZbXCJVU0VfUkVESVNcIl0pIHtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdLnRvTG93ZXJDYXNlKCkgIT09IFwidHJ1ZVwiICYmIHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdLnRvTG93ZXJDYXNlKCkgIT09IFwiZmFsc2VcIikge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgVVNFX1JFRElTIHNob3VsZCBjb250YWluIGJvb2xlYW4gdmFsdWVgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdGlhbGl6ZUF3c0NsaWVudChhY2Nlc3NLZXlJZDogc3RyaW5nLCBzZWNyZXRBY2Nlc3NLZXk6IHN0cmluZywgcmVnaW9uOiBzdHJpbmcpOiBBV1MuUzMge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY29uZmlnID0geyBhY2Nlc3NLZXlJZCwgc2VjcmV0QWNjZXNzS2V5LCByZWdpb24gfTtcclxuICAgICAgcmV0dXJuIG5ldyBBV1MuUzMoY29uZmlnKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhgZXJyb3IgaW5pdGlhbGl6aW5nIHMzIGNsaWVudDogJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBZGxDbGllbnQoY2xpZW50SWQ6IHN0cmluZywgZG9tYWluOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nKTogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY3JlZGVudGlhbHMgPSBuZXcgbXNyZXN0QXp1cmUuQXBwbGljYXRpb25Ub2tlbkNyZWRlbnRpYWxzKGNsaWVudElkLCBkb21haW4sIHNlY3JldCk7XHJcbiAgICAgIHJldHVybiBuZXcgYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQoY3JlZGVudGlhbHMpO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5lcnJvcihgZXJyb3IgaW5pdGlhbGl6aW5nIEF6dXJlIGNsaWVudCAke2V4fWApO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplUmVkaXNDbGllbnQocG9ydDogc3RyaW5nLCBob3N0OiBzdHJpbmcpOiByZWRpcy5jbGllbnQge1xyXG4gICAgdHJ5IHtcclxuICAgICAgcmV0dXJuIHJlZGlzLmNyZWF0ZUNsaWVudChwb3J0LCBob3N0KTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyByZWRpcyBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
