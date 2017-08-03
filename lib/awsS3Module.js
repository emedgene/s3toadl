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
const AWS = require("aws-sdk");
const fs = require("fs");
const winston = require("winston");
const filesHelper_1 = require("./filesHelper");
class AwsS3Module {
    constructor(accessKeyId, secretAccessKey, region, bucketName, tempFolder) {
        this.bucketName = bucketName;
        this.tempFolder = tempFolder;
        try {
            const config = { accessKeyId, secretAccessKey, region };
            this.s3Client = new AWS.S3(config);
        }
        catch (ex) {
            winston.log("error initializing s3 client: " + ex);
            throw ex;
        }
    }
    /**
     * Get a list of all files in S3 bucket - including sub directories gets 1000 at a time.
     * @param marker - Indicates the start point of the list object.
     */
    listAllObjects(marker) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Promise((resolve, reject) => {
                this.s3Client.listObjects({ Bucket: this.bucketName, Marker: marker }, (error, data) => {
                    if (error) {
                        return reject(error);
                    }
                    return resolve(data);
                });
            });
        });
    }
    /**
     * Download file from S3 to local directory
     * @param awsFile - the file to download from s3
     */
    downloadFileFromS3(awsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!awsFile || !awsFile.Key) {
                winston.error("aws file is undefined");
                return;
            }
            const params = { Bucket: this.bucketName, Key: awsFile.Key };
            const directoriesList = filesHelper_1.getDirectoriesPathArray(awsFile.Key);
            let path = this.tempFolder;
            directoriesList.forEach(dir => {
                filesHelper_1.createDirIfNotExists(path, dir);
                path += "/" + dir;
            });
            const file = fs.createWriteStream(this.tempFolder + "/" + awsFile.Key);
            yield new Promise((resolve, reject) => {
                this.s3Client.getObject(params).createReadStream()
                    .on("end", () => resolve())
                    .on("error", error => reject(error))
                    .pipe(file);
            });
        });
    }
}
exports.AwsS3Module = AwsS3Module;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDO1lBQ3BCLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUFBO0NBQ0o7QUE3REQsa0NBNkRDIiwiZmlsZSI6ImF3c1MzTW9kdWxlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgQVdTIGZyb20gXCJhd3Mtc2RrXCI7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmc1wiO1xyXG5pbXBvcnQgKiBhcyB3aW5zdG9uIGZyb20gXCJ3aW5zdG9uXCI7XHJcbmltcG9ydCB7IGNyZWF0ZURpcklmTm90RXhpc3RzLCBnZXREaXJlY3Rvcmllc1BhdGhBcnJheSB9IGZyb20gXCIuL2ZpbGVzSGVscGVyXCI7XHJcblxyXG5leHBvcnQgY2xhc3MgQXdzUzNNb2R1bGUge1xyXG4gICAgcHJpdmF0ZSBzM0NsaWVudDogQVdTLlMzO1xyXG4gICAgcHJpdmF0ZSBidWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIHRlbXBGb2xkZXI6IHN0cmluZztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihhY2Nlc3NLZXlJZDogc3RyaW5nLCBzZWNyZXRBY2Nlc3NLZXk6IHN0cmluZywgcmVnaW9uOiBzdHJpbmcsIGJ1Y2tldE5hbWU6IHN0cmluZywgdGVtcEZvbGRlcjogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5idWNrZXROYW1lID0gYnVja2V0TmFtZTtcclxuICAgICAgICB0aGlzLnRlbXBGb2xkZXIgPSB0ZW1wRm9sZGVyO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IHsgYWNjZXNzS2V5SWQsIHNlY3JldEFjY2Vzc0tleSwgcmVnaW9uIH07XHJcbiAgICAgICAgICAgIHRoaXMuczNDbGllbnQgPSBuZXcgQVdTLlMzKGNvbmZpZyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcclxuICAgICAgICAgICAgd2luc3Rvbi5sb2coXCJlcnJvciBpbml0aWFsaXppbmcgczMgY2xpZW50OiBcIiArIGV4KTtcclxuICAgICAgICAgICAgdGhyb3cgZXg7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IGEgbGlzdCBvZiBhbGwgZmlsZXMgaW4gUzMgYnVja2V0IC0gaW5jbHVkaW5nIHN1YiBkaXJlY3RvcmllcyBnZXRzIDEwMDAgYXQgYSB0aW1lLlxyXG4gICAgICogQHBhcmFtIG1hcmtlciAtIEluZGljYXRlcyB0aGUgc3RhcnQgcG9pbnQgb2YgdGhlIGxpc3Qgb2JqZWN0LlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgbGlzdEFsbE9iamVjdHMobWFya2VyPzogc3RyaW5nKTogUHJvbWlzZTxBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ+IHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8QVdTLlMzLkxpc3RPYmplY3RzT3V0cHV0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuczNDbGllbnQubGlzdE9iamVjdHMoeyBCdWNrZXQ6IHRoaXMuYnVja2V0TmFtZSwgTWFya2VyOiBtYXJrZXIgfSwgKGVycm9yLCBkYXRhKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShkYXRhKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEb3dubG9hZCBmaWxlIGZyb20gUzMgdG8gbG9jYWwgZGlyZWN0b3J5XHJcbiAgICAgKiBAcGFyYW0gYXdzRmlsZSAtIHRoZSBmaWxlIHRvIGRvd25sb2FkIGZyb20gczNcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIGRvd25sb2FkRmlsZUZyb21TMyhhd3NGaWxlOiBBV1MuUzMuT2JqZWN0KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgaWYgKCFhd3NGaWxlIHx8ICFhd3NGaWxlLktleSkge1xyXG4gICAgICAgICAgICB3aW5zdG9uLmVycm9yKFwiYXdzIGZpbGUgaXMgdW5kZWZpbmVkXCIpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwYXJhbXMgPSB7IEJ1Y2tldDogdGhpcy5idWNrZXROYW1lLCBLZXk6IGF3c0ZpbGUuS2V5IH07XHJcbiAgICAgICAgY29uc3QgZGlyZWN0b3JpZXNMaXN0ID0gZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkoYXdzRmlsZS5LZXkpO1xyXG5cclxuICAgICAgICBsZXQgcGF0aCA9IHRoaXMudGVtcEZvbGRlcjtcclxuICAgICAgICBkaXJlY3Rvcmllc0xpc3QuZm9yRWFjaChkaXIgPT4ge1xyXG4gICAgICAgICAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhwYXRoLCBkaXIpO1xyXG4gICAgICAgICAgICBwYXRoICs9IFwiL1wiICsgZGlyO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBjb25zdCBmaWxlID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0odGhpcy50ZW1wRm9sZGVyICsgXCIvXCIgKyBhd3NGaWxlLktleSk7XHJcblxyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zM0NsaWVudC5nZXRPYmplY3QocGFyYW1zKS5jcmVhdGVSZWFkU3RyZWFtKClcclxuICAgICAgICAgICAgICAgIC5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAgICAgICAgICAgICAub24oXCJlcnJvclwiLCBlcnJvciA9PiByZWplY3QoZXJyb3IpKVxyXG4gICAgICAgICAgICAgICAgLnBpcGUoZmlsZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIifQ==
