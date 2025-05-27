# Use the official Node.js 18.19.1-alpine base image
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# install node-gyp dependencies
RUN apk add --no-cache python3 make g++

# Copy the application code to the working directory
COPY . .

# Remove local dependencies
RUN npm uninstall knex-snowflake knex-databricks
# Install the application dependencies
RUN npm install --production

# Expose the port that the application will run on
EXPOSE 9000

ENV HOST=0.0.0.0 PORT=9000 NODE_ENV=production

# Define the command to start the application
CMD ["npm", "run", "start:prod"]
