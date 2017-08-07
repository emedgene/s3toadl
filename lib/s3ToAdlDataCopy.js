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
const rimraf = require("rimraf");
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
            const awsModule = new awsS3Module_1.AwsS3Module(this.awsAccessKeyId, this.awsAccessSecretKey, this.awsRegion, this.awsBucketName, this.tempFolder);
            const adlModule = new azureDataLakeModule_1.AzureDataLakeModule(this.azureAdlAccountName, this.azureClientId, this.azureDomain, this.azureSecret, this.tempFolder);
            yield this.batchIterationOverS3Items(awsModule, adlModule);
            // After all uploads are completed, delete the cache directory and its sub directories.
            rimraf(this.tempFolder, (err) => {
                if (err) {
                    logger_1.winston.error("Error deleting temp directories" + err);
                }
                logger_1.winston.info("all done");
            });
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
            do {
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
                                }
                            }
                            catch (ex) {
                                logger_1.winston.log("error", "error was thrown while working on element %s %s", key.Key, ex);
                                return null;
                            }
                        });
                    });
                    yield parallel(promiseArray, this.concurrencyNumber);
                    marker = awsObjects[awsObjects.length - 1].Key;
                }
            } while (awsObjectsOutput.IsTruncated);
        });
    }
    validateEnvironmentVariables() {
        const variablesList = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME",
            "AZURE_CLIENT_ID", "AZURE_DOMAIN", "AZURE_SECRET", "AZURE_ADL_ACCOUNT_NAME", "TEMP_FOLDER"];
        variablesList.forEach((variable) => {
            if (!process.env[variable]) {
                throw new Error("Environment Variable " + variable + " is not defined");
            }
        });
    }
}
exports.S3ToAdlDataCopy = S3ToAdlDataCopy;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zM1RvQWRsRGF0YUNvcHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLGlEQUFpRDtBQUNqRCxpQ0FBaUM7QUFDakMscUNBQW1DO0FBQ25DLCtDQUE0QztBQUM1QywrREFBNEQ7QUFDNUQsK0NBQThFO0FBRTlFO0lBYUU7UUFYUSxzQkFBaUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQztRQVkvRCxJQUFJLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUVwQyxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDO1FBQzFDLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQztRQUNwRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQztRQUM1RCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUM7UUFDakQsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUM7UUFDOUQsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQztRQUNqRCxJQUFJLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO1FBQzVDLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7SUFDOUMsQ0FBQztJQUVZLE9BQU87O1lBQ2xCLG9HQUFvRztZQUNwRyw2REFBNkQ7WUFDN0Qsa0NBQW9CLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEQsSUFB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QyxXQUFXLEVBQUU7UUFDekMsQ0FBQztLQUFBO0lBRU8sNEJBQTRCO1FBQ2xDLE1BQU0sYUFBYSxHQUFHLENBQUMsbUJBQW1CLEVBQUUsdUJBQXVCLEVBQUUsWUFBWSxFQUFFLGlCQUFpQjtZQUNsRyxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLHdCQUF3QixFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBRTlGLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRO1lBQzdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLEdBQUcsUUFBUSxHQUFHLGlCQUFpQixDQUFDLENBQUM7WUFDMUUsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBOUZELDBDQThGQyIsImZpbGUiOiJzM1RvQWRsRGF0YUNvcHkuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhc3luYyBmcm9tIFwiYXN5bmNcIjtcclxuaW1wb3J0ICogYXMgcGFyYWxsZWwgZnJvbSBcImFzeW5jLWF3YWl0LXBhcmFsbGVsXCI7XHJcbmltcG9ydCAqIGFzIHJpbXJhZiBmcm9tIFwicmltcmFmXCI7XHJcbmltcG9ydCB7IHdpbnN0b24gfSBmcm9tIFwiLi9sb2dnZXJcIjtcclxuaW1wb3J0IHsgQXdzUzNNb2R1bGUgfSBmcm9tIFwiLi9hd3NTM01vZHVsZVwiO1xyXG5pbXBvcnQgeyBBenVyZURhdGFMYWtlTW9kdWxlIH0gZnJvbSBcIi4vYXp1cmVEYXRhTGFrZU1vZHVsZVwiO1xyXG5pbXBvcnQgeyBjcmVhdGVEaXJJZk5vdEV4aXN0cywgZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkgfSBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIFMzVG9BZGxEYXRhQ29weSB7XHJcblxyXG4gIHByaXZhdGUgY29uY3VycmVuY3lOdW1iZXIgPSBwcm9jZXNzLmVudi5DT05DVVJSRU5DWV9OVU1CRVIgfHwgMTA7XHJcbiAgcHJpdmF0ZSB0ZW1wRm9sZGVyOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NBY2Nlc3NLZXlJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgYXdzQWNjZXNzU2VjcmV0S2V5OiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhd3NSZWdpb246IHN0cmluZztcclxuICBwcml2YXRlIGF3c0J1Y2tldE5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlQWRsQWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlQ2xpZW50SWQ6IHN0cmluZztcclxuICBwcml2YXRlIGF6dXJlRG9tYWluOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSBhenVyZVNlY3JldDogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMudmFsaWRhdGVFbnZpcm9ubWVudFZhcmlhYmxlcygpO1xyXG5cclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHByb2Nlc3MuZW52LlRFTVBfRk9MREVSO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NLZXlJZCA9IHByb2Nlc3MuZW52LkFXU19BQ0NFU1NfS0VZX0lEO1xyXG4gICAgdGhpcy5hd3NBY2Nlc3NTZWNyZXRLZXkgPSBwcm9jZXNzLmVudi5BV1NfU0VDUkVUX0FDQ0VTU19LRVk7XHJcbiAgICB0aGlzLmF3c1JlZ2lvbiA9IHByb2Nlc3MuZW52LkFXU19SRUdJT047XHJcbiAgICB0aGlzLmF3c0J1Y2tldE5hbWUgPSBwcm9jZXNzLmVudi5BV1NfQlVDS0VUX05BTUU7XHJcbiAgICB0aGlzLmF6dXJlQWRsQWNjb3VudE5hbWUgPSBwcm9jZXNzLmVudi5BWlVSRV9BRExfQUNDT1VOVF9OQU1FO1xyXG4gICAgdGhpcy5henVyZUNsaWVudElkID0gcHJvY2Vzcy5lbnYuQVpVUkVfQ0xJRU5UX0lEO1xyXG4gICAgdGhpcy5henVyZURvbWFpbiA9IHByb2Nlc3MuZW52LkFaVVJFX0RPTUFJTjtcclxuICAgIHRoaXMuYXp1cmVTZWNyZXQgPSBwcm9jZXNzLmVudi5BWlVSRV9TRUNSRVQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgaGFuZGxlcigpIHtcclxuICAgIC8vIGNyZWF0ZSB0ZW1wIGRpcmVjdG9yeSB3aXRoIGNhY2hlIGRpcmVjdG9yeSBpbnNpZGUgdG8gZG93bmxvYWQgZmlsZXMgZnJvbSBzMyBhbmQgdXBsb2FkIGl0IHRvIEFETC5cclxuICAgIC8vIEluIHRoZSBlbmQgb2YgdGhlIHJ1biB0aGUgY2FjaGUgZGlyZWN0b3J5IHdpbGwgYmUgZGVsZXRlZC5cclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgKz0gXCIvY2FjaGVcIjtcclxuICAgIGNyZWF0ZURpcklmTm90RXhpc3RzKG51bGwsIG51bGwsIHRoaXMudGVtcEZvbGRlcik7XHJcblxyXG4gICAgY29uc3QgYXdzTW9kdWxlID0gbmV3IEF3c1MzTW9kdWxlKHRoaXMuYXdzQWNjZXNzS2V5SWQsIHRoaXMuYXdzQWNjZXNzU2VjcmV0S2V5LCB0aGlzLmF3c1JlZ2lvbiwgdGhpcy5hd3NCdWNrZXROYW1lLCB0aGlzLnRlbXBGb2xkZXIpO1xyXG4gICAgY29uc3QgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUodGhpcy5henVyZUFkbEFjY291bnROYW1lLCB0aGlzLmF6dXJlQ2xpZW50SWQsIHRoaXMuYXp1cmVEb21haW4sIHRoaXMuYXp1cmVTZWNyZXQsIHRoaXMudGVtcEZvbGRlcik7XHJcblxyXG4gICAgYXdhaXQgdGhpcy5iYXRjaEl0ZXJhdGlvbk92ZXJTM0l0ZW1zKGF3c01vZHVsZSwgYWRsTW9kdWxlKTtcclxuXHJcbiAgICAvLyBBZnRlciBhbGwgdXBsb2FkcyBhcmUgY29tcGxldGVkLCBkZWxldGUgdGhlIGNhY2hlIGRpcmVjdG9yeSBhbmQgaXRzIHN1YiBkaXJlY3Rvcmllcy5cclxuICAgIHJpbXJhZih0aGlzLnRlbXBGb2xkZXIsIChlcnIpID0+IHtcclxuICAgICAgaWYgKGVycikge1xyXG4gICAgICAgIHdpbnN0b24uZXJyb3IoXCJFcnJvciBkZWxldGluZyB0ZW1wIGRpcmVjdG9yaWVzXCIgKyBlcnIpO1xyXG4gICAgICB9XHJcbiAgICAgIHdpbnN0b24uaW5mbyhcImFsbCBkb25lXCIpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAgR28gb3ZlciB0aGUgaXRlbXMgaW4gUzMgaW4gYmF0Y2hlcyBvZiAxMDAwLlxyXG4gICAqICBGb3IgZWFjaCBmaWxlIGluIGJhdGNoIGNoZWNrIGlmIGl0IGlzIG1pc3NpbmcgZnJvbSBBREwgbGFrZSwgaWYgc28gZG93bmxvYWQgaXQgdG8gdGVtcCBkaXJlY3RvcnkgYW5kIHVwbG9hZCB0byBBREwuXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIGJhdGNoSXRlcmF0aW9uT3ZlclMzSXRlbXMoYXdzUzNNb2R1bGU6IEF3c1MzTW9kdWxlLCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGxldCBhd3NPYmplY3RzT3V0cHV0OiBBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ7XHJcbiAgICBsZXQgbWFya2VyID0gXCJcIjtcclxuICAgIGRvIHtcclxuICAgICAgYXdzT2JqZWN0c091dHB1dCA9IGF3YWl0IGF3c1MzTW9kdWxlLmxpc3RBbGxPYmplY3RzKG1hcmtlcik7XHJcblxyXG4gICAgICBpZiAoYXdzT2JqZWN0c091dHB1dCAmJiBhd3NPYmplY3RzT3V0cHV0LkNvbnRlbnRzICYmIGF3c09iamVjdHNPdXRwdXQuQ29udGVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGxldCBhd3NPYmplY3RzID0gYXdzT2JqZWN0c091dHB1dC5Db250ZW50cztcclxuICAgICAgICAvLyBGaWx0ZXIgb3V0IHRoZSBkaXJlY3RvcmllcyBuYW1lcyAtIGF3cy5saXN0T2JqZWN0cyByZXR1cm5zIGFsbCBmaWxlcyBpbiB0aGUgYnVja2V0IGluY2x1ZGluZyBkaXJlY3RvcmllcyBuYW1lc1xyXG4gICAgICAgIGF3c09iamVjdHMgPSBhd3NPYmplY3RzLmZpbHRlcigob2JqKSA9PiAhb2JqLktleS5lbmRzV2l0aChcIi9cIikpO1xyXG5cclxuICAgICAgICBjb25zdCBwcm9taXNlQXJyYXkgPSBhd3NPYmplY3RzLm1hcChrZXkgPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICBpZiAoYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKGtleSkpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGF3c1MzTW9kdWxlLmRvd25sb2FkRmlsZUZyb21TMyhrZXkpO1xyXG4gICAgICAgICAgICAgICAgLy8gVXBsb2FkIEZpbGUgaWYgaXQgZG9lc24ndCBleGlzdCBpbiBBREwgb3IgaWYgYSBuZXcgdmVyc2lvbiBvZiB0aGUgZmlsZSBleGlzdHMgaW4gUzNcclxuICAgICAgICAgICAgICAgIGF3YWl0IGFkbE1vZHVsZS51cGxvYWRGaWxlVG9BenVyZURhdGFMYWtlKGtleS5LZXkpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmxvZyhcImVycm9yXCIsIFwiZXJyb3Igd2FzIHRocm93biB3aGlsZSB3b3JraW5nIG9uIGVsZW1lbnQgJXMgJXNcIiwga2V5LktleSwgZXgpO1xyXG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBhd2FpdCBwYXJhbGxlbChwcm9taXNlQXJyYXksIHRoaXMuY29uY3VycmVuY3lOdW1iZXIpO1xyXG4gICAgICAgIG1hcmtlciA9IGF3c09iamVjdHNbYXdzT2JqZWN0cy5sZW5ndGggLSAxXS5LZXk7XHJcbiAgICAgIH1cclxuICAgIH0gd2hpbGUgKGF3c09iamVjdHNPdXRwdXQuSXNUcnVuY2F0ZWQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB2YWxpZGF0ZUVudmlyb25tZW50VmFyaWFibGVzKCkge1xyXG4gICAgY29uc3QgdmFyaWFibGVzTGlzdCA9IFtcIkFXU19BQ0NFU1NfS0VZX0lEXCIsIFwiQVdTX1NFQ1JFVF9BQ0NFU1NfS0VZXCIsIFwiQVdTX1JFR0lPTlwiLCBcIkFXU19CVUNLRVRfTkFNRVwiLFxyXG4gICAgICBcIkFaVVJFX0NMSUVOVF9JRFwiLCBcIkFaVVJFX0RPTUFJTlwiLCBcIkFaVVJFX1NFQ1JFVFwiLCBcIkFaVVJFX0FETF9BQ0NPVU5UX05BTUVcIiwgXCJURU1QX0ZPTERFUlwiXTtcclxuXHJcbiAgICB2YXJpYWJsZXNMaXN0LmZvckVhY2goKHZhcmlhYmxlKSA9PiB7XHJcbiAgICAgIGlmICghcHJvY2Vzcy5lbnZbdmFyaWFibGVdKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW52aXJvbm1lbnQgVmFyaWFibGUgXCIgKyB2YXJpYWJsZSArIFwiIGlzIG5vdCBkZWZpbmVkXCIpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn0iXSwic291cmNlUm9vdCI6IiJ9
