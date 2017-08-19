import * as AWS from "aws-sdk";
import * as redis from "redis";
import { winston } from "./logger";


export class RedisModule {

    private redisClient;

    constructor(redisClient: redis.client) {
        this.redisClient = redisClient;
    }

    public async isFileInRedis(awsFile: AWS.S3.Object): Promise<RedisObject> {
        return await new Promise<RedisObject>((resolve, reject) => {
            this.redisClient.get(awsFile.Key, function (err, value) {
                if (value === null) {
                    winston.verbose(`file ${awsFile.Key} not found in redis`);
                    resolve(null);
                }
                if (value) {
                    winston.verbose(`file ${awsFile.Key} was found in redis`);
                    resolve(JSON.parse(value));
                }
                if (err) {
                    reject(err);
                }
            });
        });
    }

    public async addFileToRedis(awsFile: AWS.S3.Object) {
        return await new Promise((resolve, reject) => {
            const elementToUpload = {
                LastModified: awsFile.LastModified,
                ETag: awsFile.ETag,
                Size: awsFile.Size,
                Owner: awsFile.Owner,
                StorageClass: awsFile.StorageClass,

            };
            const stringifyElement = JSON.stringify(elementToUpload);

            this.redisClient.set(awsFile.Key, stringifyElement, (err) => {
                if (err) {
                    reject(err);
                }

                winston.verbose(`Added file ${awsFile.Key} successfully to redis`);
                resolve();
            });
        });
    }
}

export class RedisObject {
    LastModified: Date;
    ETag: string;
    Size: number;
    Owner: string;
    StorageClass: string;
}