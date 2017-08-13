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
const redis = require("redis");
const logger_1 = require("./logger");
class RedisModule {
    constructor(port, host) {
        this.redisClient = redis.createClient(port, host);
    }
    isFileInRedis(awsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Promise((resolve, reject) => {
                this.redisClient.get(awsFile.Key, function (err, value) {
                    if (value === null) {
                        logger_1.winston.verbose(`file ${awsFile.Key} not found in redis`);
                        resolve(null);
                    }
                    if (value) {
                        logger_1.winston.verbose(`file ${awsFile.Key} was found in redis`);
                        resolve(JSON.parse(value));
                    }
                    if (err) {
                        reject(err);
                    }
                });
            });
        });
    }
    addFileToRedis(awsFile) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield new Promise((resolve, reject) => {
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
                    logger_1.winston.verbose(`Added file ${awsFile.Key} successfully to redis`);
                    resolve();
                });
            });
        });
    }
}
exports.RedisModule = RedisModule;
class RedisObject {
}
exports.RedisObject = RedisObject;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWRpc01vZHVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsK0JBQStCO0FBQy9CLHFDQUFtQztBQUduQztJQUlJLFlBQVksSUFBWSxFQUFFLElBQVk7UUFDbEMsSUFBSSxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRVksYUFBYSxDQUFDLE9BQXNCOztZQUM3QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBYyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBRyxFQUFFLEtBQUs7b0JBQ2xELEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNqQixnQkFBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLE9BQU8sQ0FBQyxHQUFHLHFCQUFxQixDQUFDLENBQUM7d0JBQzFELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEIsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUNSLGdCQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsT0FBTyxDQUFDLEdBQUcscUJBQXFCLENBQUMsQ0FBQzt3QkFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUNOLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEIsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUFBO0lBRVksY0FBYyxDQUFDLE9BQXNCOztZQUM5QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNyQyxNQUFNLGVBQWUsR0FBRztvQkFDcEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO29CQUNsQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7b0JBQ2xCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtvQkFDbEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO29CQUNwQixZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVk7aUJBRXJDLENBQUM7Z0JBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUV6RCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUMsR0FBRztvQkFDcEQsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDTixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2hCLENBQUM7b0JBRUQsZ0JBQU8sQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsR0FBRyx3QkFBd0IsQ0FBQyxDQUFDO29CQUNuRSxPQUFPLEVBQUUsQ0FBQztnQkFDZCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUFBO0NBQ0o7QUFoREQsa0NBZ0RDO0FBRUQ7Q0FNQztBQU5ELGtDQU1DIiwiZmlsZSI6InNyYy9yZWRpc01vZHVsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgKiBhcyByZWRpcyBmcm9tIFwicmVkaXNcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5cclxuXHJcbmV4cG9ydCBjbGFzcyBSZWRpc01vZHVsZSB7XHJcblxyXG4gICAgcHJpdmF0ZSByZWRpc0NsaWVudDtcclxuXHJcbiAgICBjb25zdHJ1Y3Rvcihwb3J0OiBzdHJpbmcsIGhvc3Q6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucmVkaXNDbGllbnQgPSByZWRpcy5jcmVhdGVDbGllbnQocG9ydCwgaG9zdCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIGlzRmlsZUluUmVkaXMoYXdzRmlsZTogQVdTLlMzLk9iamVjdCk6IFByb21pc2U8UmVkaXNPYmplY3Q+IHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8UmVkaXNPYmplY3Q+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5yZWRpc0NsaWVudC5nZXQoYXdzRmlsZS5LZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5zdG9uLnZlcmJvc2UoYGZpbGUgJHthd3NGaWxlLktleX0gbm90IGZvdW5kIGluIHJlZGlzYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHdpbnN0b24udmVyYm9zZShgZmlsZSAke2F3c0ZpbGUuS2V5fSB3YXMgZm91bmQgaW4gcmVkaXNgKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKEpTT04ucGFyc2UodmFsdWUpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIGFkZEZpbGVUb1JlZGlzKGF3c0ZpbGU6IEFXUy5TMy5PYmplY3QpIHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBlbGVtZW50VG9VcGxvYWQgPSB7XHJcbiAgICAgICAgICAgICAgICBMYXN0TW9kaWZpZWQ6IGF3c0ZpbGUuTGFzdE1vZGlmaWVkLFxyXG4gICAgICAgICAgICAgICAgRVRhZzogYXdzRmlsZS5FVGFnLFxyXG4gICAgICAgICAgICAgICAgU2l6ZTogYXdzRmlsZS5TaXplLFxyXG4gICAgICAgICAgICAgICAgT3duZXI6IGF3c0ZpbGUuT3duZXIsXHJcbiAgICAgICAgICAgICAgICBTdG9yYWdlQ2xhc3M6IGF3c0ZpbGUuU3RvcmFnZUNsYXNzLFxyXG5cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgY29uc3Qgc3RyaW5naWZ5RWxlbWVudCA9IEpTT04uc3RyaW5naWZ5KGVsZW1lbnRUb1VwbG9hZCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnJlZGlzQ2xpZW50LnNldChhd3NGaWxlLktleSwgc3RyaW5naWZ5RWxlbWVudCwgKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHdpbnN0b24udmVyYm9zZShgQWRkZWQgZmlsZSAke2F3c0ZpbGUuS2V5fSBzdWNjZXNzZnVsbHkgdG8gcmVkaXNgKTtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBSZWRpc09iamVjdCB7XHJcbiAgICBMYXN0TW9kaWZpZWQ6IERhdGU7XHJcbiAgICBFVGFnOiBzdHJpbmc7XHJcbiAgICBTaXplOiBudW1iZXI7XHJcbiAgICBPd25lcjogc3RyaW5nO1xyXG4gICAgU3RvcmFnZUNsYXNzOiBzdHJpbmc7XHJcbn0iXSwic291cmNlUm9vdCI6Ii4uIn0=
