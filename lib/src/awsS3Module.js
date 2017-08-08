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
const filesHelper_1 = require("./filesHelper");
class AwsS3Module {
    constructor(bucketName, tempFolder, s3Client) {
        this.bucketName = bucketName;
        this.tempFolder = tempFolder;
        this.s3Client = s3Client;
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
                logger_1.winston.error("aws file is undefined");
                return;
            }
            const params = { Bucket: this.bucketName, Key: awsFile.Key };
            const directoriesList = filesHelper_1.getDirectoriesPathArray(awsFile.Key);
            let fullPath = this.tempFolder;
            directoriesList.forEach(dir => {
                filesHelper_1.createDirIfNotExists(fullPath, dir);
                fullPath += "/" + dir;
            });
            const file = fs.createWriteStream(path.join(this.tempFolder, awsFile.Key));
            logger_1.winston.info(`Downloading ${awsFile.Key} from S3`);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hd3NTM01vZHVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EseUJBQXlCO0FBQ3pCLDZCQUE2QjtBQUM3QixxQ0FBbUM7QUFDbkMsK0NBQThFO0FBRTlFO0lBS0ksWUFBWSxVQUFrQixFQUFFLFVBQWtCLEVBQUUsUUFBZ0I7UUFDaEUsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7UUFDN0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDN0IsQ0FBQztJQUVEOzs7T0FHRztJQUNVLGNBQWMsQ0FBQyxNQUFlOztZQUN2QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBMkIsQ0FBQyxPQUFPLEVBQUUsTUFBTTtnQkFDL0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSTtvQkFDL0UsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzt3QkFDUixNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN6QixDQUFDO29CQUVELE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3pCLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO0tBQUE7SUFFRDs7O09BR0c7SUFDVSxrQkFBa0IsQ0FBQyxPQUFzQjs7WUFDbEQsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDM0IsZ0JBQU8sQ0FBQyxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQztnQkFDdkMsTUFBTSxDQUFDO1lBQ1gsQ0FBQztZQUVELE1BQU0sTUFBTSxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUM3RCxNQUFNLGVBQWUsR0FBRyxxQ0FBdUIsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFN0QsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUMvQixlQUFlLENBQUMsT0FBTyxDQUFDLEdBQUc7Z0JBQ3ZCLGtDQUFvQixDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDcEMsUUFBUSxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUM7WUFDMUIsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLElBQUksR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNFLGdCQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7WUFDbkQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUM5QixJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxnQkFBZ0IsRUFBRTtxQkFDN0MsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLE9BQU8sRUFBRSxDQUFDO3FCQUMxQixFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUssSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7S0FBQTtDQUNKO0FBdkRELGtDQXVEQyIsImZpbGUiOiJzcmMvYXdzUzNNb2R1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzXCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5pbXBvcnQgeyBjcmVhdGVEaXJJZk5vdEV4aXN0cywgZ2V0RGlyZWN0b3JpZXNQYXRoQXJyYXkgfSBmcm9tIFwiLi9maWxlc0hlbHBlclwiO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF3c1MzTW9kdWxlIHtcclxuICAgIHB1YmxpYyBzM0NsaWVudDogQVdTLlMzO1xyXG4gICAgcHJpdmF0ZSBidWNrZXROYW1lOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIHRlbXBGb2xkZXI6IHN0cmluZztcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihidWNrZXROYW1lOiBzdHJpbmcsIHRlbXBGb2xkZXI6IHN0cmluZywgczNDbGllbnQ6IEFXUy5TMykge1xyXG4gICAgICAgIHRoaXMuYnVja2V0TmFtZSA9IGJ1Y2tldE5hbWU7XHJcbiAgICAgICAgdGhpcy50ZW1wRm9sZGVyID0gdGVtcEZvbGRlcjtcclxuICAgICAgICB0aGlzLnMzQ2xpZW50ID0gczNDbGllbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgYSBsaXN0IG9mIGFsbCBmaWxlcyBpbiBTMyBidWNrZXQgLSBpbmNsdWRpbmcgc3ViIGRpcmVjdG9yaWVzIGdldHMgMTAwMCBhdCBhIHRpbWUuXHJcbiAgICAgKiBAcGFyYW0gbWFya2VyIC0gSW5kaWNhdGVzIHRoZSBzdGFydCBwb2ludCBvZiB0aGUgbGlzdCBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBhc3luYyBsaXN0QWxsT2JqZWN0cyhtYXJrZXI/OiBzdHJpbmcpOiBQcm9taXNlPEFXUy5TMy5MaXN0T2JqZWN0c091dHB1dD4ge1xyXG4gICAgICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxBV1MuUzMuTGlzdE9iamVjdHNPdXRwdXQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zM0NsaWVudC5saXN0T2JqZWN0cyh7IEJ1Y2tldDogdGhpcy5idWNrZXROYW1lLCBNYXJrZXI6IG1hcmtlciB9LCAoZXJyb3IsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGRhdGEpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIERvd25sb2FkIGZpbGUgZnJvbSBTMyB0byBsb2NhbCBkaXJlY3RvcnlcclxuICAgICAqIEBwYXJhbSBhd3NGaWxlIC0gdGhlIGZpbGUgdG8gZG93bmxvYWQgZnJvbSBzM1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgZG93bmxvYWRGaWxlRnJvbVMzKGF3c0ZpbGU6IEFXUy5TMy5PYmplY3QpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBpZiAoIWF3c0ZpbGUgfHwgIWF3c0ZpbGUuS2V5KSB7XHJcbiAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoXCJhd3MgZmlsZSBpcyB1bmRlZmluZWRcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHsgQnVja2V0OiB0aGlzLmJ1Y2tldE5hbWUsIEtleTogYXdzRmlsZS5LZXkgfTtcclxuICAgICAgICBjb25zdCBkaXJlY3Rvcmllc0xpc3QgPSBnZXREaXJlY3Rvcmllc1BhdGhBcnJheShhd3NGaWxlLktleSk7XHJcblxyXG4gICAgICAgIGxldCBmdWxsUGF0aCA9IHRoaXMudGVtcEZvbGRlcjtcclxuICAgICAgICBkaXJlY3Rvcmllc0xpc3QuZm9yRWFjaChkaXIgPT4ge1xyXG4gICAgICAgICAgICBjcmVhdGVEaXJJZk5vdEV4aXN0cyhmdWxsUGF0aCwgZGlyKTtcclxuICAgICAgICAgICAgZnVsbFBhdGggKz0gXCIvXCIgKyBkaXI7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGZpbGUgPSBmcy5jcmVhdGVXcml0ZVN0cmVhbShwYXRoLmpvaW4odGhpcy50ZW1wRm9sZGVyLCBhd3NGaWxlLktleSkpO1xyXG4gICAgICAgIHdpbnN0b24uaW5mbyhgRG93bmxvYWRpbmcgJHthd3NGaWxlLktleX0gZnJvbSBTM2ApO1xyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5zM0NsaWVudC5nZXRPYmplY3QocGFyYW1zKS5jcmVhdGVSZWFkU3RyZWFtKClcclxuICAgICAgICAgICAgICAgIC5vbihcImVuZFwiLCAoKSA9PiByZXNvbHZlKCkpXHJcbiAgICAgICAgICAgICAgICAub24oXCJlcnJvclwiLCBlcnJvciA9PiByZWplY3QoZXJyb3IpKVxyXG4gICAgICAgICAgICAgICAgLnBpcGUoZmlsZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIuLiJ9
