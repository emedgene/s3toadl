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
const winston = require("winston");
const filesHelper = require("./filesHelper");
class AzureDataLakeModule {
    constructor(accountName, clientId, domain, secret, tempFolder) {
        this.accountName = accountName;
        this.tempFolder = tempFolder;
        try {
            const credentials = new msrestAzure.ApplicationTokenCredentials(clientId, domain, secret);
            this.filesystemClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
        }
        catch (ex) {
            winston.error("error initializing Azure client " + ex);
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
                winston.log("info", "file: %s already exists in data lake", fileFullName);
                // If file exist in Azure Data Lake but it"s been updated in aws - upload it again
                return file.fileStatus.modificationTime < awsFile.LastModified.getTime();
            }
            catch (ex) {
                winston.log("info", "file: %s doesn't exists in ADL", fileFullName);
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
                yield this.filesystemClient.fileSystem.create(this.accountName, filePath, options);
                winston.log("info", "Upload file %s successfully", filePath);
                // Delete local file
                fs.unlinkSync(localFilePath);
            }
            catch (ex) {
                winston.log("error while uploading file to ADL: %s", ex);
                throw ex;
            }
        });
    }
}
exports.AzureDataLakeModule = AzureDataLakeModule;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9henVyZURhdGFMYWtlTW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSwyREFBMkQ7QUFDM0QseUJBQXlCO0FBQ3pCLDZDQUE2QztBQUM3QyxtQ0FBbUM7QUFDbkMsNkNBQTZDO0FBRTdDO0lBS0UsWUFBWSxXQUFtQixFQUFFLFFBQWdCLEVBQUUsTUFBYyxFQUFFLE1BQWMsRUFBRSxVQUFrQjtRQUNuRyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUU3QixJQUFJLENBQUM7WUFDSCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzFGLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4RixDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNaLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0NBQWtDLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDdkQsTUFBTSxFQUFFLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNVLGlCQUFpQixDQUFDLE9BQXNCOztZQUNuRCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2pDLElBQUksQ0FBQztnQkFDSCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ2xHLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLHNDQUFzQyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUUxRSxrRkFBa0Y7Z0JBQ2xGLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDM0UsQ0FBQztZQUNELEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsZ0NBQWdDLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ3BFLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0lBRUQ7Ozs7T0FJRztJQUNVLHlCQUF5QixDQUFDLFFBQWdCOztZQUNyRCxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsdUJBQXVCLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEUsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDO1lBRXZELElBQUksQ0FBQztnQkFDSCxrQ0FBa0M7Z0JBQ2xDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTNGLE1BQU0sT0FBTyxHQUFHO29CQUNkLFNBQVMsRUFBRSxJQUFJO29CQUNmLGNBQWMsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsYUFBYSxDQUFDO2lCQUNuRCxDQUFDO2dCQUVGLGlDQUFpQztnQkFDakMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDbkYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsNkJBQTZCLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBRTdELG9CQUFvQjtnQkFDcEIsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUMvQixDQUFDO1lBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDWixPQUFPLENBQUMsR0FBRyxDQUFDLHVDQUF1QyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUN6RCxNQUFNLEVBQUUsQ0FBQztZQUNYLENBQUM7UUFDSCxDQUFDO0tBQUE7Q0FDRjtBQWxFRCxrREFrRUMiLCJmaWxlIjoiYXp1cmVEYXRhTGFrZU1vZHVsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCAqIGFzIG1zcmVzdEF6dXJlIGZyb20gXCJtcy1yZXN0LWF6dXJlXCI7XHJcbmltcG9ydCAqIGFzIHdpbnN0b24gZnJvbSBcIndpbnN0b25cIjtcclxuaW1wb3J0ICogYXMgZmlsZXNIZWxwZXIgZnJvbSBcIi4vZmlsZXNIZWxwZXJcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBBenVyZURhdGFMYWtlTW9kdWxlIHtcclxuICBwcml2YXRlIGZpbGVzeXN0ZW1DbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50O1xyXG4gIHByaXZhdGUgYWNjb3VudE5hbWU6IHN0cmluZztcclxuICBwcml2YXRlIHRlbXBGb2xkZXI6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoYWNjb3VudE5hbWU6IHN0cmluZywgY2xpZW50SWQ6IHN0cmluZywgZG9tYWluOiBzdHJpbmcsIHNlY3JldDogc3RyaW5nLCB0ZW1wRm9sZGVyOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuYWNjb3VudE5hbWUgPSBhY2NvdW50TmFtZTtcclxuICAgIHRoaXMudGVtcEZvbGRlciA9IHRlbXBGb2xkZXI7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY3JlZGVudGlhbHMgPSBuZXcgbXNyZXN0QXp1cmUuQXBwbGljYXRpb25Ub2tlbkNyZWRlbnRpYWxzKGNsaWVudElkLCBkb21haW4sIHNlY3JldCk7XHJcbiAgICAgIHRoaXMuZmlsZXN5c3RlbUNsaWVudCA9IG5ldyBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudChjcmVkZW50aWFscyk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmVycm9yKFwiZXJyb3IgaW5pdGlhbGl6aW5nIEF6dXJlIGNsaWVudCBcIiArIGV4KTtcclxuICAgICAgdGhyb3cgZXg7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgaWYgYXdzIGZpbGUgZXhpc3RzIGluIEFETCwgb3IgaWYgUzMgaG9sZHMgYSBuZXdlciB2ZXJzaW9uIG9mIGZpbGVcclxuICAgKiBAcGFyYW0gYXdzRmlsZSAtIHRoZSBmaWxlIHRvIHZhbGlkYXRlXHJcbiAgICovXHJcbiAgcHVibGljIGFzeW5jIHNob3VsZFVwbG9hZFRvQURMKGF3c0ZpbGU6IEFXUy5TMy5PYmplY3QpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgIGNvbnN0IGZpbGVGdWxsTmFtZSA9IGF3c0ZpbGUuS2V5O1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLmdldEZpbGVTdGF0dXModGhpcy5hY2NvdW50TmFtZSwgZmlsZUZ1bGxOYW1lKTtcclxuICAgICAgd2luc3Rvbi5sb2coXCJpbmZvXCIsIFwiZmlsZTogJXMgYWxyZWFkeSBleGlzdHMgaW4gZGF0YSBsYWtlXCIsIGZpbGVGdWxsTmFtZSk7XHJcblxyXG4gICAgICAvLyBJZiBmaWxlIGV4aXN0IGluIEF6dXJlIERhdGEgTGFrZSBidXQgaXRcInMgYmVlbiB1cGRhdGVkIGluIGF3cyAtIHVwbG9hZCBpdCBhZ2FpblxyXG4gICAgICByZXR1cm4gZmlsZS5maWxlU3RhdHVzLm1vZGlmaWNhdGlvblRpbWUgPCBhd3NGaWxlLkxhc3RNb2RpZmllZC5nZXRUaW1lKCk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXgpIHtcclxuICAgICAgd2luc3Rvbi5sb2coXCJpbmZvXCIsIFwiZmlsZTogJXMgZG9lc24ndCBleGlzdHMgaW4gQURMXCIsIGZpbGVGdWxsTmFtZSk7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogIFVwbG9hZCBsb2NhbCBmaWxlIHRvIEFETC5cclxuICAgKiAgVmFsaWRhdGVzIHRoYXQgYWxsIGRpcmVjdG9yaWVzIGluIHRoZSBmaWxlIHBhdGggZXhpc3RzIGluIEFETCBmaWxlcyBzeXN0ZW0gLSBpZiBub3QgY3JlYXRlIHRoZSBtaXNzaW5nIGRpcmVjdG9yaWVzXHJcbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gdGhlIHBhdGggd2hlcmUgdGhlIGZpbGUgdG8gdXBsb2FkIGlzIGxvY2F0ZWRcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgdXBsb2FkRmlsZVRvQXp1cmVEYXRhTGFrZShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBkaXJlY3Rvcmllc0xpc3QgPSBmaWxlc0hlbHBlci5nZXREaXJlY3Rvcmllc1BhdGhBcnJheShmaWxlUGF0aCk7XHJcbiAgICBjb25zdCBsb2NhbEZpbGVQYXRoID0gdGhpcy50ZW1wRm9sZGVyICsgXCIvXCIgKyBmaWxlUGF0aDtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDcmVhdGUgZm9sZGVycyBpbiBBREwgaWYgbmVlZGVkXHJcbiAgICAgIGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLm1rZGlycyh0aGlzLmFjY291bnROYW1lLCBkaXJlY3Rvcmllc0xpc3Quam9pbihcIi9cIikpO1xyXG5cclxuICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcclxuICAgICAgICBvdmVyd3JpdGU6IHRydWUsXHJcbiAgICAgICAgc3RyZWFtQ29udGVudHM6IGZzLmNyZWF0ZVJlYWRTdHJlYW0obG9jYWxGaWxlUGF0aCksXHJcbiAgICAgIH07XHJcblxyXG4gICAgICAvLyBVcGxvYWQgZmlsZSB0byBBenVyZSBEYXRhIExha2VcclxuICAgICAgYXdhaXQgdGhpcy5maWxlc3lzdGVtQ2xpZW50LmZpbGVTeXN0ZW0uY3JlYXRlKHRoaXMuYWNjb3VudE5hbWUsIGZpbGVQYXRoLCBvcHRpb25zKTtcclxuICAgICAgd2luc3Rvbi5sb2coXCJpbmZvXCIsIFwiVXBsb2FkIGZpbGUgJXMgc3VjY2Vzc2Z1bGx5XCIsIGZpbGVQYXRoKTtcclxuXHJcbiAgICAgIC8vIERlbGV0ZSBsb2NhbCBmaWxlXHJcbiAgICAgIGZzLnVubGlua1N5bmMobG9jYWxGaWxlUGF0aCk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmxvZyhcImVycm9yIHdoaWxlIHVwbG9hZGluZyBmaWxlIHRvIEFETDogJXNcIiwgZXgpO1xyXG4gICAgICB0aHJvdyBleDtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIifQ==
