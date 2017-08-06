# S3 to Azure Data Lake Store data copy
Tool to move data from AWS S3 to Azure Data Lake Store.
The tool will download the data from S3 to a local folder and then will upload it to Azure Data Lake.
The tool supports incremental data copy. In case partial data already exist in ADL, the tool 
we'll copy only the missing data.

In order to run the tool the following environment variables needs to be defined:

* AWS configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME
* Azure Configuration: AZURE_CLIENT_ID, AZURE_DOMAIN, AZURE_SECRET, AZURE_ADL_ACCOUNT_NAME
* Local folder for temporary download the files: TEMP_FOLDER

At the end of the run log file will be written to TEMP_FOLDER.

## Run With Docker
1. `docker build -t **image name** .`
2. `docker run -v '/dir:/tempdir' -e AWS_ACCESS_KEY_ID='access_Key_Id' -e AWS_SECRET_ACCESS_KEY='secret_access_key' -e AWS_REGION='region' -e AWS_BUCKET_NAME='bucket_name' -e AZURE_CLIENT_ID='azure_cliet_id' -e AZURE_DOMAIN='Azure_domain' -e AZURE_SECRET='azure_secret' -e AZURE_ADL_ACCOUNT_NAME='adl_accountName' -e TEMP_FOLDER='/tempdir' **image name**`
    The -v flag mounts the current working directory into the container. [Documentation](https://docs.docker.com/engine/reference/commandline/run/#mount-volume--v-read-only)
3. Docker image is also available at Docker Hub - `docker pull catalystcode/s3toadl`