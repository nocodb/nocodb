# Amazon Bedrock AI Integration for NocoDB

This package provides integration between NocoDB and Amazon Bedrock AI services.

## Features

- Access to AWS's powerful foundation models (Nova, Claude, Llama, etc.)
- Generate structured data using AI models from various providers through Amazon Bedrock
- Configure models and parameters for different use cases

## Usage

This integration allows you to use Amazon Bedrock AI models within NocoDB applications, enabling AI-powered features like content generation, data analysis, and more.

## Configuration

To use this integration, you'll need:
- AWS credentials (Access Key ID and Secret Access Key)
- AWS region where Bedrock is available
- Selection of which models to enable

For more information about Amazon Bedrock, visit [Amazon Bedrock's website](https://aws.amazon.com/bedrock/).

## Available Models

The integration supports many models available through Amazon Bedrock, including:

- Amazon Nova (Micro, Lite, Pro)
- Amazon Titan
- Claude 3 (Haiku, Sonnet, Opus)
- Llama 3
- Mistral
- Mixtral

You need to request access to the models you want to use through the AWS Management Console before using them with this integration. 