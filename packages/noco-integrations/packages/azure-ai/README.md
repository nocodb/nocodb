# Azure AI Integration for NocoDB

This package provides integration between NocoDB and Azure OpenAI services.

## Features

- Access to Microsoft's Azure-hosted OpenAI models
- Generate structured data using AI models in your secure Azure environment
- Configure models and parameters for different use cases

## Usage

This integration allows you to use Azure OpenAI models within NocoDB applications, enabling AI-powered features like content generation, data analysis, and more.

## Configuration

To use this integration, you'll need:
- Azure OpenAI API key
- Azure resource name (e.g., "my-azure-openai")
- API version (e.g., "2024-05-01-preview")
- Deployment names of models to enable

For more information about Azure OpenAI, visit [Azure OpenAI's website](https://azure.microsoft.com/en-us/products/ai-services/openai-service).

## Available Models

The integration supports the OpenAI models available through Azure OpenAI Service, including:

- GPT-4 and GPT-4 Turbo
- GPT-3.5 Turbo
- Text embedding models

You need to deploy the models you want to use through the Azure Portal before using them with this integration. 