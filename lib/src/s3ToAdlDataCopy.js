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
        this.redisPort = process.env.REDIS_PORT || "6379";
        this.redisHost = process.env.REDIS_HOST || "redis";
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUM7SUFDSCxDQUFDO0lBRU8sbUJBQW1CLENBQUMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsTUFBYztRQUMxRSxJQUFJLENBQUM7WUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLE1BQU0sQ0FBQyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTFLRCwwQ0EwS0MiLCJmaWxlIjoic3JjL3MzVG9BZGxEYXRhQ29weS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzeW5jIGZyb20gXCJhc3luY1wiO1xyXG5pbXBvcnQgKiBhcyBwYXJhbGxlbCBmcm9tIFwiYXN5bmMtYXdhaXQtcGFyYWxsZWxcIjtcclxuaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgbXNyZXN0QXp1cmUgZnJvbSBcIm1zLXJlc3QtYXp1cmVcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBBd3NTM01vZHVsZSB9IGZyb20gXCIuL2F3c1MzTW9kdWxlXCI7XHJcbmltcG9ydCB7IEF6dXJlRGF0YUxha2VNb2R1bGUgfSBmcm9tIFwiLi9henVyZURhdGFMYWtlTW9kdWxlXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBkZWxldGVGaWxlLCBkZWxldGVGb2xkZXIsIGdldERpcmVjdG9yaWVzUGF0aEFycmF5IH0gZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBSZWRpc01vZHVsZSwgUmVkaXNPYmplY3QgfSBmcm9tIFwiLi9yZWRpc01vZHVsZVwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFMzVG9BZGxEYXRhQ29weSB7XHJcbiAgcHVibGljIGF3c0NsaWVudDogQVdTLlMzO1xyXG4gIHB1YmxpYyBhZGxDbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50O1xyXG4gIHB1YmxpYyBhd3NCdWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgcHVibGljIGF6dXJlQWRsQWNjb3VudE5hbWU6IHN0cmluZztcclxuXHJcbiAgcHJpdmF0ZSBjb25jdXJyZW5jeU51bWJlciA9IHByb2Nlc3MuZW52LkNPTkNVUlJFTkNZX05VTUJFUiB8fCAxMDtcclxuICBwcml2YXRlIHRlbXBGb2xkZXI6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc0tleUlkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NBY2Nlc3NTZWNyZXRLZXk6IHN0cmluZztcclxuICBwcml2YXRlIGF3c1JlZ2lvbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVDbGllbnRJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVEb21haW46IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlU2VjcmV0OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB1c2VSZWRpczogYm9vbGVhbjtcclxuICBwcml2YXRlIHJlZGlzUG9ydDogc3RyaW5nO1xyXG4gIHByaXZhdGUgcmVkaXNIb3N0OiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgdGhpcy52YWxpZGF0ZUVudmlyb25tZW50VmFyaWFibGVzKCk7XHJcblxyXG4gICAgdGhpcy50ZW1wRm9sZGVyID0gcHJvY2Vzcy5lbnYuVEVNUF9GT0xERVI7XHJcbiAgICB0aGlzLmF3c0FjY2Vzc0tleUlkID0gcHJvY2Vzcy5lbnYuQVdTX0FDQ0VTU19LRVlfSUQ7XHJcbiAgICB0aGlzLmF3c0FjY2Vzc1NlY3JldEtleSA9IHByb2Nlc3MuZW52LkFXU19TRUNSRVRfQUNDRVNTX0tFWTtcclxuICAgIHRoaXMuYXdzUmVnaW9uID0gcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTjtcclxuICAgIHRoaXMuYXdzQnVja2V0TmFtZSA9IHByb2Nlc3MuZW52LkFXU19CVUNLRVRfTkFNRTtcclxuICAgIHRoaXMuYXp1cmVBZGxBY2NvdW50TmFtZSA9IHByb2Nlc3MuZW52LkFaVVJFX0FETF9BQ0NPVU5UX05BTUU7XHJcbiAgICB0aGlzLmF6dXJlQ2xpZW50SWQgPSBwcm9jZXNzLmVudi5BWlVSRV9DTElFTlRfSUQ7XHJcbiAgICB0aGlzLmF6dXJlRG9tYWluID0gcHJvY2Vzcy5lbnYuQVpVUkVfRE9NQUlOO1xyXG4gICAgdGhpcy5henVyZVNlY3JldCA9IHByb2Nlc3MuZW52LkFaVVJFX1NFQ1JFVDtcclxuICAgIHRoaXMudXNlUmVkaXMgPSBwcm9jZXNzLmVudi5VU0VfUkVESVMgIT09IHVuZGVmaW5lZCA/IHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdLnRvTG93ZXJDYXNlKCkgPT09IFwidHJ1ZVwiIDogZmFsc2U7XHJcbiAgICB0aGlzLnJlZGlzUG9ydCA9IHByb2Nlc3MuZW52LlJFRElTX1BPUlQgfHwgXCI2Mzc5XCI7XHJcbiAgICB0aGlzLnJlZGlzSG9zdCA9IHByb2Nlc3MuZW52LlJFRElTX0hPU1QgfHwgIFwicmVkaXNcIjtcclxuXHJcbiAgICAvLyBJbml0aWFsaXplIGNsaWVudHNcclxuICAgIHRoaXMuYXdzQ2xpZW50ID0gdGhpcy5pbml0aWFsaXplQXdzQ2xpZW50KHRoaXMuYXdzQWNjZXNzS2V5SWQsIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5LCB0aGlzLmF3c1JlZ2lvbik7XHJcbiAgICB0aGlzLmFkbENsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUFkbENsaWVudCh0aGlzLmF6dXJlQ2xpZW50SWQsIHRoaXMuYXp1cmVEb21haW4sIHRoaXMuYXp1cmVTZWNyZXQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGhhbmRsZXIoKSB7XHJcbiAgICAvLyBjcmVhdGUgdGVtcCBkaXJlY3Rvcnkgd2l0aCBjYWNoZSBkaXJlY3RvcnkgaW5zaWRlIHRvIGRvd25sb2FkIGZpbGVzIGZyb20gczMgYW5kIHVwbG9hZCBpdCB0byBBREwuXHJcbiAgICAvLyBJbiB0aGUgZW5kIG9mIHRoZSBydW4gdGhlIGNhY2hlIGRpcmVjdG9yeSB3aWxsIGJlIGRlbGV0ZWQuXHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgdGhpcy50ZW1wRm9sZGVyICs9IFwiL2NhY2hlXCI7XHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG5cclxuICAgIGNvbnN0IGF3c01vZHVsZSA9IG5ldyBBd3NTM01vZHVsZSh0aGlzLmF3c0J1Y2tldE5hbWUsIHRoaXMudGVtcEZvbGRlciwgdGhpcy5hd3NDbGllbnQpO1xyXG4gICAgY29uc3QgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUodGhpcy5henVyZUFkbEFjY291bnROYW1lLCB0aGlzLnRlbXBGb2xkZXIsIHRoaXMuYWRsQ2xpZW50KTtcclxuICAgIFxyXG4gICAgY29uc3QgcmVkaXNNb2R1bGUgPSB0aGlzLnVzZVJlZGlzID8gbmV3IFJlZGlzTW9kdWxlKHRoaXMucmVkaXNQb3J0LCB0aGlzLnJlZGlzSG9zdCkgOiBudWxsO1xyXG5cclxuICAgIGlmICh0aGlzLnVzZVJlZGlzKSB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcIlVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgd2luc3Rvbi5pbmZvKFwiTm90IHVzaW5nIFJlZGlzXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGF3YWl0IHRoaXMuYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NNb2R1bGUsIGFkbE1vZHVsZSwgcmVkaXNNb2R1bGUpO1xyXG5cclxuICAgIC8vIEFmdGVyIGFsbCB1cGxvYWRzIGFyZSBjb21wbGV0ZWQsIGRlbGV0ZSB0aGUgY2FjaGUgZGlyZWN0b3J5IGFuZCBpdHMgc3ViIGRpcmVjdG9yaWVzLlxyXG4gICAgZGVsZXRlRm9sZGVyKHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB3aW5zdG9uLmluZm8oXCJhbGwgZG9uZVwiKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICBHbyBvdmVyIHRoZSBpdGVtcyBpbiBTMyBpbiBiYXRjaGVzIG9mIDEwMDAuXHJcbiAgICogIEZvciBlYWNoIGZpbGUgaW4gYmF0Y2ggY2hlY2sgaWYgaXQgaXMgbWlzc2luZyBmcm9tIEFETCBsYWtlLCBpZiBzbyBkb3dubG9hZCBpdCB0byB0ZW1wIGRpcmVjdG9yeSBhbmQgdXBsb2FkIHRvIEFETC5cclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgYmF0Y2hJdGVyYXRpb25PdmVyUzNJdGVtcyhhd3NTM01vZHVsZTogQXdzUzNNb2R1bGUsIGFkbE1vZHVsZTogQXp1cmVEYXRhTGFrZU1vZHVsZSwgcmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBsZXQgYXdzT2JqZWN0c091dHB1dDogQVdTLlMzLkxpc3RPYmplY3RzT3V0cHV0O1xyXG4gICAgbGV0IG1hcmtlciA9IFwiXCI7XHJcbiAgICBsZXQgYmF0Y2hOdW1iZXIgPSAxO1xyXG4gICAgZG8ge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYFByb2Nlc3NpbmcgYmF0Y2ggIyR7YmF0Y2hOdW1iZXJ9YCk7XHJcbiAgICAgIGF3c09iamVjdHNPdXRwdXQgPSBhd2FpdCBhd3NTM01vZHVsZS5saXN0QWxsT2JqZWN0cyhtYXJrZXIpO1xyXG5cclxuICAgICAgaWYgKGF3c09iamVjdHNPdXRwdXQgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cyAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBsZXQgYXdzT2JqZWN0cyA9IGF3c09iamVjdHNPdXRwdXQuQ29udGVudHM7XHJcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgZGlyZWN0b3JpZXMgbmFtZXMgLSBhd3MubGlzdE9iamVjdHMgcmV0dXJucyBhbGwgZmlsZXMgaW4gdGhlIGJ1Y2tldCBpbmNsdWRpbmcgZGlyZWN0b3JpZXMgbmFtZXNcclxuICAgICAgICBhd3NPYmplY3RzID0gYXdzT2JqZWN0cy5maWx0ZXIoKG9iaikgPT4gIW9iai5LZXkuZW5kc1dpdGgoXCIvXCIpKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJvbWlzZUFycmF5ID0gYXdzT2JqZWN0cy5tYXAoa2V5ID0+IHtcclxuICAgICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgaWYgKGF3YWl0IHRoaXMuc2hvdWxkVXBsb2FkRmlsZShyZWRpc01vZHVsZSwgYWRsTW9kdWxlLCBrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhd3NTM01vZHVsZS5kb3dubG9hZEZpbGVGcm9tUzMoa2V5KTtcclxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBGaWxlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgaW4gQURMIG9yIGlmIGEgbmV3IHZlcnNpb24gb2YgdGhlIGZpbGUgZXhpc3RzIGluIFMzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhZGxNb2R1bGUudXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShrZXkuS2V5KTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUocGF0aC5qb2luKHRoaXMudGVtcEZvbGRlciwga2V5LktleSkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHJlZGlzIHdpdGggdGhlIG5ldyBmaWxlXHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy51c2VSZWRpcykge1xyXG4gICAgICAgICAgICAgICAgICBhd2FpdCByZWRpc01vZHVsZS5hZGRGaWxlVG9SZWRpcyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciB3YXMgdGhyb3duIHdoaWxlIHdvcmtpbmcgb24gZWxlbWVudCAke2tleS5LZXl9ICR7ZXh9YCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICBhd2FpdCBwYXJhbGxlbChwcm9taXNlQXJyYXksIHRoaXMuY29uY3VycmVuY3lOdW1iZXIpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGV4KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG1hcmtlciA9IGF3c09iamVjdHNbYXdzT2JqZWN0cy5sZW5ndGggLSAxXS5LZXk7XHJcbiAgICAgICAgYmF0Y2hOdW1iZXIrKztcclxuICAgICAgfVxyXG4gICAgfSB3aGlsZSAoYXdzT2JqZWN0c091dHB1dC5Jc1RydW5jYXRlZCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNob3VsZFVwbG9hZEZpbGUocmVkaXNNb2R1bGU6IFJlZGlzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUsIGtleTogQVdTLlMzLk9iamVjdCkge1xyXG4gICAgbGV0IHNob3VsZFVwbG9hZEZpbGU6IGJvb2xlYW47XHJcblxyXG4gICAgaWYgKHRoaXMudXNlUmVkaXMpIHtcclxuICAgICAgbGV0IG9iajogUmVkaXNPYmplY3QgPSBhd2FpdCByZWRpc01vZHVsZS5pc0ZpbGVJblJlZGlzKGtleSk7XHJcbiAgICAgIGlmIChvYmogPT09IG51bGwpIHtcclxuICAgICAgICAvLyBPYmplY3QgaXMgbm90IGluIHJlZGlzIC0gY2hlY2sgaW4gQURMIGlmIGl0IHNob3VsZCBiZSB1cGxvYWQgYW5kIHVwZGF0ZSByZWRpcyBhbnl3YXlcclxuICAgICAgICBzaG91bGRVcGxvYWRGaWxlID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSk7XHJcbiAgICAgICAgYXdhaXQgcmVkaXNNb2R1bGUuYWRkRmlsZVRvUmVkaXMoa2V5KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBDaGVjayBpZiBmaWxlIHdhcyBtb2RpZmllZCBzaW5jZSB0aGUgbGFzdCB0aW1lIGl0IHdhcyB1cGxvYWRlZFxyXG4gICAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBvYmouRVRhZyAhPT0ga2V5LkVUYWc7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHNob3VsZFVwbG9hZEZpbGUgPSBhd2FpdCBhZGxNb2R1bGUuc2hvdWxkVXBsb2FkVG9BREwoa2V5KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc2hvdWxkVXBsb2FkRmlsZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IHZhcmlhYmxlc0xpc3QgPSBbXCJBV1NfQUNDRVNTX0tFWV9JRFwiLCBcIkFXU19TRUNSRVRfQUNDRVNTX0tFWVwiLCBcIkFXU19SRUdJT05cIiwgXCJBV1NfQlVDS0VUX05BTUVcIixcclxuICAgICAgXCJBWlVSRV9DTElFTlRfSURcIiwgXCJBWlVSRV9ET01BSU5cIiwgXCJBWlVSRV9TRUNSRVRcIiwgXCJBWlVSRV9BRExfQUNDT1VOVF9OQU1FXCIsIFwiVEVNUF9GT0xERVJcIl07XHJcblxyXG4gICAgdmFyaWFibGVzTGlzdC5mb3JFYWNoKCh2YXJpYWJsZSkgPT4ge1xyXG4gICAgICBpZiAoIXByb2Nlc3MuZW52W3ZhcmlhYmxlXSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgJHt2YXJpYWJsZX0gaXMgbm90IGRlZmluZWRgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKHByb2Nlc3MuZW52W1wiVVNFX1JFRElTXCJdKSB7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcInRydWVcIiAmJiBwcm9jZXNzLmVudltcIlVTRV9SRURJU1wiXS50b0xvd2VyQ2FzZSgpICE9PSBcImZhbHNlXCIpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVudmlyb25tZW50IFZhcmlhYmxlIFVTRV9SRURJUyBzaG91bGQgY29udGFpbiBib29sZWFuIHZhbHVlYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBd3NDbGllbnQoYWNjZXNzS2V5SWQ6IHN0cmluZywgc2VjcmV0QWNjZXNzS2V5OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nKTogQVdTLlMzIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgIHJldHVybiBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYGVycm9yIGluaXRpYWxpemluZyBzMyBjbGllbnQ6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQWRsQ2xpZW50KGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZyk6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICByZXR1cm4gbmV3IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KGNyZWRlbnRpYWxzKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
