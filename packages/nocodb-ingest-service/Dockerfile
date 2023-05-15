# Use the official Node.js 14.x base image
FROM node:14-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the application code to the working directory
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the port that the application will run on
EXPOSE 3000

# Define the command to start the application
CMD [ "npm", "run", "start:prod" ]
