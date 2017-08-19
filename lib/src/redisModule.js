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
const logger_1 = require("./logger");
class RedisModule {
    constructor(redisClient) {
        this.redisClient = redisClient;
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWRpc01vZHVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBRUEscUNBQW1DO0FBR25DO0lBSUksWUFBWSxXQUF5QjtRQUNqQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNuQyxDQUFDO0lBRVksYUFBYSxDQUFDLE9BQXNCOztZQUM3QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBYyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBRyxFQUFFLEtBQUs7b0JBQ2xELEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNqQixnQkFBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLE9BQU8sQ0FBQyxHQUFHLHFCQUFxQixDQUFDLENBQUM7d0JBQzFELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDbEIsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUNSLGdCQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsT0FBTyxDQUFDLEdBQUcscUJBQXFCLENBQUMsQ0FBQzt3QkFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUNOLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEIsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUFBO0lBRVksY0FBYyxDQUFDLE9BQXNCOztZQUM5QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNyQyxNQUFNLGVBQWUsR0FBRztvQkFDcEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO29CQUNsQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7b0JBQ2xCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtvQkFDbEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO29CQUNwQixZQUFZLEVBQUUsT0FBTyxDQUFDLFlBQVk7aUJBRXJDLENBQUM7Z0JBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUV6RCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUMsR0FBRztvQkFDcEQsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDTixNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2hCLENBQUM7b0JBRUQsZ0JBQU8sQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsR0FBRyx3QkFBd0IsQ0FBQyxDQUFDO29CQUNuRSxPQUFPLEVBQUUsQ0FBQztnQkFDZCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztLQUFBO0NBQ0o7QUFoREQsa0NBZ0RDO0FBRUQ7Q0FNQztBQU5ELGtDQU1DIiwiZmlsZSI6InNyYy9yZWRpc01vZHVsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIEFXUyBmcm9tIFwiYXdzLXNka1wiO1xyXG5pbXBvcnQgKiBhcyByZWRpcyBmcm9tIFwicmVkaXNcIjtcclxuaW1wb3J0IHsgd2luc3RvbiB9IGZyb20gXCIuL2xvZ2dlclwiO1xyXG5cclxuXHJcbmV4cG9ydCBjbGFzcyBSZWRpc01vZHVsZSB7XHJcblxyXG4gICAgcHJpdmF0ZSByZWRpc0NsaWVudDtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcihyZWRpc0NsaWVudDogcmVkaXMuY2xpZW50KSB7XHJcbiAgICAgICAgdGhpcy5yZWRpc0NsaWVudCA9IHJlZGlzQ2xpZW50O1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhc3luYyBpc0ZpbGVJblJlZGlzKGF3c0ZpbGU6IEFXUy5TMy5PYmplY3QpOiBQcm9taXNlPFJlZGlzT2JqZWN0PiB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlPFJlZGlzT2JqZWN0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMucmVkaXNDbGllbnQuZ2V0KGF3c0ZpbGUuS2V5LCBmdW5jdGlvbiAoZXJyLCB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luc3Rvbi52ZXJib3NlKGBmaWxlICR7YXdzRmlsZS5LZXl9IG5vdCBmb3VuZCBpbiByZWRpc2ApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUobnVsbCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5zdG9uLnZlcmJvc2UoYGZpbGUgJHthd3NGaWxlLktleX0gd2FzIGZvdW5kIGluIHJlZGlzYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShKU09OLnBhcnNlKHZhbHVlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhc3luYyBhZGRGaWxlVG9SZWRpcyhhd3NGaWxlOiBBV1MuUzMuT2JqZWN0KSB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZWxlbWVudFRvVXBsb2FkID0ge1xyXG4gICAgICAgICAgICAgICAgTGFzdE1vZGlmaWVkOiBhd3NGaWxlLkxhc3RNb2RpZmllZCxcclxuICAgICAgICAgICAgICAgIEVUYWc6IGF3c0ZpbGUuRVRhZyxcclxuICAgICAgICAgICAgICAgIFNpemU6IGF3c0ZpbGUuU2l6ZSxcclxuICAgICAgICAgICAgICAgIE93bmVyOiBhd3NGaWxlLk93bmVyLFxyXG4gICAgICAgICAgICAgICAgU3RvcmFnZUNsYXNzOiBhd3NGaWxlLlN0b3JhZ2VDbGFzcyxcclxuXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGNvbnN0IHN0cmluZ2lmeUVsZW1lbnQgPSBKU09OLnN0cmluZ2lmeShlbGVtZW50VG9VcGxvYWQpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5yZWRpc0NsaWVudC5zZXQoYXdzRmlsZS5LZXksIHN0cmluZ2lmeUVsZW1lbnQsIChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB3aW5zdG9uLnZlcmJvc2UoYEFkZGVkIGZpbGUgJHthd3NGaWxlLktleX0gc3VjY2Vzc2Z1bGx5IHRvIHJlZGlzYCk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUmVkaXNPYmplY3Qge1xyXG4gICAgTGFzdE1vZGlmaWVkOiBEYXRlO1xyXG4gICAgRVRhZzogc3RyaW5nO1xyXG4gICAgU2l6ZTogbnVtYmVyO1xyXG4gICAgT3duZXI6IHN0cmluZztcclxuICAgIFN0b3JhZ2VDbGFzczogc3RyaW5nO1xyXG59Il0sInNvdXJjZVJvb3QiOiIuLiJ9
