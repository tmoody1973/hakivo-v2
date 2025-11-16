/**
 * Vultr Object Storage API Types
 *
 * S3-compatible object storage for audio file uploads with CDN.
 */

import { APIResponse, FileMetadata } from './common.types';

export interface S3UploadRequest {
  bucket: string;
  key: string; // File path in bucket
  body: Buffer | Blob | string;
  contentType: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read' | 'public-read-write';
}

export interface S3UploadResponse {
  location: string; // S3 URL
  bucket: string;
  key: string;
  etag: string;
}

export interface AudioUploadRequest {
  briefId: string;
  audioData: Buffer | string; // Base64 or Buffer
  format: string; // 'mp3', 'wav', etc.
  metadata?: {
    duration?: number;
    title?: string;
    date?: string;
  };
}

export interface AudioUploadResponse {
  fileId: string;
  url: string; // S3 URL
  cdnUrl: string; // CDN URL for fast delivery
  bucket: string;
  key: string;
  size: number;
}

export type UploadAudioResponse = APIResponse<AudioUploadResponse>;
export type GetAudioURLResponse = APIResponse<{ url: string; cdnUrl: string }>;
