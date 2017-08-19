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
const fs = require("fs");
const path = require("path");
const filesHelper = require("./filesHelper");
const logger_1 = require("./logger");
class AzureDataLakeModule {
    constructor(accountName, tempFolder, fileSystemClient) {
        this.accountName = accountName;
        this.tempFolder = tempFolder;
        this.filesystemClient = fileSystemClient;
    }
    /**
     * Checks if aws file exists in ADL, or if S3 holds a newer version of file
     * @param awsFile - the file to validate
     */
    shouldUploadToADL(awsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileFullName = awsFile.Key;
            try {
                const file = yield this.filesystemClient.fileSystem.getFileStatus(this.accountName, fileFullName);
                logger_1.winston.verbose(`file: ${fileFullName} already exists in data lake`);
                // If file exist in Azure Data Lake but it"s been updated in aws - upload it again
                return file.fileStatus.modificationTime < awsFile.LastModified.getTime();
            }
            catch (ex) {
                if (ex.body && ex.body && ex.body.remoteException && ex.body.remoteException.exception === "FileNotFoundException") {
                    logger_1.winston.info(`file: ${fileFullName} doesn't exists in ADL`);
                    return true;
                }
                else {
                    throw ex;
                }
            }
        });
    }
    /**
     *  Upload local file to ADL.
     *  Validates that all directories in the file path exists in ADL files system - if not create the missing directories
     * @param filePath - the path where the file to upload is located
     */
    uploadFileToAzureDataLake(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const directoriesList = filesHelper.getDirectoriesPathArray(filePath);
            const localFilePath = path.join(this.tempFolder, filePath);
            try {
                // Create folders in ADL if needed
                yield this.filesystemClient.fileSystem.mkdirs(this.accountName, directoriesList.join("/"));
                const options = {
                    overwrite: true,
                    streamContents: fs.createReadStream(localFilePath),
                };
                // Upload file to Azure Data Lake
                yield this.filesystemClient.fileSystem.create(this.accountName, filePath, options);
                logger_1.winston.info(`Upload file ${filePath} successfully`);
            }
            catch (ex) {
                logger_1.winston.error(`error while uploading file to ADL: ${ex}`);
                throw ex;
            }
        });
    }
}
exports.AzureDataLakeModule = AzureDataLakeModule;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9henVyZURhdGFMYWtlTW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLDZDQUE2QztBQUM3QyxxQ0FBbUM7QUFFbkM7SUFLRSxZQUFZLFdBQW1CLEVBQUUsVUFBa0IsRUFBRSxnQkFBOEQ7UUFDakgsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7O09BR0c7SUFDVSxpQkFBaUIsQ0FBQyxPQUFzQjs7WUFDbkQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNqQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNsRyxnQkFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFlBQVksOEJBQThCLENBQUMsQ0FBQztnQkFFckUsa0ZBQWtGO2dCQUNsRixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzNFLENBQUM7WUFDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNWLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEtBQUssdUJBQXVCLENBQUMsQ0FBQyxDQUFDO29CQUNuSCxnQkFBTyxDQUFDLElBQUksQ0FBQyxTQUFTLFlBQVksd0JBQXdCLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDZCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLE1BQU0sRUFBRSxDQUFDO2dCQUNYLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRUQ7Ozs7T0FJRztJQUNVLHlCQUF5QixDQUFDLFFBQWdCOztZQUNyRCxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRTNELElBQUksQ0FBQztnQkFDSCxrQ0FBa0M7Z0JBQ2xDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTNGLE1BQU0sT0FBTyxHQUFHO29CQUNkLFNBQVMsRUFBRSxJQUFJO29CQUNmLGNBQWMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO2lCQUNuRCxDQUFDO2dCQUVGLGlDQUFpQztnQkFDakMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDbkYsZ0JBQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxRQUFRLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLHNDQUFzQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUMxRCxNQUFNLEVBQUUsQ0FBQztZQUNYLENBQUM7UUFDSCxDQUFDO0tBQUE7Q0FDRjtBQTVERCxrREE0REMiLCJmaWxlIjoic3JjL2F6dXJlRGF0YUxha2VNb2R1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuaW1wb3J0ICogYXMgYWRsc01hbmFnZW1lbnQgZnJvbSBcImF6dXJlLWFybS1kYXRhbGFrZS1zdG9yZVwiO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tIFwiZnNcIjtcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgKiBhcyBmaWxlc0hlbHBlciBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5pbXBvcnQgeyB3aW5zdG9uIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQXp1cmVEYXRhTGFrZU1vZHVsZSB7XHJcbiAgcHJpdmF0ZSBmaWxlc3lzdGVtQ2xpZW50OiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudDtcclxuICBwcml2YXRlIGFjY291bnROYW1lOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0ZW1wRm9sZGVyOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGFjY291bnROYW1lOiBzdHJpbmcsIHRlbXBGb2xkZXI6IHN0cmluZywgZmlsZVN5c3RlbUNsaWVudDogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQpIHtcclxuICAgIHRoaXMuYWNjb3VudE5hbWUgPSBhY2NvdW50TmFtZTtcclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHRlbXBGb2xkZXI7XHJcbiAgICB0aGlzLmZpbGVzeXN0ZW1DbGllbnQgPSBmaWxlU3lzdGVtQ2xpZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIGF3cyBmaWxlIGV4aXN0cyBpbiBBREwsIG9yIGlmIFMzIGhvbGRzIGEgbmV3ZXIgdmVyc2lvbiBvZiBmaWxlXHJcbiAgICogQHBhcmFtIGF3c0ZpbGUgLSB0aGUgZmlsZSB0byB2YWxpZGF0ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBzaG91bGRVcGxvYWRUb0FETChhd3NGaWxlOiBBV1MuUzMuT2JqZWN0KTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICBjb25zdCBmaWxlRnVsbE5hbWUgPSBhd3NGaWxlLktleTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5nZXRGaWxlU3RhdHVzKHRoaXMuYWNjb3VudE5hbWUsIGZpbGVGdWxsTmFtZSk7XHJcbiAgICAgIHdpbnN0b24udmVyYm9zZShgZmlsZTogJHtmaWxlRnVsbE5hbWV9IGFscmVhZHkgZXhpc3RzIGluIGRhdGEgbGFrZWApO1xyXG5cclxuICAgICAgLy8gSWYgZmlsZSBleGlzdCBpbiBBenVyZSBEYXRhIExha2UgYnV0IGl0XCJzIGJlZW4gdXBkYXRlZCBpbiBhd3MgLSB1cGxvYWQgaXQgYWdhaW5cclxuICAgICAgcmV0dXJuIGZpbGUuZmlsZVN0YXR1cy5tb2RpZmljYXRpb25UaW1lIDwgYXdzRmlsZS5MYXN0TW9kaWZpZWQuZ2V0VGltZSgpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGV4KSB7XHJcbiAgICAgIGlmIChleC5ib2R5ICYmIGV4LmJvZHkgJiYgZXguYm9keS5yZW1vdGVFeGNlcHRpb24gJiYgZXguYm9keS5yZW1vdGVFeGNlcHRpb24uZXhjZXB0aW9uID09PSBcIkZpbGVOb3RGb3VuZEV4Y2VwdGlvblwiKSB7XHJcbiAgICAgICAgd2luc3Rvbi5pbmZvKGBmaWxlOiAke2ZpbGVGdWxsTmFtZX0gZG9lc24ndCBleGlzdHMgaW4gQURMYCk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhyb3cgZXg7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICBVcGxvYWQgbG9jYWwgZmlsZSB0byBBREwuXHJcbiAgICogIFZhbGlkYXRlcyB0aGF0IGFsbCBkaXJlY3RvcmllcyBpbiB0aGUgZmlsZSBwYXRoIGV4aXN0cyBpbiBBREwgZmlsZXMgc3lzdGVtIC0gaWYgbm90IGNyZWF0ZSB0aGUgbWlzc2luZyBkaXJlY3Rvcmllc1xyXG4gICAqIEBwYXJhbSBmaWxlUGF0aCAtIHRoZSBwYXRoIHdoZXJlIHRoZSBmaWxlIHRvIHVwbG9hZCBpcyBsb2NhdGVkXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHVwbG9hZEZpbGVUb0F6dXJlRGF0YUxha2UoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZGlyZWN0b3JpZXNMaXN0ID0gZmlsZXNIZWxwZXIuZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkoZmlsZVBhdGgpO1xyXG4gICAgY29uc3QgbG9jYWxGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLnRlbXBGb2xkZXIsIGZpbGVQYXRoKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDcmVhdGUgZm9sZGVycyBpbiBBREwgaWYgbmVlZGVkXHJcbiAgICAgIGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLm1rZGlycyh0aGlzLmFjY291bnROYW1lLCBkaXJlY3Rvcmllc0xpc3Quam9pbihcIi9cIikpO1xyXG5cclxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICBvdmVyd3JpdGU6IHRydWUsXHJcbiAgICAgICAgc3RyZWFtQ29udGVudHM6IGZzLmNyZWF0ZVJlYWRTdHJlYW0obG9jYWxGaWxlUGF0aCksXHJcbiAgICAgIH07XHJcblxyXG4gICAgICAvLyBVcGxvYWQgZmlsZSB0byBBenVyZSBEYXRhIExha2VcclxuICAgICAgYXdhaXQgdGhpcy5maWxlc3lzdGVtQ2xpZW50LmZpbGVTeXN0ZW0uY3JlYXRlKHRoaXMuYWNjb3VudE5hbWUsIGZpbGVQYXRoLCBvcHRpb25zKTtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBVcGxvYWQgZmlsZSAke2ZpbGVQYXRofSBzdWNjZXNzZnVsbHlgKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoYGVycm9yIHdoaWxlIHVwbG9hZGluZyBmaWxlIHRvIEFETDogJHtleH1gKTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiLi4ifQ==
