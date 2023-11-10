# Use the official Node.js 18.12.1-alpine base image
FROM node:18.12.1-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Copy the application code to the working directory
COPY . .
RUN npm install typescript
# Install application dependencies
RUN npm install
# Build the application
RUN npm run build

COPY ./src/public ./dist/public

# Expose the port that the application will run on
EXPOSE 9000

ENV HOST=0.0.0.0 PORT=9000 NODE_ENV=production

# Define the command to start the application
CMD [ "npm", "run", "start:prod" ]
