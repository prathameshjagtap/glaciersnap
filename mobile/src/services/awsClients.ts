// src/services/awsClients.ts

import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import config from '../config/aws-config';
import { getCredentialProvider } from './credentialManager';

let s3Client: S3Client | null = null;
let dynamoClient: DynamoDBClient | null = null;

export function initializeClients(): void {
  const credentials = getCredentialProvider();

  s3Client = new S3Client({
    region: config.aws_region,
    credentials,
  });

  dynamoClient = new DynamoDBClient({
    region: config.aws_region,
    credentials,
  });
}

export function getS3Client(): S3Client {
  if (!s3Client) throw new Error('AWS clients not initialized. Call initializeClients() after login.');
  return s3Client;
}

export function getDynamoClient(): DynamoDBClient {
  if (!dynamoClient) throw new Error('AWS clients not initialized. Call initializeClients() after login.');
  return dynamoClient;
}

export function destroyClients(): void {
  s3Client = null;
  dynamoClient = null;
}
