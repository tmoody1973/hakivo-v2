/**
 * Raindrop Backend API Client
 *
 * This client wraps calls to the hakivo-api Raindrop-powered backend services.
 * The backend runs on Raindrop infrastructure with SmartSQL, SmartBucket,
 * SmartMemory, and SmartInference capabilities.
 *
 * Services are deployed on Raindrop at *.lmapp.run URLs
 */

// Raindrop service URLs (deployed at lmapp.run)
const RAINDROP_SERVICES = {
  // Auth Service (public)
  AUTH: process.env.NEXT_PUBLIC_API_URL ||
    "https://svc-01ka8k5e6tr0kgy0jkzj9m4q15.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  // Bills Service (public)
  BILLS: process.env.NEXT_PUBLIC_BILLS_API_URL ||
    "https://svc-01ka8k5e6tr0kgy0jkzj9m4q16.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  // Briefs Service (public)
  BRIEFS: "https://svc-01ka8k5e6tr0kgy0jkzj9m4q17.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  // Chat Service (public)
  CHAT: "https://svc-01ka8k5e6tr0kgy0jkzj9m4q18.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  // Dashboard Service (public)
  DASHBOARD: process.env.NEXT_PUBLIC_DASHBOARD_API_URL ||
    "https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
  // Members Service (public)
  MEMBERS: "https://svc-01ka8k5e6tr0kgy0jkzj9m4q1b.01k66gywmx8x4r0w31fdjjfekf.lmapp.run",
} as const;

type ServiceName = keyof typeof RAINDROP_SERVICES;

