// src/services/dynamoService.ts

import {
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { getDynamoClient } from './awsClients';
import config from '../config/aws-config';
import { PhotoRecord, GalleryPage } from '../types';

const TABLE = config.dynamodb_table;

export async function createPhotoRecord(record: PhotoRecord): Promise<void> {
  const dynamo = getDynamoClient();

  const item: Record<string, any> = { ...record };
  // Remove null values — DynamoDB doesn't store null for Number types
  if (item.gpsLat === null) delete item.gpsLat;
  if (item.gpsLon === null) delete item.gpsLon;
  if (item.restoreRequestedAt === null) delete item.restoreRequestedAt;

  await dynamo.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    })
  );
}

export async function updateUploadStatus(
  userId: string,
  photoId: string,
  status: 'uploading' | 'complete' | 'failed'
): Promise<void> {
  const dynamo = getDynamoClient();

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: marshall({ userId, photoId }),
      UpdateExpression: 'SET uploadStatus = :status, updatedAt = :now',
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':now': new Date().toISOString(),
      }),
    })
  );
}

export async function updateRestoreStatus(
  userId: string,
  photoId: string,
  status: 'none' | 'restoring' | 'restored' | 'archived',
  restoreRequestedAt?: string
): Promise<void> {
  const dynamo = getDynamoClient();

  let updateExpr = 'SET restoreStatus = :status, updatedAt = :now';
  const exprValues: Record<string, any> = {
    ':status': status,
    ':now': new Date().toISOString(),
  };

  if (restoreRequestedAt) {
    updateExpr += ', restoreRequestedAt = :reqAt';
    exprValues[':reqAt'] = restoreRequestedAt;
  }

  await dynamo.send(
    new UpdateItemCommand({
      TableName: TABLE,
      Key: marshall({ userId, photoId }),
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: marshall(exprValues),
    })
  );
}

export async function queryPhotosByDate(
  userId: string,
  options: { limit?: number; cursor?: Record<string, any>; ascending?: boolean } = {}
): Promise<GalleryPage> {
  const dynamo = getDynamoClient();
  const { limit = 60, cursor, ascending = false } = options;

  const response = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'userId-dateTaken-index',
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: marshall({ ':uid': userId }),
      ScanIndexForward: ascending,
      Limit: limit,
      ExclusiveStartKey: cursor ? marshall(cursor) : undefined,
    })
  );

  const photos = (response.Items ?? []).map((item) => unmarshall(item) as PhotoRecord);
  const lastKey = response.LastEvaluatedKey ? unmarshall(response.LastEvaluatedKey) : undefined;

  return {
    photos,
    cursor: lastKey,
    hasMore: !!response.LastEvaluatedKey,
  };
}

export async function queryByHash(
  userId: string,
  fileHash: string
): Promise<PhotoRecord | null> {
  const dynamo = getDynamoClient();

  const response = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'userId-fileHash-index',
      KeyConditionExpression: 'userId = :uid AND fileHash = :hash',
      ExpressionAttributeValues: marshall({ ':uid': userId, ':hash': fileHash }),
      Limit: 1,
    })
  );

  if (response.Items && response.Items.length > 0) {
    return unmarshall(response.Items[0]) as PhotoRecord;
  }
  return null;
}

export async function queryRestoringPhotos(
  userId: string
): Promise<PhotoRecord[]> {
  const dynamo = getDynamoClient();

  const response = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'userId-restoreStatus-index',
      KeyConditionExpression: 'userId = :uid AND restoreStatus = :status',
      ExpressionAttributeValues: marshall({ ':uid': userId, ':status': 'restoring' }),
    })
  );

  return (response.Items ?? []).map((item) => unmarshall(item) as PhotoRecord);
}

export async function deletePhotoRecord(
  userId: string,
  photoId: string
): Promise<void> {
  const dynamo = getDynamoClient();

  await dynamo.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ userId, photoId }),
    })
  );
}

export async function queryAllPhotosForStats(
  userId: string
): Promise<{ totalSize: number; photoCount: number }> {
  const dynamo = getDynamoClient();
  let totalSize = 0;
  let photoCount = 0;
  let lastKey: Record<string, any> | undefined;

  do {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: marshall({ ':uid': userId }),
        ProjectionExpression: 'fileSize',
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of response.Items ?? []) {
      const record = unmarshall(item);
      totalSize += record.fileSize ?? 0;
      photoCount++;
    }

    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return { totalSize, photoCount };
}
