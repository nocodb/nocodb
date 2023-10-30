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
# Build the NestJS application
RUN npm run build

# Expose the port that the application will run on
EXPOSE 3000

# Define the command to start the application
CMD [ "npm", "run", "start:prod" ]
