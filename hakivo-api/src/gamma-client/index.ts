import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Gamma API output formats
 */
export type GammaFormat = 'presentation' | 'document' | 'webpage' | 'social';

/**
 * Text processing modes for input content
 */
export type GammaTextMode = 'generate' | 'condense' | 'preserve';

/**
 * Text detail levels
 */
export type GammaTextAmount = 'brief' | 'medium' | 'detailed' | 'extensive';

/**
 * Image source options
 */
export type GammaImageSource =
  | 'aiGenerated'
  | 'pictographic'
  | 'unsplash'
  | 'giphy'
  | 'webAllImages'
  | 'webFreeToUse'
  | 'webFreeToUseCommercially'
  | 'placeholder'
  | 'noImages';

/**
 * Export formats available
 */
export type GammaExportFormat = 'pdf' | 'pptx';

/**
 * Card dimension options by format
 */
export type GammaPresentationDimension = 'fluid' | '16x9' | '4x3';
export type GammaDocumentDimension = 'fluid' | 'pageless' | 'letter' | 'a4';
export type GammaSocialDimension = '1x1' | '4x5' | '9x16';

/**
 * Gamma theme from the themes API
 */
export interface GammaTheme {
  id: string;
  name: string;
  previewUrl?: string;
  category?: string;
}

/**
 * Gamma folder for organization
 */
export interface GammaFolder {
  id: string;
  name: string;
}

/**
 * Text customization options
 */
export interface GammaTextOptions {
  /** Detail level: brief, medium, detailed, extensive */
  amount?: GammaTextAmount;
  /** Tone/voice description (max 500 chars) */
  tone?: string;
  /** Target audience description (max 500 chars) */
  audience?: string;
  /** Output language (default: English) */
  language?: string;
}

/**
 * Image generation options
 */
export interface GammaImageOptions {
  /** Source for images */
  source?: GammaImageSource;
  /** AI model for generated images (optional, auto-selected if not specified) */
  model?: string;
  /** Visual style direction (max 500 chars) */
  style?: string;
}

/**
 * Card styling options
 */
export interface GammaCardOptions {
  /** Aspect ratio - varies by format */
  dimensions?: GammaPresentationDimension | GammaDocumentDimension | GammaSocialDimension;
  /** Header/footer customization */
  headerFooter?: {
    topLeft?: string;
    topRight?: string;
    topCenter?: string;
    bottomLeft?: string;
    bottomRight?: string;
    bottomCenter?: string;
    hideOnFirstCard?: boolean;
    hideOnLastCard?: boolean;
  };
}

/**
 * Email sharing options
 */
export interface GammaEmailOptions {
  /** Email addresses to share with */
  recipients: string[];
  /** Access level for recipients */
  accessLevel: 'view' | 'comment' | 'edit';
}

/**
 * Request to generate a Gamma document
 */
export interface GammaGenerateRequest {
  /** Content foundation (up to 100k tokens / 400k chars) */
  inputText: string;
  /** Processing mode: generate (expand), condense (summarize), preserve (keep as-is) */
  textMode: GammaTextMode;
  /** Output format */
  format?: GammaFormat;
  /** Visual theme ID */
  themeId?: string;
  /** Number of cards (1-60 Pro, 1-75 Ultra) */
  numCards?: number;
  /** Card split method: auto or inputTextBreaks (honors \n---\n markers) */
  cardSplit?: 'auto' | 'inputTextBreaks';
  /** Text customization */
  textOptions?: GammaTextOptions;
  /** Image settings */
  imageOptions?: GammaImageOptions;
  /** Card styling */
  cardOptions?: GammaCardOptions;
  /** Workspace sharing access level */
  workspaceAccess?: 'noAccess' | 'view' | 'comment' | 'edit' | 'fullAccess';
  /** External sharing access level */
  externalAccess?: 'noAccess' | 'view' | 'comment' | 'edit';
  /** Email sharing */
  emailOptions?: GammaEmailOptions;
  /** Export file format */
  exportAs?: GammaExportFormat;
  /** Additional instructions (max 2000 chars) */
  additionalInstructions?: string;
  /** Target folder IDs for organization */
  folderIds?: string[];
}

/**
 * Generation status
 */
export type GammaGenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Gamma generation response
 */
