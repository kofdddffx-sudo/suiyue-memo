import { S3Storage } from 'coze-coding-dev-sdk';
import * as fs from 'fs';
import * as path from 'path';

const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: '',
  secretKey: '',
  bucketName: process.env.COZE_BUCKET_NAME,
  region: 'cn-beijing',
});

async function uploadAPK() {
  const apkPath = '/tmp/suiyue-memo.apk';
  
  if (!fs.existsSync(apkPath)) {
    console.error('APK file not found at', apkPath);
    process.exit(1);
  }
  
  const fileBuffer = fs.readFileSync(apkPath);
  console.log('File size:', fileBuffer.length, 'bytes');
  
  const key = await storage.uploadFile({
    fileContent: fileBuffer,
    fileName: 'suiyue-memo.apk',
    contentType: 'application/vnd.android.package-archive',
  });
  
  console.log('Uploaded with key:', key);
  
  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 604800, // 7 days
  });
  
  console.log('Download URL:', url);
}

uploadAPK().catch(console.error);
