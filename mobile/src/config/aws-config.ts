// src/config/aws-config.ts

import { AWSConfig } from '../types';

const config: AWSConfig = {
  aws_region: 'us-east-1',
  cognito_user_pool_id: 'us-east-1_K7I4uWGGW',
  cognito_client_id: 'nvp1tj7p86q1lldefcfpd86qm',
  cognito_identity_pool_id: 'us-east-1:f73e9074-880a-4734-9f8a-c71bd161dfa6',
  s3_originals_bucket: 'glaciersnap-originals-52c3d0d2',
  s3_thumbnails_bucket: 'glaciersnap-thumbnails-52c3d0d2',
  dynamodb_table: 'glaciersnap-photos',
};

export default config;
