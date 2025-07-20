# Dockerfile for aws-k6 project
FROM public.ecr.aws/lambda/nodejs:20 as base

# Install system dependencies and AWS SAM CLI
RUN apt-get update && \
    apt-get install -y openjdk-17-jre-headless curl unzip && \
    curl -Lo aws-sam-cli-linux-x86_64.zip https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip && \
    unzip aws-sam-cli-linux-x86_64.zip -d sam-installation && \
    ./sam-installation/install && \
    rm -rf aws-sam-cli-linux-x86_64.zip sam-installation

WORKDIR /var/task

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the code
COPY . .

# Download Karate JAR
RUN curl -L -o karate.jar https://github.com/karatelabs/karate/releases/download/v1.4.1/karate-1.4.1.jar

# Expose ports for SAM/LocalStack
EXPOSE 3000 4566

# Default command (override in docker-compose)
CMD ["bash"]
