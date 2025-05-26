# Use a Node.js image as the base image
FROM node:20-alpine as base

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Build the application
FROM base as builder

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Run the application
FROM base as runner

# Set the environment to production
ENV NODE_ENV production

# Copy the built application from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules


# Expose the port the application runs on
EXPOSE 3002

# Start the Next.js server
CMD ["npm", "start"]