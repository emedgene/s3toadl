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
const s3ToAdlDataCopy_1 = require("../src/s3ToAdlDataCopy");
function E2EFlow() {
    return __awaiter(this, void 0, void 0, function* () {
        // Validate all environment variables are set (validation is part of the ctor)
        const s3ToAdlDataCopy = new s3ToAdlDataCopy_1.S3ToAdlDataCopy();
        const dummyFileName = "test1/tempFile.txt";
        const fileContent = "data 1234";
        // Upload dummy file to S3
        yield new Promise((resolve, reject) => {
            s3ToAdlDataCopy.awsClient.putObject({
                Bucket: s3ToAdlDataCopy.awsBucketName,
                Key: dummyFileName,
                Body: fileContent,
            }, (err, data) => {
                if (err) {
                    console.log(`Error uploading file to s3: ${err}`);
                    reject(err);
                }
                else {
                    console.log("Uploaded file to s3 successfully");
                    resolve();
                }
            });
        });
        // Run flow to upload file to ADL
        yield s3ToAdlDataCopy.handler();
        // Verify the file exists in ADL and have the right content
        try {
            let status = yield s3ToAdlDataCopy.adlClient.fileSystem.getFileStatus(s3ToAdlDataCopy.azureAdlAccountName, dummyFileName);
            if (status.fileStatus.length !== fileContent.length) {
                throw new Error("File doesn't have the expected content");
            }
            else {
                console.log("E2E worked as expected!");
            }
        }
        catch (ex) {
            console.log(`file doesn't exist in the expected location: ${ex}`);
        }
    });
}
E2EFlow();

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3Rlc3QvZTJlVGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQUEsNERBQXlEO0FBRXpEOztRQUNJLDhFQUE4RTtRQUM5RSxNQUFNLGVBQWUsR0FBRyxJQUFJLGlDQUFlLEVBQUUsQ0FBQztRQUM5QyxNQUFNLGFBQWEsR0FBRyxvQkFBb0IsQ0FBQztRQUMzQyxNQUFNLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFFaEMsMEJBQTBCO1FBQzFCLE1BQU0sSUFBSSxPQUFPLENBQTJCLENBQUMsT0FBTyxFQUFFLE1BQU07WUFDeEQsZUFBZSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxlQUFlLENBQUMsYUFBYTtnQkFDckMsR0FBRyxFQUFFLGFBQWE7Z0JBQ2xCLElBQUksRUFBRSxXQUFXO2FBQ3BCLEVBQUUsQ0FBQyxHQUFHLEVBQUUsSUFBSTtnQkFDVCxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO29CQUNOLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLEdBQUcsRUFBRSxDQUFDLENBQUM7b0JBQ2xELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEIsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDSixPQUFPLENBQUMsR0FBRyxDQUFDLGtDQUFrQyxDQUFDLENBQUM7b0JBQ2hELE9BQU8sRUFBRSxDQUFDO2dCQUNkLENBQUM7WUFFTCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBQ2pDLE1BQU0sZUFBZSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBRWhDLDJEQUEyRDtRQUMzRCxJQUFJLENBQUM7WUFDRCxJQUFJLE1BQU0sR0FBRyxNQUFNLGVBQWUsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUMsbUJBQW1CLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDMUgsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ2xELE1BQU0sSUFBSSxLQUFLLENBQUMsd0NBQXdDLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1lBQzNDLENBQUM7UUFDTCxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0RBQWdELEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDdEUsQ0FBQztJQUNMLENBQUM7Q0FBQTtBQUVELE9BQU8sRUFBRSxDQUFDIiwiZmlsZSI6InRlc3QvZTJlVGVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFMzVG9BZGxEYXRhQ29weSB9IGZyb20gXCIuLi9zcmMvczNUb0FkbERhdGFDb3B5XCI7XHJcblxyXG5hc3luYyBmdW5jdGlvbiBFMkVGbG93KCkge1xyXG4gICAgLy8gVmFsaWRhdGUgYWxsIGVudmlyb25tZW50IHZhcmlhYmxlcyBhcmUgc2V0ICh2YWxpZGF0aW9uIGlzIHBhcnQgb2YgdGhlIGN0b3IpXHJcbiAgICBjb25zdCBzM1RvQWRsRGF0YUNvcHkgPSBuZXcgUzNUb0FkbERhdGFDb3B5KCk7XHJcbiAgICBjb25zdCBkdW1teUZpbGVOYW1lID0gXCJ0ZXN0MS90ZW1wRmlsZS50eHRcIjtcclxuICAgIGNvbnN0IGZpbGVDb250ZW50ID0gXCJkYXRhIDEyMzRcIjtcclxuXHJcbiAgICAvLyBVcGxvYWQgZHVtbXkgZmlsZSB0byBTM1xyXG4gICAgYXdhaXQgbmV3IFByb21pc2U8QVdTLlMzLkxpc3RPYmplY3RzT3V0cHV0PigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgczNUb0FkbERhdGFDb3B5LmF3c0NsaWVudC5wdXRPYmplY3Qoe1xyXG4gICAgICAgICAgICBCdWNrZXQ6IHMzVG9BZGxEYXRhQ29weS5hd3NCdWNrZXROYW1lLFxyXG4gICAgICAgICAgICBLZXk6IGR1bW15RmlsZU5hbWUsXHJcbiAgICAgICAgICAgIEJvZHk6IGZpbGVDb250ZW50LFxyXG4gICAgICAgIH0sIChlcnIsIGRhdGEpID0+IHtcclxuICAgICAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVycm9yIHVwbG9hZGluZyBmaWxlIHRvIHMzOiAke2Vycn1gKTtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJVcGxvYWRlZCBmaWxlIHRvIHMzIHN1Y2Nlc3NmdWxseVwiKTtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFJ1biBmbG93IHRvIHVwbG9hZCBmaWxlIHRvIEFETFxyXG4gICAgYXdhaXQgczNUb0FkbERhdGFDb3B5LmhhbmRsZXIoKTtcclxuXHJcbiAgICAvLyBWZXJpZnkgdGhlIGZpbGUgZXhpc3RzIGluIEFETCBhbmQgaGF2ZSB0aGUgcmlnaHQgY29udGVudFxyXG4gICAgdHJ5IHtcclxuICAgICAgICBsZXQgc3RhdHVzID0gYXdhaXQgczNUb0FkbERhdGFDb3B5LmFkbENsaWVudC5maWxlU3lzdGVtLmdldEZpbGVTdGF0dXMoczNUb0FkbERhdGFDb3B5LmF6dXJlQWRsQWNjb3VudE5hbWUsIGR1bW15RmlsZU5hbWUpO1xyXG4gICAgICAgIGlmIChzdGF0dXMuZmlsZVN0YXR1cy5sZW5ndGggIT09IGZpbGVDb250ZW50Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGaWxlIGRvZXNuJ3QgaGF2ZSB0aGUgZXhwZWN0ZWQgY29udGVudFwiKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIkUyRSB3b3JrZWQgYXMgZXhwZWN0ZWQhXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGV4KSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYGZpbGUgZG9lc24ndCBleGlzdCBpbiB0aGUgZXhwZWN0ZWQgbG9jYXRpb246ICR7ZXh9YCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbkUyRUZsb3coKTsiXSwic291cmNlUm9vdCI6Ii4uIn0=
