import * as adlsManagement from "azure-arm-datalake-store";
import * as fs from "fs";
import * as msrestAzure from "ms-rest-azure";
import * as filesHelper from "./filesHelper";
import { winston } from "./logger";

export class AzureDataLakeModule {
  private filesystemClient: adlsManagement.DataLakeStoreFileSystemClient;
  private accountName: string;
  private tempFolder: string;

  constructor(accountName: string, clientId: string, domain: string, secret: string, tempFolder: string) {
    this.accountName = accountName;
    this.tempFolder = tempFolder;

    try {
      const credentials = new msrestAzure.ApplicationTokenCredentials(clientId, domain, secret);
      this.filesystemClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
    } catch (ex) {
      winston.error("error initializing Azure client " + ex);
      throw ex;
    }
  }

  /**
   * Checks if aws file exists in ADL, or if S3 holds a newer version of file
   * @param awsFile - the file to validate
   */
  public async shouldUploadToADL(awsFile: AWS.S3.Object): Promise<boolean> {
    const fileFullName = awsFile.Key;
    try {
      const file = await this.filesystemClient.fileSystem.getFileStatus(this.accountName, fileFullName);
      winston.log("info", "file: %s already exists in data lake", fileFullName);

      // If file exist in Azure Data Lake but it"s been updated in aws - upload it again
      return file.fileStatus.modificationTime < awsFile.LastModified.getTime();
    }
    catch (ex) {
      winston.log("info", "file: %s doesn't exists in ADL", fileFullName);
      return true;
    }
  }

  /**
   *  Upload local file to ADL.
   *  Validates that all directories in the file path exists in ADL files system - if not create the missing directories
   * @param filePath - the path where the file to upload is located
   */
  public async uploadFileToAzureDataLake(filePath: string): Promise<void> {
    const directoriesList = filesHelper.getDirectoriesPathArray(filePath);
    const localFilePath = this.tempFolder + "/" + filePath;

    try {
      // Create folders in ADL if needed
      await this.filesystemClient.fileSystem.mkdirs(this.accountName, directoriesList.join("/"));

      const options = {
        overwrite: true,
        streamContents: fs.createReadStream(localFilePath),
      };

      // Upload file to Azure Data Lake
      winston.log("info", "Upload file %s started", filePath);
      await this.filesystemClient.fileSystem.create(this.accountName, filePath, options);
      winston.log("info", "Upload file %s successfully", filePath);

      // Delete local file
      fs.unlinkSync(localFilePath);
    } catch (ex) {
      winston.log("error while uploading file to ADL: %s", ex);
      throw ex;
    }
  }
}
