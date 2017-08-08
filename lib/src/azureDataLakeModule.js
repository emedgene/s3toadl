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
const logger_1 = require("./logger");
const filesHelper = require("./filesHelper");
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
                logger_1.winston.verbose(`file: ${fileFullName} doesn't exists in ADL`);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9henVyZURhdGFMYWtlTW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFFQSx5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLHFDQUFtQztBQUNuQyw2Q0FBNkM7QUFFN0M7SUFLRSxZQUFZLFdBQW1CLEVBQUUsVUFBa0IsRUFBRSxnQkFBOEQ7UUFDakgsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFDL0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0lBQzNDLENBQUM7SUFFRDs7O09BR0c7SUFDVSxpQkFBaUIsQ0FBQyxPQUFzQjs7WUFDbkQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztZQUNqQyxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNsRyxnQkFBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLFlBQVksOEJBQThCLENBQUMsQ0FBQztnQkFFckUsa0ZBQWtGO2dCQUNsRixNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzNFLENBQUM7WUFDRCxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUNWLGdCQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsWUFBWSx3QkFBd0IsQ0FBQyxDQUFDO2dCQUMvRCxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ2QsQ0FBQztRQUNILENBQUM7S0FBQTtJQUVEOzs7O09BSUc7SUFDVSx5QkFBeUIsQ0FBQyxRQUFnQjs7WUFDckQsTUFBTSxlQUFlLEdBQUcsV0FBVyxDQUFDLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUUzRCxJQUFJLENBQUM7Z0JBQ0gsa0NBQWtDO2dCQUNsQyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUUzRixNQUFNLE9BQU8sR0FBRztvQkFDZCxTQUFTLEVBQUUsSUFBSTtvQkFDZixjQUFjLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQztpQkFDbkQsQ0FBQztnQkFFRixpQ0FBaUM7Z0JBQ2pDLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBQ25GLGdCQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsUUFBUSxlQUFlLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDWixnQkFBTyxDQUFDLEtBQUssQ0FBQyxzQ0FBc0MsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxFQUFFLENBQUM7WUFDWCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0NBQ0Y7QUF4REQsa0RBd0RDIiwiZmlsZSI6InNyYy9henVyZURhdGFMYWtlTW9kdWxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGFkbHNNYW5hZ2VtZW50IGZyb20gXCJhenVyZS1hcm0tZGF0YWxha2Utc3RvcmVcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgKiBhcyBmaWxlc0hlbHBlciBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF6dXJlRGF0YUxha2VNb2R1bGUge1xyXG4gIHByaXZhdGUgZmlsZXN5c3RlbUNsaWVudDogYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQ7XHJcbiAgcHJpdmF0ZSBhY2NvdW50TmFtZTogc3RyaW5nO1xyXG4gIHByaXZhdGUgdGVtcEZvbGRlcjogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihhY2NvdW50TmFtZTogc3RyaW5nLCB0ZW1wRm9sZGVyOiBzdHJpbmcsIGZpbGVTeXN0ZW1DbGllbnQ6IGFkbHNNYW5hZ2VtZW50LkRhdGFMYWtlU3RvcmVGaWxlU3lzdGVtQ2xpZW50KSB7XHJcbiAgICB0aGlzLmFjY291bnROYW1lID0gYWNjb3VudE5hbWU7XHJcbiAgICB0aGlzLnRlbXBGb2xkZXIgPSB0ZW1wRm9sZGVyO1xyXG4gICAgdGhpcy5maWxlc3lzdGVtQ2xpZW50ID0gZmlsZVN5c3RlbUNsaWVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrcyBpZiBhd3MgZmlsZSBleGlzdHMgaW4gQURMLCBvciBpZiBTMyBob2xkcyBhIG5ld2VyIHZlcnNpb24gb2YgZmlsZVxyXG4gICAqIEBwYXJhbSBhd3NGaWxlIC0gdGhlIGZpbGUgdG8gdmFsaWRhdGVcclxuICAgKi9cclxuICBwdWJsaWMgYXN5bmMgc2hvdWxkVXBsb2FkVG9BREwoYXdzRmlsZTogQVdTLlMzLk9iamVjdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgY29uc3QgZmlsZUZ1bGxOYW1lID0gYXdzRmlsZS5LZXk7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5maWxlc3lzdGVtQ2xpZW50LmZpbGVTeXN0ZW0uZ2V0RmlsZVN0YXR1cyh0aGlzLmFjY291bnROYW1lLCBmaWxlRnVsbE5hbWUpO1xyXG4gICAgICB3aW5zdG9uLnZlcmJvc2UoYGZpbGU6ICR7ZmlsZUZ1bGxOYW1lfSBhbHJlYWR5IGV4aXN0cyBpbiBkYXRhIGxha2VgKTtcclxuXHJcbiAgICAgIC8vIElmIGZpbGUgZXhpc3QgaW4gQXp1cmUgRGF0YSBMYWtlIGJ1dCBpdFwicyBiZWVuIHVwZGF0ZWQgaW4gYXdzIC0gdXBsb2FkIGl0IGFnYWluXHJcbiAgICAgIHJldHVybiBmaWxlLmZpbGVTdGF0dXMubW9kaWZpY2F0aW9uVGltZSA8IGF3c0ZpbGUuTGFzdE1vZGlmaWVkLmdldFRpbWUoKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLnZlcmJvc2UoYGZpbGU6ICR7ZmlsZUZ1bGxOYW1lfSBkb2Vzbid0IGV4aXN0cyBpbiBBRExgKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiAgVXBsb2FkIGxvY2FsIGZpbGUgdG8gQURMLlxyXG4gICAqICBWYWxpZGF0ZXMgdGhhdCBhbGwgZGlyZWN0b3JpZXMgaW4gdGhlIGZpbGUgcGF0aCBleGlzdHMgaW4gQURMIGZpbGVzIHN5c3RlbSAtIGlmIG5vdCBjcmVhdGUgdGhlIG1pc3NpbmcgZGlyZWN0b3JpZXNcclxuICAgKiBAcGFyYW0gZmlsZVBhdGggLSB0aGUgcGF0aCB3aGVyZSB0aGUgZmlsZSB0byB1cGxvYWQgaXMgbG9jYXRlZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBhc3luYyB1cGxvYWRGaWxlVG9BenVyZURhdGFMYWtlKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGRpcmVjdG9yaWVzTGlzdCA9IGZpbGVzSGVscGVyLmdldERpcmVjdG9yaWVzUGF0aEFycmF5KGZpbGVQYXRoKTtcclxuICAgIGNvbnN0IGxvY2FsRmlsZVBhdGggPSBwYXRoLmpvaW4odGhpcy50ZW1wRm9sZGVyLCBmaWxlUGF0aCk7XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIGZvbGRlcnMgaW4gQURMIGlmIG5lZWRlZFxyXG4gICAgICBhd2FpdCB0aGlzLmZpbGVzeXN0ZW1DbGllbnQuZmlsZVN5c3RlbS5ta2RpcnModGhpcy5hY2NvdW50TmFtZSwgZGlyZWN0b3JpZXNMaXN0LmpvaW4oXCIvXCIpKTtcclxuXHJcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XHJcbiAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxyXG4gICAgICAgIHN0cmVhbUNvbnRlbnRzOiBmcy5jcmVhdGVSZWFkU3RyZWFtKGxvY2FsRmlsZVBhdGgpLFxyXG4gICAgICB9O1xyXG5cclxuICAgICAgLy8gVXBsb2FkIGZpbGUgdG8gQXp1cmUgRGF0YSBMYWtlXHJcbiAgICAgIGF3YWl0IHRoaXMuZmlsZXN5c3RlbUNsaWVudC5maWxlU3lzdGVtLmNyZWF0ZSh0aGlzLmFjY291bnROYW1lLCBmaWxlUGF0aCwgb3B0aW9ucyk7XHJcbiAgICAgIHdpbnN0b24uaW5mbyhgVXBsb2FkIGZpbGUgJHtmaWxlUGF0aH0gc3VjY2Vzc2Z1bGx5YCk7XHJcbiAgICB9IGNhdGNoIChleCkge1xyXG4gICAgICB3aW5zdG9uLmVycm9yKGBlcnJvciB3aGlsZSB1cGxvYWRpbmcgZmlsZSB0byBBREw6ICR7ZXh9YCk7XHJcbiAgICAgIHRocm93IGV4O1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXSwic291cmNlUm9vdCI6Ii4uIn0=
