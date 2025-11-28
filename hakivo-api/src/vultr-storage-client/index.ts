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
        forcePathStyle: true // Use path-style URLs for better compatibility
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

    console.log(`[VULTR] Uploading to bucket: ${bucketName}, key: ${key}, endpoint: ${this.env.VULTR_ENDPOINT}`);

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

    // Generate public URL (path-style)
    const endpoint = this.env.VULTR_ENDPOINT;
    const url = `https://${endpoint}/${bucketName}/${key}`;

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
   * HTTP handler for external audio uploads (used by Netlify background functions)
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (request.method === 'GET' && path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'vultr-storage-client' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Upload endpoint for external callers (Netlify background functions)
    if (request.method === 'POST' && path === '/upload') {
      try {
        const body = await request.json() as {
          briefId: string;
          audioBase64: string;
          mimeType?: string;
        };

        if (!body.briefId || !body.audioBase64) {
          return new Response(JSON.stringify({ error: 'Missing briefId or audioBase64' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Convert base64 to Uint8Array
        const audioBuffer = Uint8Array.from(atob(body.audioBase64), c => c.charCodeAt(0));

        // Upload to Vultr
        const result = await this.uploadAudio(
          body.briefId,
          audioBuffer,
          body.mimeType || 'audio/wav'
        );

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[VULTR] Upload error:', errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
}
