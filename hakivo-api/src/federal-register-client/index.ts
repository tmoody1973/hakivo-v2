import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Federal Register API Response Types
 */
export interface FederalRegisterDocument {
  document_number: string;
  type: 'RULE' | 'PRORULE' | 'NOTICE' | 'PRESDOCU';
  subtype?: string;
  title: string;
  abstract?: string;
  action?: string;
  dates?: string;
  effective_on?: string;
  publication_date: string;
  agencies: FederalRegisterAgency[];
  agency_names: string[];
  topics?: string[];
  toc_subject?: string;
  toc_doc?: string;
  significant?: boolean;
  regulation_id_number_info?: Record<string, any>;
  cfr_references?: CFRReference[];
  docket_ids?: string[];
  president?: {
    name: string;
    identifier: string;
  };
  executive_order_number?: string;
  signing_date?: string;
  html_url: string;
  pdf_url: string;
  public_inspection_pdf_url?: string;
  full_text_xml_url?: string;
  raw_text_url?: string;
  body_html_url?: string;
  json_url: string;
  excerpts?: string;
  page_length: number;
  page_views?: {
    count: number;
    last_updated: string;
  };
  comments_close_on?: string;
  comment_url?: string;
  disposition_notes?: string;
  images?: Record<string, any>;
  start_page?: number;
  end_page?: number;
}

export interface FederalRegisterAgency {
  raw_name: string;
  name: string;
  id: number;
  url: string;
  json_url: string;
  parent_id?: number;
  slug: string;
  description?: string;
  short_name?: string;
  logo?: string;
  recent_articles_url?: string;
}

export interface CFRReference {
  title: number;
  part: number;
  chapter?: string;
}

export interface PublicInspectionDocument {
  document_number: string;
  type: string;
  title: string;
  agencies: FederalRegisterAgency[];
  agency_names: string[];
  publication_date: string;
  filed_at: string;
  special_filing: boolean;
  pdf_url?: string;
  html_url: string;
  json_url: string;
  docket_id?: string;
  editorial_note?: string;
  subject_1?: string;
  subject_2?: string;
  subject_3?: string;
}

export interface FederalRegisterSearchParams {
  /** Search term (searches title, abstract, full text) */
  term?: string;
  /** Document type: RULE, PRORULE, NOTICE, PRESDOCU */
  type?: string[];
  /** Presidential document subtype: executive_order, proclamation, etc. */
  presidential_document_type?: string[];
  /** Agency slugs to filter by */
  agencies?: string[];
  /** Documents from this date forward (YYYY-MM-DD) */
  publication_date_gte?: string;
  /** Documents up to this date (YYYY-MM-DD) */
  publication_date_lte?: string;
  /** Only significant regulatory actions */
  significant?: boolean;
  /** CFR title number */
  cfr_title?: number;
  /** CFR part number */
  cfr_part?: number;
  /** Docket ID */
  docket_id?: string;
  /** Only documents with open comment periods */
  commenting_on?: boolean;
  /** Comment period closing after this date */
  comment_date_gte?: string;
  /** Comment period closing before this date */
  comment_date_lte?: string;
  /** Sort order */
  order?: 'newest' | 'oldest' | 'relevance' | 'executive_order_number';
  /** Results per page (max 1000) */
  per_page?: number;
  /** Page number */
  page?: number;
  /** Fields to include in response */
  fields?: string[];
}

export interface FederalRegisterSearchResponse {
  count: number;
  total_pages: number;
  next_page_url?: string;
  previous_page_url?: string;
  results: FederalRegisterDocument[];
}

export interface PublicInspectionSearchResponse {
  count: number;
  results: PublicInspectionDocument[];
}

/**
 * Federal Register API Client
 *
 * Provides access to the Federal Register API for fetching:
 * - Executive Orders
 * - Final Rules
 * - Proposed Rules
 * - Notices
 * - Public Inspection Documents
 *
 * No API key required - public API with 1000 req/hr limit
 * API Documentation: https://www.federalregister.gov/developers/documentation/api/v1
 */
export default class extends Service<Env> {
  private readonly BASE_URL = 'https://www.federalregister.gov/api/v1';
  private readonly RATE_LIMIT = 1000; // 1000 requests per hour
  private readonly RATE_LIMIT_WINDOW = 3600000; // 1 hour in milliseconds

