import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default class extends Service<Env> {
  private s3Client: S3Client | null = null;

  /**
   * Initialize S3 client with Vultr credentials
   */
  private getS3Client(): S3Client {
    if (!this.s3Client) {
      const endpoint = this.env.VULTR_ENDPOINT;
      const accessKeyId = this.env.VULTR_ACCESS_KEY;
      const secretAccessKey = this.env.VULTR_SECRET_KEY;

      if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error('Missing Vultr S3 credentials: VULTR_ENDPOINT, VULTR_ACCESS_KEY, or VULTR_SECRET_KEY');
      }

      this.s3Client = new S3Client({
        endpoint: `https://${endpoint}`,
        region: 'auto',
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: false // Vultr uses virtual-hosted-style URLs
      });
    }

    return this.s3Client;
  }

  /**
   * Generate date-based file key
   * Format: audio/YYYY/MM/DD/brief-{briefId}-{timestamp}.mp3
   */
  private generateFileKey(briefId: string, timestamp?: Date): string {
    const date = timestamp || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const ts = date.getTime();

    return `audio/${year}/${month}/${day}/brief-${briefId}-${ts}.mp3`;
  }

  /**
   * Upload audio file to Vultr object storage
   * @param briefId - Brief ID for organizing files
   * @param audioBuffer - Audio file buffer
   * @param contentType - MIME type (default: audio/mpeg)
   * @param metadata - Additional metadata
   * @returns File key and public URL
   */
  async uploadAudio(
    briefId: string,
    audioBuffer: Uint8Array | ArrayBuffer,
    contentType: string = 'audio/mpeg',
    metadata?: Record<string, string>
  ): Promise<{ key: string; url: string; size: number }> {
    const s3 = this.getS3Client();
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('VULTR_BUCKET_NAME environment variable is not set');
    }

    const key = this.generateFileKey(briefId);
    const buffer = audioBuffer instanceof ArrayBuffer ? new Uint8Array(audioBuffer) : audioBuffer;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        briefId,
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    });

    await s3.send(command);

    // Generate public URL
    const endpoint = this.env.VULTR_ENDPOINT;
    const url = `https://${bucketName}.${endpoint}/${key}`;

    console.log(`✓ Audio uploaded to Vultr: ${key} (${buffer.length} bytes)`);

    return {
      key,
      url,
      size: buffer.length
    };
  }

  /**
   * Get presigned URL for temporary access
   * @param key - File key
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const s3 = this.getS3Client();
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('VULTR_BUCKET_NAME environment variable is not set');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    const url = await getSignedUrl(s3, command, { expiresIn });

    return url;
  }

  /**
   * Check if file exists in storage
   * @param key - File key
   * @returns True if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const s3 = this.getS3Client();
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('VULTR_BUCKET_NAME environment variable is not set');
    }

    try {
      await s3.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: key
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param key - File key
   * @returns File metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
    metadata?: Record<string, string>;
  }> {
    const s3 = this.getS3Client();
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('VULTR_BUCKET_NAME environment variable is not set');
    }

    const response = await s3.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    }));

    return {
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata
    };
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
