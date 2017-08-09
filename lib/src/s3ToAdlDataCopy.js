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
            yield this.batchIterationOverS3Items(awsModule, adlModule);
            // After all uploads are completed, delete the cache directory and its sub directories.
            filesHelper_1.deleteFolder(this.tempFolder);
            logger_1.winston.info("all done");
        });
    }
    /**
     *  Go over the items in S3 in batches of 1000.
     *  For each file in batch check if it is missing from ADL lake, if so download it to temp directory and upload to ADL.
     */
    batchIterationOverS3Items(awsS3Module, adlModule) {
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
                                if (yield adlModule.shouldUploadToADL(key)) {
                                    yield awsS3Module.downloadFileFromS3(key);
                                    // Upload File if it doesn't exist in ADL or if a new version of the file exists in S3
                                    yield adlModule.uploadFileToAzureDataLake(key.Key);
                                    yield filesHelper_1.deleteFile(path.join(this.tempFolder, key.Key));
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
    validateEnvironmentVariables() {
        const variablesList = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME",
            "AZURE_CLIENT_ID", "AZURE_DOMAIN", "AZURE_SECRET", "AZURE_ADL_ACCOUNT_NAME", "TEMP_FOLDER"];
        variablesList.forEach((variable) => {
            if (!process.env[variable]) {
                throw new Error(`Environment Variable ${variable} is not defined`);
            }
        });
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ1osZ0JBQU8sQ0FBQyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDcEQsTUFBTSxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFFBQWdCLEVBQUUsTUFBYyxFQUFFLE1BQWM7UUFDMUUsSUFBSSxDQUFDO1lBQ0gsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLENBQUMsMkJBQTJCLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMxRixNQUFNLENBQUMsSUFBSSxjQUFjLENBQUMsNkJBQTZCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDWixnQkFBTyxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUN2RCxNQUFNLEVBQUUsQ0FBQztRQUNYLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUE3SEQsMENBNkhDIiwiZmlsZSI6InNyYy9zM1RvQWRsRGF0YUNvcHkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3luYyBmcm9tIFwiYXN5bmNcIjtcclxuaW1wb3J0ICogYXMgcGFyYWxsZWwgZnJvbSBcImFzeW5jLWF3YWl0LXBhcmFsbGVsXCI7XHJcbmltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgKiBhcyBhZGxzTWFuYWdlbWVudCBmcm9tIFwiYXp1cmUtYXJtLWRhdGFsYWtlLXN0b3JlXCI7XHJcbmltcG9ydCAqIGFzIG1zcmVzdEF6dXJlIGZyb20gXCJtcy1yZXN0LWF6dXJlXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgQXdzUzNNb2R1bGUgfSBmcm9tIFwiLi9hd3NTM01vZHVsZVwiO1xyXG5pbXBvcnQgeyBBenVyZURhdGFMYWtlTW9kdWxlIH0gZnJvbSBcIi4vYXp1cmVEYXRhTGFrZU1vZHVsZVwiO1xyXG5pbXBvcnQgeyBjcmVhdGVEaXJJZk5vdEV4aXN0cywgZGVsZXRlRmlsZSwgZGVsZXRlRm9sZGVyLCBnZXREaXJlY3Rvcmllc1BhdGhBcnJheSB9IGZyb20gXCIuL2ZpbGVzSGVscGVyXCI7XHJcbmltcG9ydCB7IHdpbnN0b24gfSBmcm9tIFwiLi9sb2dnZXJcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBTM1RvQWRsRGF0YUNvcHkge1xyXG4gIHB1YmxpYyBhd3NDbGllbnQ6IEFXUy5TMztcclxuICBwdWJsaWMgYWRsQ2xpZW50OiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudDtcclxuICBwdWJsaWMgYXdzQnVja2V0TmFtZTogc3RyaW5nO1xyXG4gIHB1YmxpYyBhenVyZUFkbEFjY291bnROYW1lOiBzdHJpbmc7XHJcblxyXG4gIHByaXZhdGUgY29uY3VycmVuY3lOdW1iZXIgPSBwcm9jZXNzLmVudi5DT05DVVJSRU5DWV9OVU1CRVIgfHwgMTA7XHJcbiAgcHJpdmF0ZSB0ZW1wRm9sZGVyOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NBY2Nlc3NLZXlJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzU2VjcmV0S2V5OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NSZWdpb246IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlQ2xpZW50SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlRG9tYWluOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZVNlY3JldDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMudmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpO1xyXG5cclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHByb2Nlc3MuZW52LlRFTVBfRk9MREVSO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NLZXlJZCA9IHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXkgPSBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVk7XHJcbiAgICB0aGlzLmF3c1JlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT047XHJcbiAgICB0aGlzLmF3c0J1Y2tldE5hbWUgPSBwcm9jZXNzLmVudi5BV1NfQlVDS0VUX05BTUU7XHJcbiAgICB0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUgPSBwcm9jZXNzLmVudi5BWlVSRV9BRExfQUNDT1VOVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUNsaWVudElkID0gcHJvY2Vzcy5lbnYuQVpVUkVfQ0xJRU5UX0lEO1xyXG4gICAgdGhpcy5henVyZURvbWFpbiA9IHByb2Nlc3MuZW52LkFaVVJFX0RPTUFJTjtcclxuICAgIHRoaXMuYXp1cmVTZWNyZXQgPSBwcm9jZXNzLmVudi5BWlVSRV9TRUNSRVQ7XHJcblxyXG4gICAgLy8gSW5pdGlhbGl6ZSBjbGllbnRzXHJcbiAgICB0aGlzLmF3c0NsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUF3c0NsaWVudCh0aGlzLmF3c0FjY2Vzc0tleUlkLCB0aGlzLmF3c0FjY2Vzc1NlY3JldEtleSwgdGhpcy5hd3NSZWdpb24pO1xyXG4gICAgdGhpcy5hZGxDbGllbnQgPSB0aGlzLmluaXRpYWxpemVBZGxDbGllbnQodGhpcy5henVyZUNsaWVudElkLCB0aGlzLmF6dXJlRG9tYWluLCB0aGlzLmF6dXJlU2VjcmV0KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBoYW5kbGVyKCkge1xyXG4gICAgLy8gY3JlYXRlIHRlbXAgZGlyZWN0b3J5IHdpdGggY2FjaGUgZGlyZWN0b3J5IGluc2lkZSB0byBkb3dubG9hZCBmaWxlcyBmcm9tIHMzIGFuZCB1cGxvYWQgaXQgdG8gQURMLlxyXG4gICAgLy8gSW4gdGhlIGVuZCBvZiB0aGUgcnVuIHRoZSBjYWNoZSBkaXJlY3Rvcnkgd2lsbCBiZSBkZWxldGVkLlxyXG4gICAgY3JlYXRlRGlySWZOb3RFeGlzdHMobnVsbCwgbnVsbCwgdGhpcy50ZW1wRm9sZGVyKTtcclxuICAgIHRoaXMudGVtcEZvbGRlciArPSBcIi9jYWNoZVwiO1xyXG4gICAgY3JlYXRlRGlySWZOb3RFeGlzdHMobnVsbCwgbnVsbCwgdGhpcy50ZW1wRm9sZGVyKTtcclxuXHJcbiAgICBjb25zdCBhd3NNb2R1bGUgPSBuZXcgQXdzUzNNb2R1bGUodGhpcy5hd3NCdWNrZXROYW1lLCB0aGlzLnRlbXBGb2xkZXIsIHRoaXMuYXdzQ2xpZW50KTtcclxuICAgIGNvbnN0IGFkbE1vZHVsZSA9IG5ldyBBenVyZURhdGFMYWtlTW9kdWxlKHRoaXMuYXp1cmVBZGxBY2NvdW50TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCB0aGlzLmFkbENsaWVudCk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5iYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c01vZHVsZSwgYWRsTW9kdWxlKTtcclxuXHJcbiAgICAvLyBBZnRlciBhbGwgdXBsb2FkcyBhcmUgY29tcGxldGVkLCBkZWxldGUgdGhlIGNhY2hlIGRpcmVjdG9yeSBhbmQgaXRzIHN1YiBkaXJlY3Rvcmllcy5cclxuICAgIGRlbGV0ZUZvbGRlcih0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgd2luc3Rvbi5pbmZvKFwiYWxsIGRvbmVcIik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAgR28gb3ZlciB0aGUgaXRlbXMgaW4gUzMgaW4gYmF0Y2hlcyBvZiAxMDAwLlxyXG4gICAqICBGb3IgZWFjaCBmaWxlIGluIGJhdGNoIGNoZWNrIGlmIGl0IGlzIG1pc3NpbmcgZnJvbSBBREwgbGFrZSwgaWYgc28gZG93bmxvYWQgaXQgdG8gdGVtcCBkaXJlY3RvcnkgYW5kIHVwbG9hZCB0byBBREwuXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzUzNNb2R1bGU6IEF3c1MzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGxldCBhd3NPYmplY3RzT3V0cHV0OiBBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ7XHJcbiAgICBsZXQgbWFya2VyID0gXCJcIjtcclxuICAgIGxldCBiYXRjaE51bWJlciA9IDE7XHJcbiAgICBkbyB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhgUHJvY2Vzc2luZyBiYXRjaCAjJHtiYXRjaE51bWJlcn1gKTtcclxuICAgICAgYXdzT2JqZWN0c091dHB1dCA9IGF3YWl0IGF3c1MzTW9kdWxlLmxpc3RBbGxPYmplY3RzKG1hcmtlcik7XHJcblxyXG4gICAgICBpZiAoYXdzT2JqZWN0c091dHB1dCAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzICYmIGF3c09iamVjdHNPdXRwdXQuQ29udGVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGxldCBhd3NPYmplY3RzID0gYXdzT2JqZWN0c091dHB1dC5Db250ZW50cztcclxuICAgICAgICAvLyBGaWx0ZXIgb3V0IHRoZSBkaXJlY3RvcmllcyBuYW1lcyAtIGF3cy5saXN0T2JqZWN0cyByZXR1cm5zIGFsbCBmaWxlcyBpbiB0aGUgYnVja2V0IGluY2x1ZGluZyBkaXJlY3RvcmllcyBuYW1lc1xyXG4gICAgICAgIGF3c09iamVjdHMgPSBhd3NPYmplY3RzLmZpbHRlcigob2JqKSA9PiAhb2JqLktleS5lbmRzV2l0aChcIi9cIikpO1xyXG5cclxuICAgICAgICBjb25zdCBwcm9taXNlQXJyYXkgPSBhd3NPYmplY3RzLm1hcChrZXkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBpZiAoYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSkpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGF3c1MzTW9kdWxlLmRvd25sb2FkRmlsZUZyb21TMyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIEZpbGUgaWYgaXQgZG9lc24ndCBleGlzdCBpbiBBREwgb3IgaWYgYSBuZXcgdmVyc2lvbiBvZiB0aGUgZmlsZSBleGlzdHMgaW4gUzNcclxuICAgICAgICAgICAgICAgIGF3YWl0IGFkbE1vZHVsZS51cGxvYWRGaWxlVG9BenVyZURhdGFMYWtlKGtleS5LZXkpO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgZGVsZXRlRmlsZShwYXRoLmpvaW4odGhpcy50ZW1wRm9sZGVyLCBrZXkuS2V5KSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIHdhcyB0aHJvd24gd2hpbGUgd29ya2luZyBvbiBlbGVtZW50ICR7a2V5LktleX0gJHtleH1gKTtcclxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgIGF3YWl0IHBhcmFsbGVsKHByb21pc2VBcnJheSwgdGhpcy5jb25jdXJyZW5jeU51bWJlcik7XHJcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWFya2VyID0gYXdzT2JqZWN0c1thd3NPYmplY3RzLmxlbmd0aCAtIDFdLktleTtcclxuICAgICAgICBiYXRjaE51bWJlcisrO1xyXG4gICAgICB9XHJcbiAgICB9IHdoaWxlIChhd3NPYmplY3RzT3V0cHV0LklzVHJ1bmNhdGVkKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IHZhcmlhYmxlc0xpc3QgPSBbXCJBV1NfQUNDRVNTX0tFWV9JRFwiLCBcIkFXU19TRUNSRVRfQUNDRVNTX0tFWVwiLCBcIkFXU19SRUdJT05cIiwgXCJBV1NfQlVDS0VUX05BTUVcIixcclxuICAgICAgXCJBWlVSRV9DTElFTlRfSURcIiwgXCJBWlVSRV9ET01BSU5cIiwgXCJBWlVSRV9TRUNSRVRcIiwgXCJBWlVSRV9BRExfQUNDT1VOVF9OQU1FXCIsIFwiVEVNUF9GT0xERVJcIl07XHJcblxyXG4gICAgdmFyaWFibGVzTGlzdC5mb3JFYWNoKCh2YXJpYWJsZSkgPT4ge1xyXG4gICAgICBpZiAoIXByb2Nlc3MuZW52W3ZhcmlhYmxlXSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgJHt2YXJpYWJsZX0gaXMgbm90IGRlZmluZWRgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBd3NDbGllbnQoYWNjZXNzS2V5SWQ6IHN0cmluZywgc2VjcmV0QWNjZXNzS2V5OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nKTogQVdTLlMzIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgIHJldHVybiBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYGVycm9yIGluaXRpYWxpemluZyBzMyBjbGllbnQ6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQWRsQ2xpZW50KGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZyk6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICByZXR1cm4gbmV3IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KGNyZWRlbnRpYWxzKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