  /**
   * Make rate-limited request to Federal Register API
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | string[] | undefined> = {}
  ): Promise<T> {
    // Build query string, handling arrays properly
    const queryParts: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        // Federal Register API uses repeated params for arrays: agencies[]=epa&agencies[]=fda
        for (const v of value) {
          queryParts.push(`${key}[]=${encodeURIComponent(v)}`);
        }
      } else {
        queryParts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
    }

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const url = `${this.BASE_URL}${endpoint}${queryString}`;

    try {
      console.log(`✓ Federal Register API: ${endpoint}`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Hakivo/1.0 (civic-engagement-platform)'
        }
      });

      if (response.status === 429) {
        throw new Error('Federal Register rate limit exceeded (1000 req/hr)');
      }

      if (!response.ok) {
        throw new Error(`Federal Register API error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      console.error('Federal Register API request error:', error);
      throw new Error(`Federal Register request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search documents across the Federal Register
   * Supports filtering by type, agency, date range, and more
   *
   * @param params - Search parameters
   * @returns Search results with pagination
   */
  async searchDocuments(
    params: FederalRegisterSearchParams = {}
  ): Promise<FederalRegisterSearchResponse> {
    const queryParams: Record<string, any> = {
      per_page: params.per_page || 20,
      page: params.page || 1,
      order: params.order || 'newest'
    };

    // Map params to API query format
    if (params.term) queryParams['conditions[term]'] = params.term;
    if (params.type) queryParams['conditions[type]'] = params.type;
    if (params.presidential_document_type) {
      queryParams['conditions[presidential_document_type]'] = params.presidential_document_type;
    }
    if (params.agencies) queryParams['conditions[agencies]'] = params.agencies;
    if (params.publication_date_gte) {
      queryParams['conditions[publication_date][gte]'] = params.publication_date_gte;
    }
    if (params.publication_date_lte) {
      queryParams['conditions[publication_date][lte]'] = params.publication_date_lte;
    }
    if (params.significant !== undefined) {
      queryParams['conditions[significant]'] = params.significant ? '1' : '0';
    }
    if (params.cfr_title) queryParams['conditions[cfr][title]'] = params.cfr_title;
    if (params.cfr_part) queryParams['conditions[cfr][part]'] = params.cfr_part;
    if (params.docket_id) queryParams['conditions[docket_id]'] = params.docket_id;
    if (params.commenting_on) queryParams['conditions[commenting_on]'] = '1';
    if (params.comment_date_gte) {
      queryParams['conditions[comment_date][gte]'] = params.comment_date_gte;
    }
    if (params.comment_date_lte) {
      queryParams['conditions[comment_date][lte]'] = params.comment_date_lte;
    }
    if (params.fields) queryParams['fields'] = params.fields;

    console.log(`✓ Federal Register search: ${params.term || 'all'} (page ${queryParams.page})`);

    return await this.makeRequest<FederalRegisterSearchResponse>('/documents', queryParams);
  }

  /**
   * Get a single document by document number
   *
   * @param documentNumber - Federal Register document number (e.g., "2024-12345")
   * @returns Full document details
   */
  async getDocument(documentNumber: string): Promise<FederalRegisterDocument> {
    console.log(`✓ Federal Register document: ${documentNumber}`);

    return await this.makeRequest<FederalRegisterDocument>(`/documents/${documentNumber}`);
  }

  /**
   * Get multiple documents by document numbers
   * More efficient than multiple single requests
   *
   * @param documentNumbers - Array of document numbers (max 1000)
   * @returns Array of documents
   */
  async getDocuments(documentNumbers: string[]): Promise<{ results: FederalRegisterDocument[] }> {
    if (documentNumbers.length > 1000) {
      throw new Error('Maximum 1000 documents per request');
    }

    console.log(`✓ Federal Register bulk fetch: ${documentNumbers.length} documents`);

    return await this.makeRequest<{ results: FederalRegisterDocument[] }>(
      `/documents/${documentNumbers.join(',')}`
    );
  }

