import * as async from "async";
import * as parallel from "async-await-parallel";
import * as rimraf from "rimraf";
import { winston } from "./logger";
import { AwsS3Module } from "./awsS3Module";
import { AzureDataLakeModule } from "./azureDataLakeModule";
import { createDirIfNotExists, getDirectoriesPathArray } from "./filesHelper";

export class S3ToAdlDataCopy {

  private concurrencyNumber = process.env.CONCURRENCY_NUMBER || 10;
  private tempFolder: string;
  private awsAccessKeyId: string;
  private awsAccessSecretKey: string;
  private awsRegion: string;
  private awsBucketName: string;
  private azureAdlAccountName: string;
  private azureClientId: string;
  private azureDomain: string;
  private azureSecret: string;

  constructor() {
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

  public async handler() {
    // create temp directory with cache directory inside to download files from s3 and upload it to ADL.
    // In the end of the run the cache directory will be deleted.
    createDirIfNotExists(null, null, this.tempFolder);
    this.tempFolder += "/cache";
    createDirIfNotExists(null, null, this.tempFolder);

    const awsModule = new AwsS3Module(this.awsAccessKeyId, this.awsAccessSecretKey, this.awsRegion, this.awsBucketName, this.tempFolder);
    const adlModule = new AzureDataLakeModule(this.azureAdlAccountName, this.azureClientId, this.azureDomain, this.azureSecret, this.tempFolder);

    await this.batchIterationOverS3Items(awsModule, adlModule);

    // After all uploads are completed, delete the cache directory and its sub directories.
    rimraf(this.tempFolder, (err) => {
      if (err) {
        winston.error("Error deleting temp directories" + err);
      }
      winston.info("all done");
    });
  }

  /**
   *  Go over the items in S3 in batches of 1000.
   *  For each file in batch check if it is missing from ADL lake, if so download it to temp directory and upload to ADL.
   */
  public async batchIterationOverS3Items(awsS3Module: AwsS3Module, adlModule: AzureDataLakeModule): Promise<void> {
    let awsObjectsOutput: AWS.S3.ListObjectsOutput;
    let marker = "";
    do {
      awsObjectsOutput = await awsS3Module.listAllObjects(marker);

      if (awsObjectsOutput && awsObjectsOutput.Contents && awsObjectsOutput.Contents.length > 0) {
        let awsObjects = awsObjectsOutput.Contents;
        // Filter out the directories names - aws.listObjects returns all files in the bucket including directories names
        awsObjects = awsObjects.filter((obj) => !obj.Key.endsWith("/"));

        const promiseArray = awsObjects.map(key => {
          return async () => {
            try {
              if (await adlModule.shouldUploadToADL(key)) {
                await awsS3Module.downloadFileFromS3(key);
                // Upload File if it doesn't exist in ADL or if a new version of the file exists in S3
                await adlModule.uploadFileToAzureDataLake(key.Key);
              }
            } catch (ex) {
              winston.log("error", "error was thrown while working on element %s %s", key.Key, ex);
              return null;
            }
          };
        });

        await parallel(promiseArray, this.concurrencyNumber);
        marker = awsObjects[awsObjects.length - 1].Key;
      }
    } while (awsObjectsOutput.IsTruncated);
  }

  private validateEnvironmentVariables() {
    const variablesList = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME",
      "AZURE_CLIENT_ID", "AZURE_DOMAIN", "AZURE_SECRET", "AZURE_ADL_ACCOUNT_NAME", "TEMP_FOLDER"];

    variablesList.forEach((variable) => {
      if (!process.env[variable]) {
        throw new Error("Environment Variable " + variable + " is not defined");
      }
    });
  }
}