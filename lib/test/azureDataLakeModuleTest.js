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
const adlsManagement = require("azure-arm-datalake-store");
const chai_1 = require("chai");
require("mocha");
const msrestAzure = require("ms-rest-azure");
const sinon = require("sinon");
const azureDataLakeModule_1 = require("../src/azureDataLakeModule");
describe("shouldUploadToADL tests", () => {
    let adlClient;
    let adlModule;
    beforeEach(function () {
        const credentials = new msrestAzure.ApplicationTokenCredentials("someclient", "domain", "secret");
        adlClient = new adlsManagement.DataLakeStoreFileSystemClient(credentials);
    });
    it("shouldUploadToADL returns true when adl file is old", () => __awaiter(this, void 0, void 0, function* () {
        // given
        const expectedResult = {
            fileStatus: {
                modificationTime: new Date(2016, 1, 1).getTime(),
            },
        };
        const stub = sinon.stub(adlClient.fileSystem, "getFileStatus").returns(expectedResult);
        adlModule = new azureDataLakeModule_1.AzureDataLakeModule("accountName", "folderName", adlClient);
        // Act
        const result = yield adlModule.shouldUploadToADL({ LastModified: new Date(), Key: "key" });
        // Assert
        chai_1.expect(result).to.equal(true);
    }));
    it("shouldUploadToADL returns false when the file in s3 is not newer than the file in ADL", () => __awaiter(this, void 0, void 0, function* () {
        // given
        const expectedResult = {
            fileStatus: {
                modificationTime: new Date().getTime(),
            },
        };
        const stub = sinon.stub(adlClient.fileSystem, "getFileStatus").returns(expectedResult);
        adlModule = new azureDataLakeModule_1.AzureDataLakeModule("accountName", "folderName", adlClient);
        // Act
        const result = yield adlModule.shouldUploadToADL({ LastModified: new Date(2016, 1, 1), Key: "key" });
        // Assert
        chai_1.expect(result).to.equal(false);
    }));
    it("shouldUploadToADL returns true when file does not exist in adl", () => __awaiter(this, void 0, void 0, function* () {
        // given
        const stub = sinon.stub(adlClient.fileSystem, "getFileStatus").throws(new Error("file doesn't exists in ADL"));
        adlModule = new azureDataLakeModule_1.AzureDataLakeModule("accountName", "folderName", adlClient);
        // Act
        const result = yield adlModule.shouldUploadToADL({ LastModified: new Date(), Key: "key" });
        // Assert
        chai_1.expect(result).to.equal(true);
    }));
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3Rlc3QvYXp1cmVEYXRhTGFrZU1vZHVsZVRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUNBLDJEQUEyRDtBQUMzRCwrQkFBOEI7QUFDOUIsaUJBQWU7QUFDZiw2Q0FBNkM7QUFDN0MsK0JBQStCO0FBQy9CLG9FQUFpRTtBQUVqRSxRQUFRLENBQUMseUJBQXlCLEVBQUU7SUFDaEMsSUFBSSxTQUF1RCxDQUFDO0lBQzVELElBQUksU0FBOEIsQ0FBQztJQUVuQyxVQUFVLENBQUM7UUFDUCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2xHLFNBQVMsR0FBRyxJQUFJLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM5RSxDQUFDLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxxREFBcUQsRUFBRTtRQUN0RCxRQUFRO1FBQ1IsTUFBTSxjQUFjLEdBQUc7WUFDbkIsVUFBVSxFQUFFO2dCQUNSLGdCQUFnQixFQUFFLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFO2FBQ25EO1NBQ0osQ0FBQztRQUNGLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdkYsU0FBUyxHQUFHLElBQUkseUNBQW1CLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUU1RSxNQUFNO1FBQ04sTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsaUJBQWlCLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUUzRixTQUFTO1FBQ1QsYUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQyxDQUFBLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyx1RkFBdUYsRUFBRTtRQUN4RixRQUFRO1FBQ1IsTUFBTSxjQUFjLEdBQUc7WUFDbkIsVUFBVSxFQUFFO2dCQUNSLGdCQUFnQixFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFO2FBQ3pDO1NBQ0osQ0FBQztRQUNGLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdkYsU0FBUyxHQUFHLElBQUkseUNBQW1CLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUU1RSxNQUFNO1FBQ04sTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsaUJBQWlCLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUVyRyxTQUFTO1FBQ1QsYUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbkMsQ0FBQyxDQUFBLENBQUMsQ0FBQztJQUVILEVBQUUsQ0FBQyxnRUFBZ0UsRUFBRTtRQUNqRSxRQUFRO1FBQ1IsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxDQUFDLENBQUM7UUFDL0csU0FBUyxHQUFHLElBQUkseUNBQW1CLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztRQUU1RSxNQUFNO1FBQ04sTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsaUJBQWlCLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBSSxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUUzRixTQUFTO1FBQ1QsYUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbEMsQ0FBQyxDQUFBLENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvYXp1cmVEYXRhTGFrZU1vZHVsZVRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBBV1MgZnJvbSBcImF3cy1zZGtcIjtcclxuaW1wb3J0ICogYXMgYWRsc01hbmFnZW1lbnQgZnJvbSBcImF6dXJlLWFybS1kYXRhbGFrZS1zdG9yZVwiO1xyXG5pbXBvcnQgeyBleHBlY3QgfSBmcm9tIFwiY2hhaVwiO1xyXG5pbXBvcnQgXCJtb2NoYVwiO1xyXG5pbXBvcnQgKiBhcyBtc3Jlc3RBenVyZSBmcm9tIFwibXMtcmVzdC1henVyZVwiO1xyXG5pbXBvcnQgKiBhcyBzaW5vbiBmcm9tIFwic2lub25cIjtcclxuaW1wb3J0IHsgQXp1cmVEYXRhTGFrZU1vZHVsZSB9IGZyb20gXCIuLi9zcmMvYXp1cmVEYXRhTGFrZU1vZHVsZVwiO1xyXG5cclxuZGVzY3JpYmUoXCJzaG91bGRVcGxvYWRUb0FETCB0ZXN0c1wiLCAoKSA9PiB7XHJcbiAgICBsZXQgYWRsQ2xpZW50OiBhZGxzTWFuYWdlbWVudC5EYXRhTGFrZVN0b3JlRmlsZVN5c3RlbUNsaWVudDtcclxuICAgIGxldCBhZGxNb2R1bGU6IEF6dXJlRGF0YUxha2VNb2R1bGU7XHJcblxyXG4gICAgYmVmb3JlRWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgY29uc3QgY3JlZGVudGlhbHMgPSBuZXcgbXNyZXN0QXp1cmUuQXBwbGljYXRpb25Ub2tlbkNyZWRlbnRpYWxzKFwic29tZWNsaWVudFwiLCBcImRvbWFpblwiLCBcInNlY3JldFwiKTtcclxuICAgICAgICBhZGxDbGllbnQgPSBuZXcgYWRsc01hbmFnZW1lbnQuRGF0YUxha2VTdG9yZUZpbGVTeXN0ZW1DbGllbnQoY3JlZGVudGlhbHMpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXQoXCJzaG91bGRVcGxvYWRUb0FETCByZXR1cm5zIHRydWUgd2hlbiBhZGwgZmlsZSBpcyBvbGRcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIC8vIGdpdmVuXHJcbiAgICAgICAgY29uc3QgZXhwZWN0ZWRSZXN1bHQgPSB7XHJcbiAgICAgICAgICAgIGZpbGVTdGF0dXM6IHtcclxuICAgICAgICAgICAgICAgIG1vZGlmaWNhdGlvblRpbWU6IG5ldyBEYXRlKDIwMTYsIDEsIDEpLmdldFRpbWUoKSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9O1xyXG4gICAgICAgIGNvbnN0IHN0dWIgPSBzaW5vbi5zdHViKGFkbENsaWVudC5maWxlU3lzdGVtLCBcImdldEZpbGVTdGF0dXNcIikucmV0dXJucyhleHBlY3RlZFJlc3VsdCk7XHJcbiAgICAgICAgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUoXCJhY2NvdW50TmFtZVwiLCBcImZvbGRlck5hbWVcIiwgYWRsQ2xpZW50KTtcclxuXHJcbiAgICAgICAgLy8gQWN0XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKHsgTGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgpLCBLZXk6IFwia2V5XCIgfSk7XHJcblxyXG4gICAgICAgIC8vIEFzc2VydFxyXG4gICAgICAgIGV4cGVjdChyZXN1bHQpLnRvLmVxdWFsKHRydWUpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaXQoXCJzaG91bGRVcGxvYWRUb0FETCByZXR1cm5zIGZhbHNlIHdoZW4gdGhlIGZpbGUgaW4gczMgaXMgbm90IG5ld2VyIHRoYW4gdGhlIGZpbGUgaW4gQURMXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgICAvLyBnaXZlblxyXG4gICAgICAgIGNvbnN0IGV4cGVjdGVkUmVzdWx0ID0ge1xyXG4gICAgICAgICAgICBmaWxlU3RhdHVzOiB7XHJcbiAgICAgICAgICAgICAgICBtb2RpZmljYXRpb25UaW1lOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9O1xyXG4gICAgICAgIGNvbnN0IHN0dWIgPSBzaW5vbi5zdHViKGFkbENsaWVudC5maWxlU3lzdGVtLCBcImdldEZpbGVTdGF0dXNcIikucmV0dXJucyhleHBlY3RlZFJlc3VsdCk7XHJcbiAgICAgICAgYWRsTW9kdWxlID0gbmV3IEF6dXJlRGF0YUxha2VNb2R1bGUoXCJhY2NvdW50TmFtZVwiLCBcImZvbGRlck5hbWVcIiwgYWRsQ2xpZW50KTtcclxuXHJcbiAgICAgICAgLy8gQWN0XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYWRsTW9kdWxlLnNob3VsZFVwbG9hZFRvQURMKHsgTGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgyMDE2LCAxLCAxKSwgS2V5OiBcImtleVwiIH0pO1xyXG5cclxuICAgICAgICAvLyBBc3NlcnRcclxuICAgICAgICBleHBlY3QocmVzdWx0KS50by5lcXVhbChmYWxzZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpdChcInNob3VsZFVwbG9hZFRvQURMIHJldHVybnMgdHJ1ZSB3aGVuIGZpbGUgZG9lcyBub3QgZXhpc3QgaW4gYWRsXCIsIGFzeW5jICgpID0+IHtcclxuICAgICAgICAvLyBnaXZlblxyXG4gICAgICAgIGNvbnN0IHN0dWIgPSBzaW5vbi5zdHViKGFkbENsaWVudC5maWxlU3lzdGVtLCBcImdldEZpbGVTdGF0dXNcIikudGhyb3dzKG5ldyBFcnJvcihcImZpbGUgZG9lc24ndCBleGlzdHMgaW4gQURMXCIpKTtcclxuICAgICAgICBhZGxNb2R1bGUgPSBuZXcgQXp1cmVEYXRhTGFrZU1vZHVsZShcImFjY291bnROYW1lXCIsIFwiZm9sZGVyTmFtZVwiLCBhZGxDbGllbnQpO1xyXG5cclxuICAgICAgICAvLyBBY3RcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhZGxNb2R1bGUuc2hvdWxkVXBsb2FkVG9BREwoeyBMYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKCksIEtleTogXCJrZXlcIiB9KTtcclxuXHJcbiAgICAgICAgLy8gQXNzZXJ0XHJcbiAgICAgICAgZXhwZWN0KHJlc3VsdCkudG8uZXF1YWwodHJ1ZSk7XHJcbiAgICB9KTtcclxufSk7Il0sInNvdXJjZVJvb3QiOiIuLiJ9
