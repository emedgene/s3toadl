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
    constructor() {
        this.redisClient = redis.createClient('6379', 'redis');
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
                    ETag: awsFile.ETag
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9yZWRpc01vZHVsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsK0JBQStCO0FBQy9CLHFDQUFtQztBQUduQztJQUFBO1FBRVksZ0JBQVcsR0FBRyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztJQXVDOUQsQ0FBQztJQXJDZ0IsYUFBYSxDQUFDLE9BQXNCOztZQUM3QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBYyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNsRCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsR0FBRyxFQUFFLEtBQUs7b0JBQ2xELEVBQUUsQ0FBQyxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO3dCQUNqQixnQkFBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLE9BQU8sQ0FBQyxHQUFHLHFCQUFxQixDQUFDLENBQUM7d0JBQzFELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtvQkFDakIsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO3dCQUNSLGdCQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsT0FBTyxDQUFDLEdBQUcscUJBQXFCLENBQUMsQ0FBQzt3QkFDMUQsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDL0IsQ0FBQztvQkFDRCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUNOLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDaEIsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFBO1FBQ04sQ0FBQztLQUFBO0lBRVksY0FBYyxDQUFDLE9BQXNCOztZQUM5QyxNQUFNLENBQUMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO2dCQUNyQyxNQUFNLGVBQWUsR0FBRztvQkFDcEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO29CQUNsQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7aUJBQ3JCLENBQUM7Z0JBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUV6RCxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLGdCQUFnQixFQUFFLENBQUMsR0FBRztvQkFDcEQsRUFBRSxDQUFBLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzt3QkFDTCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7b0JBQ2hCLENBQUM7b0JBRUQsZ0JBQU8sQ0FBQyxPQUFPLENBQUMsY0FBYyxPQUFPLENBQUMsR0FBRyx3QkFBd0IsQ0FBQyxDQUFDO29CQUNuRSxPQUFPLEVBQUUsQ0FBQztnQkFDZCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUMsQ0FBQyxDQUFBO1FBRU4sQ0FBQztLQUFBO0NBQ0o7QUF6Q0Qsa0NBeUNDO0FBRUQ7Q0FHQztBQUhELGtDQUdDIiwiZmlsZSI6InNyYy9yZWRpc01vZHVsZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIHJlZGlzIGZyb20gXCJyZWRpc1wiO1xyXG5pbXBvcnQgeyB3aW5zdG9uIH0gZnJvbSBcIi4vbG9nZ2VyXCI7XHJcblxyXG5cclxuZXhwb3J0IGNsYXNzIFJlZGlzTW9kdWxlIHtcclxuXHJcbiAgICBwcml2YXRlIHJlZGlzQ2xpZW50ID0gcmVkaXMuY3JlYXRlQ2xpZW50KCc2Mzc5JywgJ3JlZGlzJyk7XHJcblxyXG4gICAgcHVibGljIGFzeW5jIGlzRmlsZUluUmVkaXMoYXdzRmlsZTogQVdTLlMzLk9iamVjdCk6IFByb21pc2U8UmVkaXNPYmplY3Q+IHtcclxuICAgICAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2U8UmVkaXNPYmplY3Q+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5yZWRpc0NsaWVudC5nZXQoYXdzRmlsZS5LZXksIGZ1bmN0aW9uIChlcnIsIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICB3aW5zdG9uLnZlcmJvc2UoYGZpbGUgJHthd3NGaWxlLktleX0gbm90IGZvdW5kIGluIHJlZGlzYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgd2luc3Rvbi52ZXJib3NlKGBmaWxlICR7YXdzRmlsZS5LZXl9IHdhcyBmb3VuZCBpbiByZWRpc2ApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoSlNPTi5wYXJzZSh2YWx1ZSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBhc3luYyBhZGRGaWxlVG9SZWRpcyhhd3NGaWxlOiBBV1MuUzMuT2JqZWN0KSB7XHJcbiAgICAgICAgcmV0dXJuIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZWxlbWVudFRvVXBsb2FkID0ge1xyXG4gICAgICAgICAgICAgICAgTGFzdE1vZGlmaWVkOiBhd3NGaWxlLkxhc3RNb2RpZmllZCxcclxuICAgICAgICAgICAgICAgIEVUYWc6IGF3c0ZpbGUuRVRhZ1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjb25zdCBzdHJpbmdpZnlFbGVtZW50ID0gSlNPTi5zdHJpbmdpZnkoZWxlbWVudFRvVXBsb2FkKTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMucmVkaXNDbGllbnQuc2V0KGF3c0ZpbGUuS2V5LCBzdHJpbmdpZnlFbGVtZW50LCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZihlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB3aW5zdG9uLnZlcmJvc2UoYEFkZGVkIGZpbGUgJHthd3NGaWxlLktleX0gc3VjY2Vzc2Z1bGx5IHRvIHJlZGlzYCk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pXHJcblxyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgUmVkaXNPYmplY3Qge1xyXG4gICAgTGFzdE1vZGlmaWVkIDogRGF0ZTtcclxuICAgIEVUYWc6IHN0cmluZztcclxufSJdLCJzb3VyY2VSb290IjoiLi4ifQ==