export interface GammaGeneration {
  /** Unique generation ID */
  id: string;
  /** Current status */
  status: GammaGenerationStatus;
  /** URL to view the gamma (when completed) */
  url?: string;
  /** Thumbnail preview URL */
  thumbnailUrl?: string;
  /** Title of the generated gamma */
  title?: string;
  /** Number of cards generated */
  cardCount?: number;
  /** Export URLs if exportAs was specified */
  exports?: {
    pdf?: string;
    pptx?: string;
  };
  /** Error message if failed */
  error?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp */
  completedAt?: string;
}

/**
 * Gamma API Client Service
 *
 * Integrates with Gamma's public API for generating professional
 * presentations, documents, and webpages from content.
 *
 * Key features:
 * - Generate presentations, documents, webpages from text
 * - Multiple themes and styling options
 * - Export to PDF/PPTX
 * - Poll for generation status
 *
 * @see https://developers.gamma.app/reference/generate-a-gamma
 */
export default class extends Service<Env> {
  private readonly API_BASE = 'https://public-api.gamma.app/v1.0';

  /**
   * Get the API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.GAMMA_API_KEY;
    if (!apiKey) {
      throw new Error('GAMMA_API_KEY environment variable is not set');
    }
    return apiKey;
  }

  /**
   * Generate a new Gamma document/presentation/webpage
   *
   * @param request - Generation configuration
   * @returns Generation object with ID for polling status
   *
   * @example
   * ```typescript
   * const result = await gammaClient.generate({
   *   inputText: "# Climate Policy Overview\n\nKey points about...",
   *   textMode: 'generate',
   *   format: 'presentation',
   *   textOptions: {
   *     amount: 'medium',
   *     audience: 'High school students',
   *     tone: 'Educational and engaging'
   *   },
   *   exportAs: 'pdf'
   * });
   * ```
   */
  async generate(request: GammaGenerateRequest): Promise<GammaGeneration> {
    const apiKey = this.getApiKey();

    console.log(`[GAMMA] Generating ${request.format || 'presentation'} with ${request.inputText.length} chars`);

    // Build the API request body
    const body: Record<string, unknown> = {
      inputText: request.inputText,
      textMode: request.textMode,
    };

    // Add optional fields if provided
    if (request.format) body.format = request.format;
    if (request.themeId) body.themeId = request.themeId;
    if (request.numCards) body.numCards = request.numCards;
    if (request.cardSplit) body.cardSplit = request.cardSplit;
    if (request.textOptions) body.textOptions = request.textOptions;
    if (request.imageOptions) body.imageOptions = request.imageOptions;
    if (request.cardOptions) body.cardOptions = request.cardOptions;
    if (request.workspaceAccess) body.workspaceAccess = request.workspaceAccess;
    if (request.externalAccess) body.externalAccess = request.externalAccess;
    if (request.emailOptions) body.emailOptions = request.emailOptions;
    if (request.exportAs) body.exportAs = request.exportAs;
    if (request.additionalInstructions) body.additionalInstructions = request.additionalInstructions;
    if (request.folderIds?.length) body.folderIds = request.folderIds;

    try {
      const response = await fetch(`${this.API_BASE}/generations`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GAMMA] API error: ${response.status} - ${errorText}`);
        throw new Error(`Gamma API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        id?: string;
        generationId?: string;  // Gamma API returns this field name
        status?: string;
        url?: string;
        thumbnailUrl?: string;
        title?: string;
        cardCount?: number;
        exports?: { pdf?: string; pptx?: string };
        error?: string;
        message?: string;
        createdAt?: string;
        completedAt?: string;
      };

      // Log full response for debugging
      console.log(`[GAMMA] API response:`, JSON.stringify(result));

      // Gamma API returns 'generationId', normalize to 'id'
      const generationId = result.generationId || result.id;

      // Check if we got a valid generation ID
      if (!generationId) {
        const errorDetail = result.error || result.message || 'Unknown';
        console.error(`[GAMMA] No generation ID in response. Error: ${errorDetail}. Full response: ${JSON.stringify(result)}`);
        // Return with error info so caller can handle it - include full response for debugging
        return {
          id: '',
          status: 'failed' as GammaGenerationStatus,
          error: `Gamma API error: ${errorDetail}. Response: ${JSON.stringify(result).substring(0, 500)}`,
          createdAt: new Date().toISOString(),
        };
      }

      console.log(`[GAMMA] Generation started: ${generationId} (status: ${result.status})`);

      return {
        id: generationId,
        status: (result.status || 'pending') as GammaGenerationStatus,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        title: result.title,
        cardCount: result.cardCount,
        exports: result.exports,
        error: result.error,
        createdAt: result.createdAt || new Date().toISOString(),
        completedAt: result.completedAt,
      };
    } catch (error) {
      console.error('[GAMMA] Generation error:', error);
      throw new Error(`Gamma generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Poll for generation status
   *
   * @param generationId - The generation ID from generate()
   * @returns Updated generation status
   */
  async getStatus(generationId: string): Promise<GammaGeneration> {
    const apiKey = this.getApiKey();

    try {
      const response = await fetch(`${this.API_BASE}/generations/${generationId}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gamma API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        id: string;
        status: string;
        url?: string;
        thumbnailUrl?: string;
        title?: string;
        cardCount?: number;
        exports?: { pdf?: string; pptx?: string };
        error?: string;
        createdAt?: string;
        completedAt?: string;
      };

      return {
        id: result.id,
        status: result.status as GammaGenerationStatus,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        title: result.title,
        cardCount: result.cardCount,
        exports: result.exports,
        error: result.error,
        createdAt: result.createdAt || new Date().toISOString(),
        completedAt: result.completedAt,
      };
    } catch (error) {
      console.error('[GAMMA] Status check error:', error);
      throw new Error(`Gamma status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Poll until generation completes or times out
   *
   * @param generationId - The generation ID
   * @param options - Polling options
   * @returns Completed generation or throws on timeout/failure
   */
  async waitForCompletion(
    generationId: string,
    options: {
      /** Max time to wait in ms (default: 120000 = 2 min) */
      timeout?: number;
      /** Polling interval in ms (default: 3000 = 3 sec) */
      interval?: number;
      /** Callback on each poll */
      onPoll?: (status: GammaGeneration) => void;
    } = {}
  ): Promise<GammaGeneration> {
    const { timeout = 120000, interval = 3000, onPoll } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(generationId);

      if (onPoll) {
        onPoll(status);
      }

      if (status.status === 'completed') {
        console.log(`[GAMMA] Generation completed: ${generationId}`);
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(`Gamma generation failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Gamma generation timed out after ${timeout}ms`);
  }

  /**
   * Get export URL (PDF or PPTX) for a completed generation
   *
   * @param generationId - The generation ID
   * @param format - Export format
   * @returns Download URL
   */
  async getExportUrl(generationId: string, format: GammaExportFormat): Promise<string> {
    const status = await this.getStatus(generationId);

    if (status.status !== 'completed') {
      throw new Error(`Cannot get export URL: generation is ${status.status}`);
    }

    const url = status.exports?.[format];
    if (!url) {
      throw new Error(`Export format ${format} not available for this generation`);
    }

    return url;
  }

  /**
   * List available themes
   *
   * @returns Array of available themes
   */
  async listThemes(): Promise<GammaTheme[]> {
    const apiKey = this.getApiKey();

    try {
      const response = await fetch(`${this.API_BASE}/themes`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gamma API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        themes: Array<{
          id: string;
          name: string;
          previewUrl?: string;
          category?: string;
        }>;
      };

      console.log(`[GAMMA] Found ${result.themes?.length || 0} themes`);

      return (result.themes || []).map(theme => ({
        id: theme.id,
        name: theme.name,
        previewUrl: theme.previewUrl,
        category: theme.category,
      }));
    } catch (error) {
      console.error('[GAMMA] List themes error:', error);
      throw new Error(`Gamma list themes failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available folders for organization
   *
   * @returns Array of folders
   */
  async listFolders(): Promise<GammaFolder[]> {
    const apiKey = this.getApiKey();

    try {
      const response = await fetch(`${this.API_BASE}/folders`, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gamma API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as {
        folders: Array<{
          id: string;
          name: string;
        }>;
      };

      return (result.folders || []).map(folder => ({
        id: folder.id,
        name: folder.name,
      }));
    } catch (error) {
      console.error('[GAMMA] List folders error:', error);
      throw new Error(`Gamma list folders failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate and wait for completion in one call
   * Convenience method that combines generate() and waitForCompletion()
   *
   * @param request - Generation configuration
   * @param options - Wait options
   * @returns Completed generation
   */
  async generateAndWait(
    request: GammaGenerateRequest,
    options?: {
      timeout?: number;
      interval?: number;
      onPoll?: (status: GammaGeneration) => void;
    }
  ): Promise<GammaGeneration> {
    const generation = await this.generate(request);
    return this.waitForCompletion(generation.id, options);
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
