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
const logger_1 = require("./logger");
const awsS3Module_1 = require("./awsS3Module");
const azureDataLakeModule_1 = require("./azureDataLakeModule");
const filesHelper_1 = require("./filesHelper");
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
    }
    handler() {
        return __awaiter(this, void 0, void 0, function* () {
            // create temp directory with cache directory inside to download files from s3 and upload it to ADL.
            // In the end of the run the cache directory will be deleted.
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            this.tempFolder += "/cache";
            filesHelper_1.createDirIfNotExists(null, null, this.tempFolder);
            const awsClient = this.initializeAwsClient(this.awsAccessKeyId, this.awsAccessSecretKey, this.awsRegion);
            const awsModule = new awsS3Module_1.AwsS3Module(this.awsBucketName, this.tempFolder, awsClient);
            const adlClient = this.initializeAdlClient(this.azureClientId, this.azureDomain, this.azureSecret);
            const adlModule = new azureDataLakeModule_1.AzureDataLakeModule(this.azureAdlAccountName, this.tempFolder, adlClient);
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
                logger_1.winston.info(`Starting batch #${batchNumber}`);
                awsObjectsOutput = yield awsS3Module.listAllObjects(marker);
                if (awsObjectsOutput && awsObjectsOutput.Contents && awsObjectsOutput.Contents.length > 0) {
                    let awsObjects = awsObjectsOutput.Contents;
                    // Filter out the directories names - aws.listObjects returns all files in the bucket including directories names
                    awsObjects = awsObjects.filter((obj) => !obj.Key.endsWith("/") && obj.Key.includes("/"));
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
                    yield parallel(promiseArray, this.concurrencyNumber);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RUFBRSxDQUFDLENBQUM7WUFDcEQsTUFBTSxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVPLG1CQUFtQixDQUFDLFFBQWdCLEVBQUUsTUFBYyxFQUFFLE1BQWM7UUFDMUUsSUFBSSxDQUFDO1lBQ0gsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLENBQUMsMkJBQTJCLENBQUMsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUMxRixNQUFNLENBQUMsSUFBSSxjQUFjLENBQUMsNkJBQTZCLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdkUsQ0FBQztRQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDWixnQkFBTyxDQUFDLEtBQUssQ0FBQyxtQ0FBbUMsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUN2RCxNQUFNLEVBQUUsQ0FBQztRQUNYLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFySEQsMENBcUhDIiwiZmlsZSI6InNyYy9zM1RvQWRsRGF0YUNvcHkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3luYyBmcm9tIFwiYXN5bmNcIjtcclxuaW1wb3J0ICogYXMgcGFyYWxsZWwgZnJvbSBcImFzeW5jLWF3YWl0LXBhcmFsbGVsXCI7XHJcbmltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgKiBhcyBhZGxzTWFuYWdlbWVudCBmcm9tIFwiYXp1cmUtYXJtLWRhdGFsYWtlLXN0b3JlXCI7XHJcbmltcG9ydCAqIGFzIG1zcmVzdEF6dXJlIGZyb20gXCJtcy1yZXN0LWF6dXJlXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBBd3NTM01vZHVsZSB9IGZyb20gXCIuL2F3c1MzTW9kdWxlXCI7XHJcbmltcG9ydCB7IEF6dXJlRGF0YUxha2VNb2R1bGUgfSBmcm9tIFwiLi9henVyZURhdGFMYWtlTW9kdWxlXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBkZWxldGVGaWxlLCBkZWxldGVGb2xkZXIsIGdldERpcmVjdG9yaWVzUGF0aEFycmF5IH0gZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBTM1RvQWRsRGF0YUNvcHkge1xyXG5cclxuICBwcml2YXRlIGNvbmN1cnJlbmN5TnVtYmVyID0gcHJvY2Vzcy5lbnYuQ09OQ1VSUkVOQ1lfTlVNQkVSIHx8IDEwO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzS2V5SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF3c0FjY2Vzc1NlY3JldEtleTogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzUmVnaW9uOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NCdWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUFkbEFjY291bnROYW1lOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZUNsaWVudElkOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZURvbWFpbjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXp1cmVTZWNyZXQ6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLnZhbGlkYXRlRW52aXJvbm1lbnRWYXJpYWJsZXMoKTtcclxuXHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSBwcm9jZXNzLmVudi5URU1QX0ZPTERFUjtcclxuICAgIHRoaXMuYXdzQWNjZXNzS2V5SWQgPSBwcm9jZXNzLmVudi5BV1NfQUNDRVNTX0tFWV9JRDtcclxuICAgIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5ID0gcHJvY2Vzcy5lbnYuQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZO1xyXG4gICAgdGhpcy5hd3NSZWdpb24gPSBwcm9jZXNzLmVudi5BV1NfUkVHSU9OO1xyXG4gICAgdGhpcy5hd3NCdWNrZXROYW1lID0gcHJvY2Vzcy5lbnYuQVdTX0JVQ0tFVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUFkbEFjY291bnROYW1lID0gcHJvY2Vzcy5lbnYuQVpVUkVfQURMX0FDQ09VTlRfTkFNRTtcclxuICAgIHRoaXMuYXp1cmVDbGllbnRJZCA9IHByb2Nlc3MuZW52LkFaVVJFX0NMSUVOVF9JRDtcclxuICAgIHRoaXMuYXp1cmVEb21haW4gPSBwcm9jZXNzLmVudi5BWlVSRV9ET01BSU47XHJcbiAgICB0aGlzLmF6dXJlU2VjcmV0ID0gcHJvY2Vzcy5lbnYuQVpVUkVfU0VDUkVUO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGhhbmRsZXIoKSB7XHJcbiAgICAvLyBjcmVhdGUgdGVtcCBkaXJlY3Rvcnkgd2l0aCBjYWNoZSBkaXJlY3RvcnkgaW5zaWRlIHRvIGRvd25sb2FkIGZpbGVzIGZyb20gczMgYW5kIHVwbG9hZCBpdCB0byBBREwuXHJcbiAgICAvLyBJbiB0aGUgZW5kIG9mIHRoZSBydW4gdGhlIGNhY2hlIGRpcmVjdG9yeSB3aWxsIGJlIGRlbGV0ZWQuXHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgdGhpcy50ZW1wRm9sZGVyICs9IFwiL2NhY2hlXCI7XHJcbiAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhudWxsLCBudWxsLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG5cclxuICAgIGNvbnN0IGF3c0NsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUF3c0NsaWVudCh0aGlzLmF3c0FjY2Vzc0tleUlkLCB0aGlzLmF3c0FjY2Vzc1NlY3JldEtleSwgdGhpcy5hd3NSZWdpb24pO1xyXG4gICAgY29uc3QgYXdzTW9kdWxlID0gbmV3IEF3c1MzTW9kdWxlKHRoaXMuYXdzQnVja2V0TmFtZSwgdGhpcy50ZW1wRm9sZGVyLCBhd3NDbGllbnQpO1xyXG5cclxuICAgIGNvbnN0IGFkbENsaWVudCA9IHRoaXMuaW5pdGlhbGl6ZUFkbENsaWVudCh0aGlzLmF6dXJlQ2xpZW50SWQsIHRoaXMuYXp1cmVEb21haW4sIHRoaXMuYXp1cmVTZWNyZXQpO1xyXG4gICAgY29uc3QgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUodGhpcy5henVyZUFkbEFjY291bnROYW1lLCB0aGlzLnRlbXBGb2xkZXIsIGFkbENsaWVudCk7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5iYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c01vZHVsZSwgYWRsTW9kdWxlKTtcclxuXHJcbiAgICAvLyBBZnRlciBhbGwgdXBsb2FkcyBhcmUgY29tcGxldGVkLCBkZWxldGUgdGhlIGNhY2hlIGRpcmVjdG9yeSBhbmQgaXRzIHN1YiBkaXJlY3Rvcmllcy5cclxuICAgIGRlbGV0ZUZvbGRlcih0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgd2luc3Rvbi5pbmZvKFwiYWxsIGRvbmVcIik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAgR28gb3ZlciB0aGUgaXRlbXMgaW4gUzMgaW4gYmF0Y2hlcyBvZiAxMDAwLlxyXG4gICAqICBGb3IgZWFjaCBmaWxlIGluIGJhdGNoIGNoZWNrIGlmIGl0IGlzIG1pc3NpbmcgZnJvbSBBREwgbGFrZSwgaWYgc28gZG93bmxvYWQgaXQgdG8gdGVtcCBkaXJlY3RvcnkgYW5kIHVwbG9hZCB0byBBREwuXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzUzNNb2R1bGU6IEF3c1MzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGxldCBhd3NPYmplY3RzT3V0cHV0OiBBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ7XHJcbiAgICBsZXQgbWFya2VyID0gXCJcIjtcclxuICAgIGxldCBiYXRjaE51bWJlciA9IDE7XHJcbiAgICBkbyB7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhgU3RhcnRpbmcgYmF0Y2ggIyR7YmF0Y2hOdW1iZXJ9YCk7XHJcbiAgICAgIGF3c09iamVjdHNPdXRwdXQgPSBhd2FpdCBhd3NTM01vZHVsZS5saXN0QWxsT2JqZWN0cyhtYXJrZXIpO1xyXG5cclxuICAgICAgaWYgKGF3c09iamVjdHNPdXRwdXQgJiYgYXdzT2JqZWN0c091dHB1dC5Db250ZW50cyAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBsZXQgYXdzT2JqZWN0cyA9IGF3c09iamVjdHNPdXRwdXQuQ29udGVudHM7XHJcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgZGlyZWN0b3JpZXMgbmFtZXMgLSBhd3MubGlzdE9iamVjdHMgcmV0dXJucyBhbGwgZmlsZXMgaW4gdGhlIGJ1Y2tldCBpbmNsdWRpbmcgZGlyZWN0b3JpZXMgbmFtZXNcclxuICAgICAgICBhd3NPYmplY3RzID0gYXdzT2JqZWN0cy5maWx0ZXIoKG9iaikgPT4gIW9iai5LZXkuZW5kc1dpdGgoXCIvXCIpICYmIG9iai5LZXkuaW5jbHVkZXMoXCIvXCIpKTtcclxuXHJcbiAgICAgICAgY29uc3QgcHJvbWlzZUFycmF5ID0gYXdzT2JqZWN0cy5tYXAoa2V5ID0+IHtcclxuICAgICAgICAgIHJldHVybiBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgaWYgKGF3YWl0IGFkbE1vZHVsZS5zaG91bGRVcGxvYWRUb0FETChrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhd3NTM01vZHVsZS5kb3dubG9hZEZpbGVGcm9tUzMoa2V5KTtcclxuICAgICAgICAgICAgICAgIC8vIFVwbG9hZCBGaWxlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgaW4gQURMIG9yIGlmIGEgbmV3IHZlcnNpb24gb2YgdGhlIGZpbGUgZXhpc3RzIGluIFMzXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBhZGxNb2R1bGUudXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShrZXkuS2V5KTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGRlbGV0ZUZpbGUocGF0aC5qb2luKHRoaXMudGVtcEZvbGRlciwga2V5LktleSkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciB3YXMgdGhyb3duIHdoaWxlIHdvcmtpbmcgb24gZWxlbWVudCAke2tleS5LZXl9ICR7ZXh9YCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGF3YWl0IHBhcmFsbGVsKHByb21pc2VBcnJheSwgdGhpcy5jb25jdXJyZW5jeU51bWJlcik7XHJcbiAgICAgICAgbWFya2VyID0gYXdzT2JqZWN0c1thd3NPYmplY3RzLmxlbmd0aCAtIDFdLktleTtcclxuICAgICAgICBiYXRjaE51bWJlcisrO1xyXG4gICAgICB9XHJcbiAgICB9IHdoaWxlIChhd3NPYmplY3RzT3V0cHV0LklzVHJ1bmNhdGVkKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpIHtcclxuICAgIGNvbnN0IHZhcmlhYmxlc0xpc3QgPSBbXCJBV1NfQUNDRVNTX0tFWV9JRFwiLCBcIkFXU19TRUNSRVRfQUNDRVNTX0tFWVwiLCBcIkFXU19SRUdJT05cIiwgXCJBV1NfQlVDS0VUX05BTUVcIixcclxuICAgICAgXCJBWlVSRV9DTElFTlRfSURcIiwgXCJBWlVSRV9ET01BSU5cIiwgXCJBWlVSRV9TRUNSRVRcIiwgXCJBWlVSRV9BRExfQUNDT1VOVF9OQU1FXCIsIFwiVEVNUF9GT0xERVJcIl07XHJcblxyXG4gICAgdmFyaWFibGVzTGlzdC5mb3JFYWNoKCh2YXJpYWJsZSkgPT4ge1xyXG4gICAgICBpZiAoIXByb2Nlc3MuZW52W3ZhcmlhYmxlXSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgVmFyaWFibGUgJHt2YXJpYWJsZX0gaXMgbm90IGRlZmluZWRgKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXRpYWxpemVBd3NDbGllbnQoYWNjZXNzS2V5SWQ6IHN0cmluZywgc2VjcmV0QWNjZXNzS2V5OiBzdHJpbmcsIHJlZ2lvbjogc3RyaW5nKTogQVdTLlMzIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgIHJldHVybiBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmluZm8oYGVycm9yIGluaXRpYWxpemluZyBzMyBjbGllbnQ6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpbml0aWFsaXplQWRsQ2xpZW50KGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZyk6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICByZXR1cm4gbmV3IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KGNyZWRlbnRpYWxzKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
