import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { AwsClient } from 'aws4fetch';

export default class extends Service<Env> {
  private awsClient: AwsClient | null = null;

  /**
   * Initialize AWS client with Vultr credentials
   * Uses aws4fetch which is Cloudflare Workers compatible
   */
  private getAwsClient(): AwsClient {
    if (!this.awsClient) {
      const accessKeyId = this.env.VULTR_ACCESS_KEY;
      const secretAccessKey = this.env.VULTR_SECRET_KEY;

      if (!accessKeyId || !secretAccessKey) {
        throw new Error('Missing Vultr S3 credentials: VULTR_ACCESS_KEY or VULTR_SECRET_KEY');
      }

      this.awsClient = new AwsClient({
        accessKeyId,
        secretAccessKey,
        service: 's3',
        region: 'auto',
      });
    }

    return this.awsClient;
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
    const aws = this.getAwsClient();
    const endpoint = this.env.VULTR_ENDPOINT;
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!endpoint) {
      throw new Error('VULTR_ENDPOINT environment variable is not set');
    }

    if (!bucketName) {
      throw new Error('VULTR_BUCKET_NAME environment variable is not set');
    }

    const key = this.generateFileKey(briefId);
    const buffer = audioBuffer instanceof ArrayBuffer ? new Uint8Array(audioBuffer) : audioBuffer;

    console.log(`[VULTR] Uploading to bucket: ${bucketName}, key: ${key}, endpoint: ${endpoint}`);

    // Build headers with metadata
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'x-amz-meta-briefid': briefId,
      'x-amz-meta-uploadedat': new Date().toISOString(),
    };

    // Add custom metadata
    if (metadata) {
      for (const [metaKey, value] of Object.entries(metadata)) {
        headers[`x-amz-meta-${metaKey.toLowerCase()}`] = value;
      }
    }

    // Construct the S3 URL (path-style)
    const uploadUrl = `https://${endpoint}/${bucketName}/${key}`;

    // Sign and send the request using aws4fetch
    // Convert to ArrayBuffer for proper BodyInit compatibility
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const response = await aws.fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`S3 upload failed: ${response.status} - ${errorText}`);
    }

    // Generate public URL (path-style)
    const url = `https://${endpoint}/${bucketName}/${key}`;

    console.log(`[VULTR] Audio uploaded: ${key} (${buffer.length} bytes)`);

    return {
      key,
      url,
      size: buffer.length
    };
  }

  /**
   * Check if file exists in storage
   * @param key - File key
   * @returns True if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    const aws = this.getAwsClient();
    const endpoint = this.env.VULTR_ENDPOINT;
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!endpoint || !bucketName) {
      throw new Error('VULTR_ENDPOINT or VULTR_BUCKET_NAME environment variable is not set');
    }

    const headUrl = `https://${endpoint}/${bucketName}/${key}`;

    try {
      const response = await aws.fetch(headUrl, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
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
    const aws = this.getAwsClient();
    const endpoint = this.env.VULTR_ENDPOINT;
    const bucketName = this.env.VULTR_BUCKET_NAME;

    if (!endpoint || !bucketName) {
      throw new Error('VULTR_ENDPOINT or VULTR_BUCKET_NAME environment variable is not set');
    }

    const headUrl = `https://${endpoint}/${bucketName}/${key}`;

    const response = await aws.fetch(headUrl, {
      method: 'HEAD',
    });

    if (!response.ok) {
      throw new Error(`File not found: ${key}`);
    }

    // Extract metadata from headers
    const extractedMetadata: Record<string, string> = {};
    response.headers.forEach((value, headerKey) => {
      if (headerKey.toLowerCase().startsWith('x-amz-meta-')) {
        const metaKey = headerKey.substring(11); // Remove 'x-amz-meta-'
        extractedMetadata[metaKey] = value;
      }
    });

    return {
      size: parseInt(response.headers.get('content-length') || '0', 10),
      lastModified: new Date(response.headers.get('last-modified') || Date.now()),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      metadata: Object.keys(extractedMetadata).length > 0 ? extractedMetadata : undefined,
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