  /**
   * Get executive orders with optional filtering
   *
   * @param options - Filter options
   * @returns Executive orders matching criteria
   */
  async getExecutiveOrders(options: {
    president?: string;
    year?: number;
    since?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      type: ['PRESDOCU'],
      presidential_document_type: ['executive_order'],
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1
    };

    if (options.since) {
      params.publication_date_gte = options.since;
    }

    if (options.year) {
      params.publication_date_gte = `${options.year}-01-01`;
      params.publication_date_lte = `${options.year}-12-31`;
    }

    // Note: API doesn't support direct president filter, would need post-processing
    const results = await this.searchDocuments(params);

    // Filter by president if specified
    if (options.president) {
      results.results = results.results.filter(
        doc => doc.president?.identifier?.toLowerCase() === options.president?.toLowerCase() ||
               doc.president?.name?.toLowerCase().includes(options.president?.toLowerCase() || '')
      );
      results.count = results.results.length;
    }

    console.log(`✓ Federal Register executive orders: ${results.count} found`);

    return results;
  }

  /**
   * Get proclamations
   */
  async getProclamations(options: {
    since?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      type: ['PRESDOCU'],
      presidential_document_type: ['proclamation'],
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1
    };

    if (options.since) {
      params.publication_date_gte = options.since;
    }

    console.log(`✓ Federal Register proclamations search`);

    return await this.searchDocuments(params);
  }

  /**
   * Get final rules (regulations)
   *
   * @param options - Filter options
   * @returns Final rules matching criteria
   */
  async getFinalRules(options: {
    agencies?: string[];
    significant?: boolean;
    since?: string;
    cfr_title?: number;
    cfr_part?: number;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      type: ['RULE'],
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1,
      agencies: options.agencies,
      significant: options.significant,
      cfr_title: options.cfr_title,
      cfr_part: options.cfr_part
    };

    if (options.since) {
      params.publication_date_gte = options.since;
    }

    console.log(`✓ Federal Register final rules search`);

    return await this.searchDocuments(params);
  }

  /**
   * Get proposed rules (regulations in comment period)
   */
  async getProposedRules(options: {
    agencies?: string[];
    openForComment?: boolean;
    since?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      type: ['PRORULE'],
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1,
      agencies: options.agencies,
      commenting_on: options.openForComment
    };

    if (options.since) {
      params.publication_date_gte = options.since;
    }

    console.log(`✓ Federal Register proposed rules search`);

    return await this.searchDocuments(params);
  }

  /**
   * Get documents open for public comment
   * Great for civic engagement features
   */
  async getOpenForComment(options: {
    agencies?: string[];
    closingWithinDays?: number;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      commenting_on: true,
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1,
      agencies: options.agencies
    };

    if (options.closingWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + options.closingWithinDays);
      params.comment_date_lte = futureDate.toISOString().split('T')[0];
    }

    console.log(`✓ Federal Register open for comment: ${options.closingWithinDays || 'any'} days`);

