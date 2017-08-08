# S3 to Azure Data Lake Store incremental data copy
This tool is designed for incremental data copy from AWS S3 to Azure Data Lake Store.<br/>
For initial data copy [Azure Data Factory](https://docs.microsoft.com/en-us/azure/data-factory/data-factory-introduction) is recomended.<br/>
The tool will detect which files exist in S3 and are missing from ADL. <br/> 
It will download them from S3 to a local folder and then upload them to Azure Data Lake.<br/>

In order to run the tool the following environment variables needs to be defined:

* AWS configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME
* Azure Configuration: AZURE_CLIENT_ID, AZURE_DOMAIN, AZURE_SECRET, AZURE_ADL_ACCOUNT_NAME
* Local folder for temporary download the files: TEMP_FOLDER


## Run With Docker
1. `docker build -t **image name** .`
2. To run the docker file update the environment varaiables in the docker file, and then run:
```
`docker run -v '/dir:/tempdir' **image name**`<br/>
```
or add the enciorment varaiables as part of the docker run command:<br/>

```
docker run -v '/dir:/tempdir' -e AWS_ACCESS_KEY_ID='access_Key_Id' -e AWS_SECRET_ACCESS_KEY='secret_access_key' -e AWS_REGION='region' -e AWS_BUCKET_NAME='bucket_name' -e AZURE_CLIENT_ID='azure_cliet_id' -e AZURE_DOMAIN='Azure_domain' -e AZURE_SECRET='azure_secret' -e AZURE_ADL_ACCOUNT_NAME='adl_accountName' -e TEMP_FOLDER='/tempdir' **image name**
```</br>
The -v flag mounts the current working directory into the container. [Documentation](https://docs.docker.com/engine/reference/commandline/run/#mount-volume--v-read-only)
3. Docker image is also available at Docker Hub - `docker pull catalystcode/s3toadl`

## Run Locally
In order to run the tool locally node should be installed.
1. Define the required enviorment variables.
2. run the follwoing:
```
git clone https://github.com/CatalystCode/s3toadl.git
npm install
node lib/index.js
```


At the end of the run log file will be written to TEMP_FOLDER.
