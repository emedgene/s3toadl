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
    constructor(accountName, tempFolder, fileSystemClient, bucketName) {
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
            const fileFullName = this.bucketName + "/" + awsFile.Key;
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
                    logger_1.winston.error(`shouldUploadToADL unknown error: ${ex}`);
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
            const filePathToUpload = this.bucketName + "/" + filePath;
            const directoriesList = filesHelper.getDirectoriesPathArray(filePathToUpload);
            const localFilePath = path.join(this.tempFolder, filePath);
            try {
                // Create folders in ADL if needed
                yield this.filesystemClient.fileSystem.mkdirs(this.accountName, directoriesList.join("/"));
                const options = {
                    overwrite: true,
                    streamContents: fs.createReadStream(localFilePath),
                };
                // Upload file to Azure Data Lake
                yield this.filesystemClient.fileSystem.create(this.accountName, filePathToUpload, options);
                logger_1.winston.info(`Upload file ${filePathToUpload} successfully`);
            }
            catch (ex) {
                logger_1.winston.error(`error while uploading file to ADL: ${ex}`);
                throw ex;
            }
        });
    }
}
exports.AzureDataLakeModule = AzureDataLakeModule;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9henVyZURhdGFMYWtlTW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLDZDQUE2QztBQUM3QyxxQ0FBbUM7QUFFbkM7SUFNRSxZQUFZLFdBQW1CLEVBQUUsVUFBa0IsRUFBRSxnQkFBOEQsRUFDakgsVUFBa0I7UUFDbEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7O09BR0c7SUFDVSxpQkFBaUIsQ0FBQyxPQUFzQjs7WUFDbkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUN6RCxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNsRyxnQkFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFlBQVksOEJBQThCLENBQUMsQ0FBQztnQkFFckUsa0ZBQWtGO2dCQUNsRixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzNFLENBQUM7WUFDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNWLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEtBQUssdUJBQXVCLENBQUMsQ0FBQyxDQUFDO29CQUNuSCxnQkFBTyxDQUFDLElBQUksQ0FBQyxTQUFTLFlBQVksd0JBQXdCLENBQUMsQ0FBQztvQkFDNUQsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDZCxDQUFDO2dCQUFDLElBQUksQ0FBQyxDQUFDO29CQUNOLGdCQUFPLENBQUMsS0FBSyxDQUFDLG9DQUFvQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN4RCxNQUFNLEVBQUUsQ0FBQztnQkFDWCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVEOzs7O09BSUc7SUFDVSx5QkFBeUIsQ0FBQyxRQUFnQjs7WUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsR0FBRyxRQUFRLENBQUM7WUFDMUQsTUFBTSxlQUFlLEdBQUcsV0FBVyxDQUFDLHVCQUF1QixDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDOUUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBRTNELElBQUksQ0FBQztnQkFDSCxrQ0FBa0M7Z0JBQ2xDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTNGLE1BQU0sT0FBTyxHQUFHO29CQUNkLFNBQVMsRUFBRSxJQUFJO29CQUNmLGNBQWMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO2lCQUNuRCxDQUFDO2dCQUVGLGlDQUFpQztnQkFFakMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUMzRixnQkFBTyxDQUFDLElBQUksQ0FBQyxlQUFlLGdCQUFnQixlQUFlLENBQUMsQ0FBQztZQUMvRCxDQUFDO1lBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDWixnQkFBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxFQUFFLENBQUM7WUFDWCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUFqRUQsa0RBaUVDIiwiZmlsZSI6InNyYy9henVyZURhdGFMYWtlTW9kdWxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgZmlsZXNIZWxwZXIgZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF6dXJlRGF0YUxha2VNb2R1bGUge1xyXG4gIHByaXZhdGUgZmlsZXN5c3RlbUNsaWVudDogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQ7XHJcbiAgcHJpdmF0ZSBhY2NvdW50TmFtZTogc3RyaW5nO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG4gIHByaXZhdGUgYnVja2V0TmFtZTogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihhY2NvdW50TmFtZTogc3RyaW5nLCB0ZW1wRm9sZGVyOiBzdHJpbmcsIGZpbGVTeXN0ZW1DbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50LFxyXG4gICAgYnVja2V0TmFtZTogc3RyaW5nKSB7XHJcbiAgICB0aGlzLmFjY291bnROYW1lID0gYWNjb3VudE5hbWU7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSB0ZW1wRm9sZGVyO1xyXG4gICAgdGhpcy5maWxlc3lzdGVtQ2xpZW50ID0gZmlsZVN5c3RlbUNsaWVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyBpZiBhd3MgZmlsZSBleGlzdHMgaW4gQURMLCBvciBpZiBTMyBob2xkcyBhIG5ld2VyIHZlcnNpb24gb2YgZmlsZVxyXG4gICAqIEBwYXJhbSBhd3NGaWxlIC0gdGhlIGZpbGUgdG8gdmFsaWRhdGVcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgc2hvdWxkVXBsb2FkVG9BREwoYXdzRmlsZTogQVdTLlMzLk9iamVjdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgY29uc3QgZmlsZUZ1bGxOYW1lID0gdGhpcy5idWNrZXROYW1lICsgXCIvXCIgKyBhd3NGaWxlLktleTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5nZXRGaWxlU3RhdHVzKHRoaXMuYWNjb3VudE5hbWUsIGZpbGVGdWxsTmFtZSk7XHJcbiAgICAgIHdpbnN0b24udmVyYm9zZShgZmlsZTogJHtmaWxlRnVsbE5hbWV9IGFscmVhZHkgZXhpc3RzIGluIGRhdGEgbGFrZWApO1xyXG5cclxuICAgICAgLy8gSWYgZmlsZSBleGlzdCBpbiBBenVyZSBEYXRhIExha2UgYnV0IGl0XCJzIGJlZW4gdXBkYXRlZCBpbiBhd3MgLSB1cGxvYWQgaXQgYWdhaW5cclxuICAgICAgcmV0dXJuIGZpbGUuZmlsZVN0YXR1cy5tb2RpZmljYXRpb25UaW1lIDwgYXdzRmlsZS5MYXN0TW9kaWZpZWQuZ2V0VGltZSgpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGV4KSB7XHJcbiAgICAgIGlmIChleC5ib2R5ICYmIGV4LmJvZHkgJiYgZXguYm9keS5yZW1vdGVFeGNlcHRpb24gJiYgZXguYm9keS5yZW1vdGVFeGNlcHRpb24uZXhjZXB0aW9uID09PSBcIkZpbGVOb3RGb3VuZEV4Y2VwdGlvblwiKSB7XHJcbiAgICAgICAgd2luc3Rvbi5pbmZvKGBmaWxlOiAke2ZpbGVGdWxsTmFtZX0gZG9lc24ndCBleGlzdHMgaW4gQURMYCk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgd2luc3Rvbi5lcnJvcihgc2hvdWxkVXBsb2FkVG9BREwgdW5rbm93biBlcnJvcjogJHtleH1gKTtcclxuICAgICAgICB0aHJvdyBleDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogIFVwbG9hZCBsb2NhbCBmaWxlIHRvIEFETC5cclxuICAgKiAgVmFsaWRhdGVzIHRoYXQgYWxsIGRpcmVjdG9yaWVzIGluIHRoZSBmaWxlIHBhdGggZXhpc3RzIGluIEFETCBmaWxlcyBzeXN0ZW0gLSBpZiBub3QgY3JlYXRlIHRoZSBtaXNzaW5nIGRpcmVjdG9yaWVzXHJcbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gdGhlIHBhdGggd2hlcmUgdGhlIGZpbGUgdG8gdXBsb2FkIGlzIGxvY2F0ZWRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgdXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBmaWxlUGF0aFRvVXBsb2FkID0gdGhpcy5idWNrZXROYW1lICsgXCIvXCIgKyBmaWxlUGF0aDtcclxuICAgIGNvbnN0IGRpcmVjdG9yaWVzTGlzdCA9IGZpbGVzSGVscGVyLmdldERpcmVjdG9yaWVzUGF0aEFycmF5KGZpbGVQYXRoVG9VcGxvYWQpO1xyXG4gICAgY29uc3QgbG9jYWxGaWxlUGF0aCA9IHBhdGguam9pbih0aGlzLnRlbXBGb2xkZXIsIGZpbGVQYXRoKTtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDcmVhdGUgZm9sZGVycyBpbiBBREwgaWYgbmVlZGVkXHJcbiAgICAgIGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLm1rZGlycyh0aGlzLmFjY291bnROYW1lLCBkaXJlY3Rvcmllc0xpc3Quam9pbihcIi9cIikpO1xyXG5cclxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICBvdmVyd3JpdGU6IHRydWUsXHJcbiAgICAgICAgc3RyZWFtQ29udGVudHM6IGZzLmNyZWF0ZVJlYWRTdHJlYW0obG9jYWxGaWxlUGF0aCksXHJcbiAgICAgIH07XHJcblxyXG4gICAgICAvLyBVcGxvYWQgZmlsZSB0byBBenVyZSBEYXRhIExha2VcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLmNyZWF0ZSh0aGlzLmFjY291bnROYW1lLCBmaWxlUGF0aFRvVXBsb2FkLCBvcHRpb25zKTtcclxuICAgICAgd2luc3Rvbi5pbmZvKGBVcGxvYWQgZmlsZSAke2ZpbGVQYXRoVG9VcGxvYWR9IHN1Y2Nlc3NmdWxseWApO1xyXG4gICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5lcnJvcihgZXJyb3Igd2hpbGUgdXBsb2FkaW5nIGZpbGUgdG8gQURMOiAke2V4fWApO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIuLiJ9