    return await this.searchDocuments(params);
  }

  /**
   * Get today's Federal Register documents
   */
  async getTodaysDocuments(options: {
    type?: string[];
    agencies?: string[];
    limit?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    const today = new Date().toISOString().split('T')[0];

    const params: FederalRegisterSearchParams = {
      publication_date_gte: today,
      publication_date_lte: today,
      order: 'newest',
      per_page: options.limit || 100,
      type: options.type,
      agencies: options.agencies
    };

    console.log(`✓ Federal Register today's documents: ${today}`);

    return await this.searchDocuments(params);
  }

  /**
   * Get documents by agency
   */
  async getDocumentsByAgency(
    agencySlug: string,
    options: {
      type?: string[];
      since?: string;
      limit?: number;
      page?: number;
    } = {}
  ): Promise<FederalRegisterSearchResponse> {
    const params: FederalRegisterSearchParams = {
      agencies: [agencySlug],
      order: 'newest',
      per_page: options.limit || 20,
      page: options.page || 1,
      type: options.type
    };

    if (options.since) {
      params.publication_date_gte = options.since;
    }

    console.log(`✓ Federal Register agency: ${agencySlug}`);

    return await this.searchDocuments(params);
  }

  /**
   * Get public inspection documents
   * These are documents that will appear in upcoming Federal Register issues
   */
  async getPublicInspectionDocuments(options: {
    type?: string;
    agencies?: string[];
    special_filing?: boolean;
  } = {}): Promise<PublicInspectionSearchResponse> {
    const queryParams: Record<string, any> = {};

    if (options.type) {
      queryParams['conditions[type]'] = options.type;
    }
    if (options.agencies) {
      queryParams['conditions[agencies]'] = options.agencies;
    }
    if (options.special_filing !== undefined) {
      queryParams['conditions[special_filing]'] = options.special_filing ? '1' : '0';
    }

    console.log(`✓ Federal Register public inspection`);

    return await this.makeRequest<PublicInspectionSearchResponse>(
      '/public-inspection-documents/current',
      queryParams
    );
  }

  /**
   * Get all agencies
   */
  async getAgencies(): Promise<FederalRegisterAgency[]> {
    console.log(`✓ Federal Register agencies list`);

    return await this.makeRequest<FederalRegisterAgency[]>('/agencies');
  }

  /**
   * Get agency details
   */
  async getAgency(slug: string): Promise<FederalRegisterAgency> {
    console.log(`✓ Federal Register agency: ${slug}`);

    return await this.makeRequest<FederalRegisterAgency>(`/agencies/${slug}`);
  }

  /**
   * Get suggested search terms
   * Useful for autocomplete functionality
   */
  async getSuggestions(term: string): Promise<string[]> {
    const data = await this.makeRequest<{ suggestions: string[] }>(
      '/documents/facets/term',
      { 'conditions[term]': term }
    );
    return data.suggestions || [];
  }

  /**
   * Get document counts by various facets
   * Useful for dashboard statistics
   */
  async getDocumentCounts(options: {
    since?: string;
    until?: string;
  } = {}): Promise<{
    by_type: Record<string, number>;
    by_agency: Array<{ name: string; slug: string; count: number }>;
    total: number;
  }> {
    const params: FederalRegisterSearchParams = {
      per_page: 1,
      publication_date_gte: options.since,
      publication_date_lte: options.until
    };

    // Get counts by type
    const types = ['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU'];
    const typeCounts: Record<string, number> = {};
    let total = 0;

    for (const type of types) {
      const result = await this.searchDocuments({ ...params, type: [type] });
      typeCounts[type] = result.count;
      total += result.count;
    }

    console.log(`✓ Federal Register counts: ${total} total documents`);

    return {
      by_type: typeCounts,
      by_agency: [], // Would need additional API calls
      total
    };
  }

  /**
   * Search for documents related to specific topics
   * Maps user policy interests to Federal Register search terms
   */
  async searchByPolicyInterest(
    interest: string,
    options: {
      type?: string[];
      since?: string;
      limit?: number;
    } = {}
  ): Promise<FederalRegisterSearchResponse> {
    // Map common policy interests to search terms
    const interestMappings: Record<string, string[]> = {
      'climate': ['climate', 'environmental', 'emissions', 'clean energy'],
      'healthcare': ['health', 'medicare', 'medicaid', 'pharmaceutical'],
      'immigration': ['immigration', 'visa', 'citizenship', 'border'],
      'economy': ['economic', 'trade', 'tariff', 'financial'],
      'education': ['education', 'student', 'school', 'college'],
      'technology': ['technology', 'artificial intelligence', 'cybersecurity', 'data privacy'],
      'defense': ['defense', 'military', 'national security'],
      'housing': ['housing', 'mortgage', 'rent', 'homelessness'],
      'labor': ['labor', 'employment', 'wages', 'worker'],
      'energy': ['energy', 'oil', 'gas', 'renewable', 'nuclear']
    };

    const searchTerms = interestMappings[interest.toLowerCase()] || [interest];
    const term = searchTerms.join(' OR ');

    return await this.searchDocuments({
      term,
      type: options.type,
      publication_date_gte: options.since,
      per_page: options.limit || 20,
      order: 'relevance'
    });
  }

  /**
   * Get recent significant regulatory actions
   * These are major rules with substantial economic impact
   */
  async getSignificantActions(options: {
    since?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<FederalRegisterSearchResponse> {
    return await this.searchDocuments({
      significant: true,
      order: 'newest',
      publication_date_gte: options.since,
      per_page: options.limit || 20,
      page: options.page || 1
    });
  }

  /**
   * Get document full text
   * Fetches the raw text content of a document
   */
  async getDocumentFullText(documentNumber: string): Promise<string | null> {
    try {
      const doc = await this.getDocument(documentNumber);

      if (doc.raw_text_url) {
        const response = await fetch(doc.raw_text_url);
        if (response.ok) {
          return await response.text();
        }
      }

      // Fallback to body HTML
      if (doc.body_html_url) {
        const response = await fetch(doc.body_html_url);
        if (response.ok) {
          const html = await response.text();
          // Strip HTML tags for plain text
          return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, '\n')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching full text for ${documentNumber}:`, error);
      return null;
    }
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
