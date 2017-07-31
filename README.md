# S3-to-adl-data-transfer
Tool to move data from AWS S3 to Azure Data Lake Store

In order to run the tool the following environment variables needs to be defined:

AWS configuration: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET_NAME
Azure Configuration: AZURE_CLIENT_ID, AZURE_DOMAIN, AZURE_SECRET, AZURE_ADL_ACCOUNT_NAME
Local folder for temporary download the files: TEMP_FOLDER