// Generic fetch wrapper with auth
async function fetchFromService<T>(
  service: ServiceName,
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl = RAINDROP_SERVICES[service];
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Bills Service (SmartSQL + SmartBucket for bill text RAG)
// ============================================================================

export interface Bill {
  id: number;
  congressId: number;
  billType: string;
  billNumber: number;
  title: string;
  shortTitle?: string;
  sponsor?: string;
  cosponsorsCount: number;
  policyArea?: string;
  status: string;
  latestActionText?: string;
  latestActionDate?: string;
  summary?: string;
  introducedDate?: string;
}

export interface BillSearchResult {
  bills: Bill[];
  total: number;
  page: number;
  perPage: number;
}

export const billsApi = {
  // Search bills using SmartSQL natural language queries
  async search(query: string, page = 1, perPage = 20): Promise<BillSearchResult> {
    const params = new URLSearchParams({ query, page: String(page), perPage: String(perPage) });
    return fetchFromService("BILLS", `/bills/search?${params}`);
  },

  // Get bill by ID
  async getById(id: number): Promise<Bill> {
    return fetchFromService("BILLS", `/bills/${id}`);
  },

  // Get bill by congress and number
  async getByNumber(congress: number, type: string, number: number): Promise<Bill> {
    return fetchFromService("BILLS", `/bills/${congress}/${type}/${number}`);
  },

  // Get bills by policy area
  async getByPolicyArea(policyArea: string, page = 1): Promise<BillSearchResult> {
    const params = new URLSearchParams({ policyArea, page: String(page) });
    return fetchFromService("BILLS", `/bills?${params}`);
  },

  // Get recent bills
  async getRecent(limit = 10): Promise<Bill[]> {
    return fetchFromService("BILLS", `/bills/recent?limit=${limit}`);
  },
};

// ============================================================================
// Representatives Service (Members)
// ============================================================================

export interface Representative {
  bioguideId: string;
  name: string;
  firstName: string;
  lastName: string;
  party: string;
  state: string;
  district?: number;
  chamber: "House" | "Senate";
  imageUrl?: string;
  phone?: string;
  website?: string;
  address?: string;
}

export const membersApi = {
  // Get all representatives
  async getAll(chamber?: "House" | "Senate"): Promise<Representative[]> {
    const params = chamber ? `?chamber=${chamber}` : "";
    return fetchFromService("MEMBERS", `/members${params}`);
  },

  // Get representative by bioguide ID
  async getById(bioguideId: string): Promise<Representative> {
    return fetchFromService("MEMBERS", `/members/${bioguideId}`);
  },

  // Get representatives by state
  async getByState(state: string): Promise<Representative[]> {
    return fetchFromService("MEMBERS", `/members/state/${state}`);
  },

  // Get representative by district
  async getByDistrict(state: string, district: number): Promise<Representative | null> {
    return fetchFromService("MEMBERS", `/members/district/${state}/${district}`);
  },

  // Lookup representatives by address (uses Geocodio)
  async lookupByAddress(address: string): Promise<{
    federal: Representative[];
    state?: Representative[];
  }> {
    const params = new URLSearchParams({ address });
    return fetchFromService("MEMBERS", `/members/lookup?${params}`);
  },
};

// ============================================================================
// Chat Service (SmartBucket RAG + SmartMemory)
// ============================================================================

export interface ChatSession {
  id: string;
  billId: number;
  bill: {
    congress: number;
    type: string;
    number: number;
    title: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export const chatApi = {
  // Create chat session for a bill
  async createSession(billId: number, token: string): Promise<{ sessionId: string }> {
    return fetchFromService("CHAT", "/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ billId }),
    }, token);
  },

  // Send message and get RAG-powered response
  async sendMessage(
    sessionId: string,
    message: string,
    token: string
  ): Promise<{ message: ChatMessage }> {
    return fetchFromService("CHAT", `/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }, token);
  },

  // Get chat history
  async getMessages(sessionId: string, token: string): Promise<{ messages: ChatMessage[] }> {
    return fetchFromService("CHAT", `/chat/sessions/${sessionId}/messages`, {}, token);
  },

  // List user's sessions
  async getSessions(token: string): Promise<{ sessions: ChatSession[] }> {
    return fetchFromService("CHAT", "/chat/sessions", {}, token);
  },

  // Delete session
  async deleteSession(sessionId: string, token: string): Promise<void> {
    return fetchFromService("CHAT", `/chat/sessions/${sessionId}`, {
      method: "DELETE",
    }, token);
  },
};

// ============================================================================
// Briefs Service (Audio briefs with SmartBucket storage)
// ============================================================================

export interface Brief {
  id: string;
  userId: string;
  type: "daily" | "weekly" | "bill";
  title: string;
  content: string;
  audioUrl?: string;
  createdAt: string;
  duration?: number;
}

export const briefsApi = {
  // Get user's briefs
  async getAll(token: string, type?: "daily" | "weekly" | "bill"): Promise<Brief[]> {
    const params = type ? `?type=${type}` : "";
    return fetchFromService("BRIEFS", `/briefs${params}`, {}, token);
  },

  // Get brief by ID
  async getById(id: string, token: string): Promise<Brief> {
    return fetchFromService("BRIEFS", `/briefs/${id}`, {}, token);
  },

  // Generate a new brief
  async generate(
    type: "daily" | "weekly" | "bill",
    options: { billId?: number },
    token: string
  ): Promise<{ briefId: string; status: string }> {
    return fetchFromService("BRIEFS", "/briefs/generate", {
      method: "POST",
      body: JSON.stringify({ type, ...options }),
    }, token);
  },
};

// ============================================================================
// Dashboard Service (Aggregated user data)
// ============================================================================

export interface DashboardData {
  trackedBills: Bill[];
  recentBriefs: Brief[];
  representatives: Representative[];
  recentActions: Array<{
    billId: number;
    billTitle: string;
    action: string;
    date: string;
  }>;
}

export const dashboardApi = {
  // Get dashboard data for user
  async getData(token: string): Promise<DashboardData> {
    return fetchFromService("DASHBOARD", "/dashboard", {}, token);
  },

  // Get user's tracked bills
  async getTrackedBills(token: string): Promise<Bill[]> {
    return fetchFromService("DASHBOARD", "/dashboard/tracked", {}, token);
  },

  // Track a bill
  async trackBill(billId: number, token: string): Promise<void> {
    return fetchFromService("DASHBOARD", "/dashboard/track", {
      method: "POST",
      body: JSON.stringify({ billId }),
    }, token);
  },

  // Untrack a bill
  async untrackBill(billId: number, token: string): Promise<void> {
    return fetchFromService("DASHBOARD", `/dashboard/track/${billId}`, {
      method: "DELETE",
    }, token);
  },
};

// ============================================================================
// Export all APIs
// ============================================================================

export const raindropClient = {
  bills: billsApi,
  members: membersApi,
  chat: chatApi,
  briefs: briefsApi,
  dashboard: dashboardApi,
};

export default raindropClient;
