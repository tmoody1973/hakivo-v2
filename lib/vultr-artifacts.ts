/**
 * Vultr Artifact Storage
 *
 * S3-compatible storage for artifact JSON files (reports and slides).
 * Artifacts are stored with structured paths for easy retrieval and organization.
 *
 * Path structure: artifacts/{userId}/{year}/{month}/{artifactId}.json
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ============================================================================
// Types
// ============================================================================

export interface ArtifactMetadata {
  type: "report" | "slides";
  template: string;
  title: string;
  subjectType?: string;
  subjectId?: string;
  audience?: string;
  createdAt?: string;
}

export interface SaveArtifactResult {
  success: boolean;
  key?: string;
  url?: string;
  cdnUrl?: string;
  error?: string;
}

export interface GetArtifactResult {
  success: boolean;
  content?: string;
  metadata?: ArtifactMetadata;
  error?: string;
}

export interface DeleteArtifactResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const VULTR_CONFIG = {
  endpoint: process.env.VULTR_STORAGE_ENDPOINT || "https://sjc1.vultrobjects.com",
  region: process.env.VULTR_REGION || "sjc1",
  bucket: process.env.VULTR_ARTIFACTS_BUCKET || "hakivo-artifacts",
  cdnUrl: process.env.VULTR_ARTIFACTS_CDN_URL || process.env.VULTR_CDN_URL,
};

// Lazy-initialize S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const accessKey = process.env.VULTR_ACCESS_KEY;
    const secretKey = process.env.VULTR_SECRET_KEY;

    if (!accessKey || !secretKey) {
      throw new Error("Vultr credentials not configured (VULTR_ACCESS_KEY, VULTR_SECRET_KEY)");
    }

    s3Client = new S3Client({
      region: VULTR_CONFIG.region,
      endpoint: VULTR_CONFIG.endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for Vultr Object Storage
    });
  }

  return s3Client;
}

// ============================================================================
// Storage Functions
// ============================================================================

/**
 * Generate the storage key for an artifact
 */
function generateArtifactKey(userId: string, artifactId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `artifacts/${userId}/${year}/${month}/${artifactId}.json`;
}

/**
 * Save an artifact to Vultr Object Storage
 *
 * @param userId - User ID who owns the artifact
 * @param artifactId - Unique artifact ID
 * @param content - The artifact content (C1 DSL string)
 * @param metadata - Artifact metadata for indexing
 * @returns The storage key and URLs
 */
export async function saveArtifact(
  userId: string,
  artifactId: string,
  content: string,
  metadata: ArtifactMetadata
): Promise<SaveArtifactResult> {
  try {
    const client = getS3Client();
    const key = generateArtifactKey(userId, artifactId);

    // Store content and metadata together as JSON
    const storageObject = {
      content,
      metadata: {
        ...metadata,
        createdAt: metadata.createdAt || new Date().toISOString(),
      },
    };

    const command = new PutObjectCommand({
      Bucket: VULTR_CONFIG.bucket,
      Key: key,
      Body: JSON.stringify(storageObject),
      ContentType: "application/json",
      ACL: "private", // Artifacts are private by default
      Metadata: {
        "artifact-id": artifactId,
        "user-id": userId,
        "artifact-type": metadata.type,
        template: metadata.template,
      },
    });

    await client.send(command);

    const url = `${VULTR_CONFIG.endpoint}/${VULTR_CONFIG.bucket}/${key}`;
    const cdnUrl = VULTR_CONFIG.cdnUrl
      ? `${VULTR_CONFIG.cdnUrl}/${key}`
      : undefined;

    return {
      success: true,
      key,
      url,
      cdnUrl,
    };
  } catch (error) {
    console.error("Error saving artifact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save artifact",
    };
  }
}

/**
 * Retrieve an artifact from Vultr Object Storage
 *
 * @param key - The storage key for the artifact
 * @returns The artifact content and metadata
 */
export async function getArtifact(key: string): Promise<GetArtifactResult> {
  try {
    const client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: VULTR_CONFIG.bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      return {
        success: false,
        error: "Empty response from storage",
      };
    }

    // Read the body stream
    const bodyString = await response.Body.transformToString();
    const storageObject = JSON.parse(bodyString);

    return {
      success: true,
      content: storageObject.content,
      metadata: storageObject.metadata,
    };
  } catch (error) {
    console.error("Error getting artifact:", error);

    // Handle not found
    if (error instanceof Error && error.name === "NoSuchKey") {
      return {
        success: false,
        error: "Artifact not found",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get artifact",
    };
  }
}

/**
 * Delete an artifact from Vultr Object Storage
 *
 * @param key - The storage key for the artifact
 * @returns Success/failure status
 */
export async function deleteArtifact(key: string): Promise<DeleteArtifactResult> {
  try {
    const client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: VULTR_CONFIG.bucket,
      Key: key,
    });

    await client.send(command);

    return { success: true };
  } catch (error) {
    console.error("Error deleting artifact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete artifact",
    };
  }
}

/**
 * Update an existing artifact in storage
 * (convenience wrapper around saveArtifact that uses the existing key)
 *
 * @param key - The existing storage key
 * @param content - Updated content
 * @param metadata - Updated metadata
 */
export async function updateArtifact(
  key: string,
  content: string,
  metadata: ArtifactMetadata
): Promise<SaveArtifactResult> {
  try {
    const client = getS3Client();

    const storageObject = {
      content,
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    const command = new PutObjectCommand({
      Bucket: VULTR_CONFIG.bucket,
      Key: key,
      Body: JSON.stringify(storageObject),
      ContentType: "application/json",
      ACL: "private",
      Metadata: {
        "artifact-type": metadata.type,
        template: metadata.template,
      },
    });

    await client.send(command);

    const url = `${VULTR_CONFIG.endpoint}/${VULTR_CONFIG.bucket}/${key}`;

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    console.error("Error updating artifact:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update artifact",
    };
  }
}

/**
 * Generate a public URL for sharing an artifact
 * Note: This makes the artifact publicly accessible
 *
 * @param key - The storage key for the artifact
 * @returns The public URL
 */
export async function makeArtifactPublic(key: string): Promise<SaveArtifactResult> {
  try {
    const client = getS3Client();

    // Get the existing artifact
    const existing = await getArtifact(key);
    if (!existing.success || !existing.content || !existing.metadata) {
      return {
        success: false,
        error: existing.error || "Artifact not found",
      };
    }

    // Re-upload with public-read ACL
    const storageObject = {
      content: existing.content,
      metadata: existing.metadata,
    };

    const command = new PutObjectCommand({
      Bucket: VULTR_CONFIG.bucket,
      Key: key,
      Body: JSON.stringify(storageObject),
      ContentType: "application/json",
      ACL: "public-read",
    });

    await client.send(command);

    const url = `${VULTR_CONFIG.endpoint}/${VULTR_CONFIG.bucket}/${key}`;
    const cdnUrl = VULTR_CONFIG.cdnUrl
      ? `${VULTR_CONFIG.cdnUrl}/${key}`
      : undefined;

    return {
      success: true,
      key,
      url,
      cdnUrl,
    };
  } catch (error) {
    console.error("Error making artifact public:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to make artifact public",
    };
  }
}
