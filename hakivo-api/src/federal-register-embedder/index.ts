import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import type { FederalRegisterDocument } from '../federal-register-client';

/**
 * Federal Register Document Embedder Service
 *
 * Handles chunking and embedding of Federal Register documents
 * for semantic search via SmartBucket.
 *
 * Chunking Strategy:
 * - Primary chunk: Title + Abstract (most searchable)
 * - Executive orders get special indexing
 * - Metadata stored as customMetadata for filtering
 */
export default class extends Service<Env> {
  /**
   * Embed a single document into the SmartBucket
   */
  async embedDocument(doc: FederalRegisterDocument): Promise<{ success: boolean; chunks: number }> {
    const smartBucket = this.env.FEDERAL_REGISTER_SEARCH;
    let chunksCreated = 0;

    try {
      // Create searchable content with all relevant text
      const searchableContent = this.createSearchableContent(doc);
      const metadata = this.createMetadata(doc);
      const key = `federal-register/${doc.type}/${doc.document_number}.txt`;

      await smartBucket.put(key, searchableContent, {
        httpMetadata: {
          contentType: 'text/plain',
          contentLanguage: 'en',
          cacheControl: 'public, max-age=86400'
        },
        customMetadata: metadata
      });
      chunksCreated++;

      // For executive orders, create additional indexed entry
      if (doc.type === 'PRESDOCU' && doc.executive_order_number) {
        const eoContent = this.createExecutiveOrderContent(doc);
        const eoKey = `federal-register/executive-orders/EO-${doc.executive_order_number}.txt`;

        await smartBucket.put(eoKey, eoContent, {
          httpMetadata: {
            contentType: 'text/plain',
            contentLanguage: 'en',
            cacheControl: 'public, max-age=86400'
          },
          customMetadata: {
            ...metadata,
            executive_order_number: doc.executive_order_number,
            president: doc.president?.name || '',
            signing_date: doc.signing_date || ''
          }
        });
        chunksCreated++;
      }

      console.log(`✓ Embedded ${doc.document_number}: ${chunksCreated} chunks`);
      return { success: true, chunks: chunksCreated };

    } catch (error) {
      console.error(`✗ Failed to embed ${doc.document_number}:`, error);
      return { success: false, chunks: 0 };
    }
  }

  /**
   * Embed multiple documents (batch operation)
   */
  async embedDocuments(docs: FederalRegisterDocument[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    totalChunks: number;
  }> {
    let successful = 0;
    let failed = 0;
    let totalChunks = 0;

    for (const doc of docs) {
      const result = await this.embedDocument(doc);
      if (result.success) {
        successful++;
        totalChunks += result.chunks;
      } else {
        failed++;
      }
    }

    return {
      total: docs.length,
      successful,
      failed,
      totalChunks
    };
  }

  /**
   * Search Federal Register documents semantically
   */
  async search(query: string, options: {
    limit?: number;
  } = {}): Promise<SearchResult[]> {
    const smartBucket = this.env.FEDERAL_REGISTER_SEARCH;
    const limit = options.limit || 10;

    try {
      // Perform semantic search
      const searchResults = await smartBucket.search({
        input: query,
        requestId: `federal-register-search-${Date.now()}`
      });

      // Process results
      const results: SearchResult[] = [];
      const seenDocNumbers = new Set<string>();

      for (const result of (searchResults.results || []).slice(0, limit * 2)) {
        // Extract document number from key
        const source = result.source || '';
        const docNumber = this.extractDocNumberFromKey(source);
        if (!docNumber || seenDocNumbers.has(docNumber)) continue;

        seenDocNumbers.add(docNumber);

        results.push({
          documentNumber: docNumber,
          source: source,
          score: result.score ?? 0,
          snippet: result.text?.substring(0, 300) || ''
        });

        if (results.length >= limit) break;
      }

      return results;

    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Delete document from SmartBucket
   */
  async deleteDocument(documentNumber: string): Promise<boolean> {
    const smartBucket = this.env.FEDERAL_REGISTER_SEARCH;

    try {
      // Try to delete main document and any EO variant
      const types = ['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU'];
      for (const type of types) {
        try {
          await smartBucket.delete(`federal-register/${type}/${documentNumber}.txt`);
        } catch {
          // May not exist
        }
      }

      console.log(`✓ Deleted document: ${documentNumber}`);
      return true;

    } catch (error) {
      console.error(`✗ Failed to delete ${documentNumber}:`, error);
      return false;
    }
  }

  // ============ Content Creation Methods ============

  /**
   * Create searchable content from document
   */
  private createSearchableContent(doc: FederalRegisterDocument): string {
    const parts = [
      doc.title,
      '',
      doc.abstract || '',
      '',
      doc.action ? `Action: ${doc.action}` : '',
      doc.dates ? `Dates: ${doc.dates}` : '',
      doc.effective_on ? `Effective: ${doc.effective_on}` : '',
      '',
      `Agencies: ${doc.agency_names.join(', ')}`,
      '',
      doc.topics && doc.topics.length > 0 ? `Topics: ${doc.topics.join(', ')}` : '',
      '',
      doc.excerpts || ''
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Create executive order specific content
   */
  private createExecutiveOrderContent(doc: FederalRegisterDocument): string {
    const parts = [
      `Executive Order ${doc.executive_order_number}`,
      '',
      doc.title,
      '',
      doc.president ? `President: ${doc.president.name}` : '',
      doc.signing_date ? `Signed: ${doc.signing_date}` : '',
      doc.effective_on ? `Effective: ${doc.effective_on}` : '',
      '',
      doc.abstract || '',
      '',
      doc.action || ''
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Create metadata for storage
   */
  private createMetadata(doc: FederalRegisterDocument): Record<string, string> {
    return {
      document_number: doc.document_number,
      document_type: doc.type,
      title: doc.title.substring(0, 500), // Limit length for metadata
      publication_date: doc.publication_date,
      agencies: doc.agency_names.join('|'),
      significant: doc.significant ? 'true' : 'false',
      html_url: doc.html_url,
      has_comment_period: doc.comments_close_on ? 'true' : 'false',
      comments_close_on: doc.comments_close_on || ''
    };
  }

  /**
   * Extract document number from SmartBucket key
   */
  private extractDocNumberFromKey(key: string): string | undefined {
    // Key format: federal-register/{type}/{document_number}.txt
    const match = key.match(/federal-register\/[^/]+\/(.+)\.txt$/);
    return match ? match[1] : undefined;
  }

  /**
   * Required fetch method for Raindrop Service
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /embed - Embed documents
    if (request.method === 'POST' && url.pathname === '/embed') {
      try {
        const body = await request.json() as { documents: FederalRegisterDocument[] };
        const result = await this.embedDocuments(body.documents);
        return Response.json(result);
      } catch (error) {
        return Response.json({ error: 'Invalid request' }, { status: 400 });
      }
    }

    // POST /search - Search documents
    if (request.method === 'POST' && url.pathname === '/search') {
      try {
        const body = await request.json() as { query: string; limit?: number };
        const results = await this.search(body.query, { limit: body.limit });
        return Response.json({ results });
      } catch (error) {
        return Response.json({ error: 'Search failed' }, { status: 500 });
      }
    }

    // DELETE /document/:id - Delete document
    if (request.method === 'DELETE' && url.pathname.startsWith('/document/')) {
      const docNumber = url.pathname.split('/').pop();
      if (docNumber) {
        const success = await this.deleteDocument(docNumber);
        return Response.json({ success });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
}

// ============ Types ============

export interface SearchResult {
  documentNumber: string;
  source: string;
  score: number;
  snippet: string;
}
