nocodb_install_version="1.0.0"  # Replace with actual version
REQUIRED_PORTS=(80 443)
DOCKER_IMAGES=("redis:latest" "postgres:14.7" "nocodb/nocodb:latest" "nginx" "certbot/certbot:latest" )

# Array of properties with default values
basic_properties=("main|Basic Configurations" "Username for postgres database|POSTGRES_USER=postgres" "|POSTGRES_PASSWORD=test123" "|POSTGRES_DB=nocodb" "|NC_REDIS_URL=redis://redis:6379/4" '|NC_DB=pg://postgres:5432?u=postgres&password=${POSTGRES_PASSWORD:-nocodb}&d=postgres' "Are you using custom DNS, configure NC_PUBLIC_URL to reflect in the invite emails?|NC_PUBLIC_URL=$(hostname)" "Disable connecting to external db?|NC_CONNECT_TO_EXTERNAL_DB_DISABLED=false")
invite_only_signup_priorities=("main|Allow invite only sign-up" "invite only signup?|NC_INVITE_ONLY_SIGNUP=false" "|NC_ADMIN_EMAIL=admin@nocodb.com" "|NC_ADMIN_PASSWORD=nocodb123")
google_login_properties=("main|Configure Google Login" "Enter Client ID|NC_GOOGLE_CLIENT_ID=" "Enter Client ID|NC_GOOGLE_CLIENT_SECRET=")
email_properties=("main|Configure smtp properties" "|NC_SMTP_FROM=" "|NC_SMTP_HOST=" "|NC_SMTP_PORT="  "|NC_SMTP_USERNAME="  "|NC_SMTP_PASSWORD="  "|NC_SMTP_SECURE="  "|NC_SMTP_IGNORE_TLS=" )
s3_attachment_properties=("main|Do you want to configure s3 for attachements?" "|NC_S3_BUCKET_NAME=nocodb-attachements" "|NC_S3_REGION=" "|NC_S3_ACCESS_KEY=" "|NC_S3_ACCESS_SECRET=" )

multi_property_array=(basic_properties invite_only_signup_priorities google_login_properties email_properties s3_attachment_properties)



