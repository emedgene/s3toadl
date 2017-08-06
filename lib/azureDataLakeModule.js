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
const adlsManagement = require("azure-arm-datalake-store");
const fs = require("fs");
const msrestAzure = require("ms-rest-azure");
const filesHelper = require("./filesHelper");
const logger_1 = require("./logger");
class AzureDataLakeModule {
    constructor(accountName, clientId, domain, secret, tempFolder) {
        this.accountName = accountName;
        this.tempFolder = tempFolder;
        try {
            const credentials = new msrestAzure.ApplicationTokenCredentials(clientId, domain, secret);
            this.filesystemClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
        }
        catch (ex) {
            logger_1.winston.error("error initializing Azure client " + ex);
            throw ex;
        }
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
                logger_1.winston.log("info", "file: %s already exists in data lake", fileFullName);
                // If file exist in Azure Data Lake but it"s been updated in aws - upload it again
                return file.fileStatus.modificationTime < awsFile.LastModified.getTime();
            }
            catch (ex) {
                logger_1.winston.log("info", "file: %s doesn't exists in ADL", fileFullName);
                return true;
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
            const localFilePath = this.tempFolder + "/" + filePath;
            try {
                // Create folders in ADL if needed
                yield this.filesystemClient.fileSystem.mkdirs(this.accountName, directoriesList.join("/"));
                const options = {
                    overwrite: true,
                    streamContents: fs.createReadStream(localFilePath),
                };
                // Upload file to Azure Data Lake
                logger_1.winston.log("info", "Upload file %s started", filePath);
                yield this.filesystemClient.fileSystem.create(this.accountName, filePath, options);
                logger_1.winston.log("info", "Upload file %s successfully", filePath);
                // Delete local file
                fs.unlinkSync(localFilePath);
            }
            catch (ex) {
                logger_1.winston.log("error while uploading file to ADL: %s", ex);
                throw ex;
            }
        });
    }
}
exports.AzureDataLakeModule = AzureDataLakeModule;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9henVyZURhdGFMYWtlTW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBMkQ7QUFDM0QseUJBQXlCO0FBQ3pCLDZDQUE2QztBQUM3Qyw2Q0FBNkM7QUFDN0MscUNBQW1DO0FBRW5DO0lBS0UsWUFBWSxXQUFtQixFQUFFLFFBQWdCLEVBQUUsTUFBYyxFQUFFLE1BQWMsRUFBRSxVQUFrQjtRQUNuRyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUU3QixJQUFJLENBQUM7WUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLGdCQUFPLENBQUMsS0FBSyxDQUFDLGtDQUFrQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sRUFBRSxDQUFDO1FBQ1gsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDVSxpQkFBaUIsQ0FBQyxPQUFzQjs7WUFDbkQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNqQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNsRyxnQkFBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsc0NBQXNDLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBRTFFLGtGQUFrRjtnQkFDbEYsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUMzRSxDQUFDO1lBQ0QsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDVixnQkFBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZ0NBQWdDLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ3BFLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRUQ7Ozs7T0FJRztJQUNVLHlCQUF5QixDQUFDLFFBQWdCOztZQUNyRCxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO1lBRXZELElBQUksQ0FBQztnQkFDSCxrQ0FBa0M7Z0JBQ2xDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTNGLE1BQU0sT0FBTyxHQUFHO29CQUNkLFNBQVMsRUFBRSxJQUFJO29CQUNmLGNBQWMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO2lCQUNuRCxDQUFDO2dCQUVGLGlDQUFpQztnQkFDakMsZ0JBQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLHdCQUF3QixFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUN4RCxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUNuRixnQkFBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsNkJBQTZCLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBRTdELG9CQUFvQjtnQkFDcEIsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUMvQixDQUFDO1lBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDWixnQkFBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDekQsTUFBTSxFQUFFLENBQUM7WUFDWCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUFuRUQsa0RBbUVDIiwiZmlsZSI6ImF6dXJlRGF0YUxha2VNb2R1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBhZGxzTWFuYWdlbWVudCBmcm9tIFwiYXp1cmUtYXJtLWRhdGFsYWtlLXN0b3JlXCI7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgKiBhcyBtc3Jlc3RBenVyZSBmcm9tIFwibXMtcmVzdC1henVyZVwiO1xyXG5pbXBvcnQgKiBhcyBmaWxlc0hlbHBlciBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5pbXBvcnQgeyB3aW5zdG9uIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQXp1cmVEYXRhTGFrZU1vZHVsZSB7XHJcbiAgcHJpdmF0ZSBmaWxlc3lzdGVtQ2xpZW50OiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudDtcclxuICBwcml2YXRlIGFjY291bnROYW1lOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0ZW1wRm9sZGVyOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGFjY291bnROYW1lOiBzdHJpbmcsIGNsaWVudElkOiBzdHJpbmcsIGRvbWFpbjogc3RyaW5nLCBzZWNyZXQ6IHN0cmluZywgdGVtcEZvbGRlcjogc3RyaW5nKSB7XHJcbiAgICB0aGlzLmFjY291bnROYW1lID0gYWNjb3VudE5hbWU7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSB0ZW1wRm9sZGVyO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNyZWRlbnRpYWxzID0gbmV3IG1zcmVzdEF6dXJlLkFwcGxpY2F0aW9uVG9rZW5DcmVkZW50aWFscyhjbGllbnRJZCwgZG9tYWluLCBzZWNyZXQpO1xyXG4gICAgICB0aGlzLmZpbGVzeXN0ZW1DbGllbnQgPSBuZXcgYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQoY3JlZGVudGlhbHMpO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5lcnJvcihcImVycm9yIGluaXRpYWxpemluZyBBenVyZSBjbGllbnQgXCIgKyBleCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIGF3cyBmaWxlIGV4aXN0cyBpbiBBREwsIG9yIGlmIFMzIGhvbGRzIGEgbmV3ZXIgdmVyc2lvbiBvZiBmaWxlXHJcbiAgICogQHBhcmFtIGF3c0ZpbGUgLSB0aGUgZmlsZSB0byB2YWxpZGF0ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyBzaG91bGRVcGxvYWRUb0FETChhd3NGaWxlOiBBV1MuUzMuT2JqZWN0KTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICBjb25zdCBmaWxlRnVsbE5hbWUgPSBhd3NGaWxlLktleTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5nZXRGaWxlU3RhdHVzKHRoaXMuYWNjb3VudE5hbWUsIGZpbGVGdWxsTmFtZSk7XHJcbiAgICAgIHdpbnN0b24ubG9nKFwiaW5mb1wiLCBcImZpbGU6ICVzIGFscmVhZHkgZXhpc3RzIGluIGRhdGEgbGFrZVwiLCBmaWxlRnVsbE5hbWUpO1xyXG5cclxuICAgICAgLy8gSWYgZmlsZSBleGlzdCBpbiBBenVyZSBEYXRhIExha2UgYnV0IGl0XCJzIGJlZW4gdXBkYXRlZCBpbiBhd3MgLSB1cGxvYWQgaXQgYWdhaW5cclxuICAgICAgcmV0dXJuIGZpbGUuZmlsZVN0YXR1cy5tb2RpZmljYXRpb25UaW1lIDwgYXdzRmlsZS5MYXN0TW9kaWZpZWQuZ2V0VGltZSgpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24ubG9nKFwiaW5mb1wiLCBcImZpbGU6ICVzIGRvZXNuJ3QgZXhpc3RzIGluIEFETFwiLCBmaWxlRnVsbE5hbWUpO1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqICBVcGxvYWQgbG9jYWwgZmlsZSB0byBBREwuXHJcbiAgICogIFZhbGlkYXRlcyB0aGF0IGFsbCBkaXJlY3RvcmllcyBpbiB0aGUgZmlsZSBwYXRoIGV4aXN0cyBpbiBBREwgZmlsZXMgc3lzdGVtIC0gaWYgbm90IGNyZWF0ZSB0aGUgbWlzc2luZyBkaXJlY3Rvcmllc1xyXG4gICAqIEBwYXJhbSBmaWxlUGF0aCAtIHRoZSBwYXRoIHdoZXJlIHRoZSBmaWxlIHRvIHVwbG9hZCBpcyBsb2NhdGVkXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHVwbG9hZEZpbGVUb0F6dXJlRGF0YUxha2UoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgZGlyZWN0b3JpZXNMaXN0ID0gZmlsZXNIZWxwZXIuZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkoZmlsZVBhdGgpO1xyXG4gICAgY29uc3QgbG9jYWxGaWxlUGF0aCA9IHRoaXMudGVtcEZvbGRlciArIFwiL1wiICsgZmlsZVBhdGg7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIGZvbGRlcnMgaW4gQURMIGlmIG5lZWRlZFxyXG4gICAgICBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5ta2RpcnModGhpcy5hY2NvdW50TmFtZSwgZGlyZWN0b3JpZXNMaXN0LmpvaW4oXCIvXCIpKTtcclxuXHJcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XHJcbiAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxyXG4gICAgICAgIHN0cmVhbUNvbnRlbnRzOiBmcy5jcmVhdGVSZWFkU3RyZWFtKGxvY2FsRmlsZVBhdGgpLFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gVXBsb2FkIGZpbGUgdG8gQXp1cmUgRGF0YSBMYWtlXHJcbiAgICAgIHdpbnN0b24ubG9nKFwiaW5mb1wiLCBcIlVwbG9hZCBmaWxlICVzIHN0YXJ0ZWRcIiwgZmlsZVBhdGgpO1xyXG4gICAgICBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5jcmVhdGUodGhpcy5hY2NvdW50TmFtZSwgZmlsZVBhdGgsIG9wdGlvbnMpO1xyXG4gICAgICB3aW5zdG9uLmxvZyhcImluZm9cIiwgXCJVcGxvYWQgZmlsZSAlcyBzdWNjZXNzZnVsbHlcIiwgZmlsZVBhdGgpO1xyXG5cclxuICAgICAgLy8gRGVsZXRlIGxvY2FsIGZpbGVcclxuICAgICAgZnMudW5saW5rU3luYyhsb2NhbEZpbGVQYXRoKTtcclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgIHdpbnN0b24ubG9nKFwiZXJyb3Igd2hpbGUgdXBsb2FkaW5nIGZpbGUgdG8gQURMOiAlc1wiLCBleCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXSwic291cmNlUm9vdCI6IiJ9
