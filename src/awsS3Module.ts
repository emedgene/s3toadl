import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as winston from "winston";
import { createDirIfNotExists, getDirectoriesPathArray } from "./filesHelper";

export class AwsS3Module {
    private s3Client: AWS.S3;
    private bucketName: string;
    private tempFolder: string;

    constructor(accessKeyId: string, secretAccessKey: string, region: string, bucketName: string, tempFolder: string) {
        this.bucketName = bucketName;
        this.tempFolder = tempFolder;
        try {
            const config = { accessKeyId, secretAccessKey, region };
            this.s3Client = new AWS.S3(config);
        } catch (ex) {
            winston.log("error initializing s3 client: " + ex);
            throw ex;
        }
    }

    /**
     * Get a list of all files in S3 bucket - including sub directories gets 1000 at a time.
     * @param marker - Indicates the start point of the list object.
     */
    public async listAllObjects(marker?: string): Promise<AWS.S3.ListObjectsOutput> {
        return await new Promise<AWS.S3.ListObjectsOutput>((resolve, reject) => {
            this.s3Client.listObjects({ Bucket: this.bucketName, Marker: marker }, (error, data) => {
                if (error) {
                    return reject(error);
                }

                return resolve(data);
            });
        });
    }

    /**
     * Download file from S3 to local directory
     * @param awsFile - the file to download from s3
     */
    public async downloadFileFromS3(awsFile: AWS.S3.Object): Promise<void> {
        if (!awsFile || !awsFile.Key) {
            winston.error("aws file is undefined");
            return;
        }

        const params = { Bucket: this.bucketName, Key: awsFile.Key };
        const directoriesList = getDirectoriesPathArray(awsFile.Key);

        let path = this.tempFolder;
        directoriesList.forEach(dir => {
            createDirIfNotExists(path, dir);
            path += "/" + dir;
        });

        const file = fs.createWriteStream(this.tempFolder + "/" + awsFile.Key);

        await new Promise((resolve, reject) => {
            this.s3Client.getObject(params).createReadStream()
                .on("end", () => resolve())
                .on("error", error => reject(error))
                .pipe(file);
        });
    }
}
