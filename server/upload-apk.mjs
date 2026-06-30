import { S3Storage } from 'coze-coding-dev-sdk';
import { createReadStream } from 'fs';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

async function main() {
  console.log('Uploading APK to object storage...');
  
  const stream = createReadStream('/tmp/suiyue-memo.apk');
  const key = await storage.streamUploadFile({
    stream,
    fileName: 'suiyue-memo.apk',
    contentType: 'application/vnd.android.package-archive',
  });
  
  console.log('Uploaded! Key:', key);
  
  const url = await storage.generatePresignedUrl({ 
    key, 
    expireTime: 604800 // 7 days
  });
  
  console.log('Download URL:', url);
}

main().catch(console.error);
