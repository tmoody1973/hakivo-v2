import { ActorState, ActorStub } from './actor.js';

// export type DocumentSearchResponse = string; //standard document search response
// export type Status = { ok: boolean; id: string; at: Date };
// export type AgentId = string;
// export type Needle = string;
export type SessionId = string;
// export type Memory = string; // formatted episodic memory TBD how/what exactly is done here.
// export type SearchType = 'fragment' | 'session';
// export type Key = string; // metadata filtering

// SmartMemory is the interface for managing an agent's working memory sessions
export interface SmartMemory {
  getWorkingMemorySession(sessionId: string): Promise<ActorStub<SmartWorkingMemory>>;
  startWorkingMemorySession(): Promise<{ sessionId: SessionId; workingMemory: ActorStub<SmartWorkingMemory> }>;
  rehydrateSession(sessionId: string, summaryOnly?: boolean): Promise<{ sessionId: string; workingMemory: ActorStub<SmartWorkingMemory>; success: boolean; message: string; entriesRestored?: number }>;
  searchEpisodicMemory(terms: string, options?: {
    nMostRecent?: number;
    startTime?: Date;
    endTime?: Date;
  }): Promise<{
    results: Array<{
      sessionId: string;
      summary: string;
      agent: string;
      entryCount: number;
      timelineCount: number;
      duration: number;
      createdAt: Date;
      score?: number;
    }>;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>;
  getSemanticMemory(objectId: string): Promise<{
    success: boolean;
    document?: Record<string, unknown>;
    error?: string;
  }>;
  searchSemanticMemory(needle: string): Promise<{
    success: boolean;
    documentSearchResponse?: {
      results: Array<{
        chunkSignature?: string;
        text?: string;
        source?: string | { object?: string };
        payloadSignature?: string;
        score?: number;
        embed?: Float32Array;
        type?: string;
      }>;
    };
    error?: string;
  }>;
  putSemanticMemory(document: Record<string, unknown>): Promise<{
    success: boolean;
    objectId?: string;
    error?: string;
  }>;
  deleteSemanticMemory(objectId: string): Promise<{
    success: boolean;
    error?: string;
  }>;
  getProceduralMemory(id?: string): Promise<ActorStub<SmartProceduralMemory>>;
}

export type WorkingMemoryQuery = {
  timeline?: string; // optional, defaults to "*defaultTimeline"
  key?: string; // optional, for metadata filtering
  nMostRecent?: number; // optional, defaults to all
  startTime?: Date; // optional, for time range filtering
  endTime?: Date; // optional, for time range filtering
};

export type NewMemoryEntry = {
  timeline?: string; // optional, defaults to "*defaultTimeline"
  key?: string; // optional, for metadata filtering
  content: string;
  agent?: string; // optional, name of the agent creating this memory
  sessionId?: string; // optional, explicit sessionId to use instead of relying on metadata
  at?: Date; // optional, timestamp for the memory (defaults to current time)
};

export type MemoryEntry = {
  id: string;
  in: SessionId;
  timeline: string;
  by: string; // TODO are these indicative of the originating user/cause?
  dueTo: string; // TODO are these indicative of the originating user/cause?
  content: string;
  at: Date;
  key?: string; // optional, for metadata filtering
  agent?: string; // optional, name of the agent that created this memory
};

export type WorkingMemorySearchQuery = {
  timeline?: string; // optional, defaults to "*defaultTimeline"
  terms: string; // required, the search term to match against memory entries
  nMostRecent?: number; // optional, defaults to all
  startTime?: Date; // optional, for time range filtering
  endTime?: Date; // optional, for time range filtering
};

export type ProcedureEntry = {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProceduralMemorySearchQuery = {
  terms: string; // required, the search term to match against procedure keys and values
  nMostRecent?: number; // optional, defaults to all
  searchKeys?: boolean; // optional, search in procedure keys (default: true)
  searchValues?: boolean; // optional, search in procedure values (default: true)
};

export interface SmartWorkingMemory {
  state: ActorState;
  env: unknown;

  // endSession ends the current working memory session, optionally flushing it to long-term memory
  endSession(flush: boolean): Promise<void>;

  // getMemory retrieves exactly matching memory entries based on the provided query
  getMemory(entry: WorkingMemoryQuery): Promise<MemoryEntry[] | null>;

  // searchMemory searches for memory entries that are similar to the given term
  searchMemory(terms: WorkingMemorySearchQuery): Promise<MemoryEntry[] | null>;

  // putMemory adds a new memory entry to the working memory store
  putMemory(entry: NewMemoryEntry): Promise<string>;

  // deleteMemory removes a memory entry by its ID
  deleteMemory(entryId: string): Promise<void>;

  // summarizeMemory generates a summary of provided memory entries using an LLM
  summarizeMemory(
    memories: MemoryEntry[],
    systemPrompt?: string,
  ): Promise<{
    summary: string;
    entries: Record<string, MemoryEntry[]>;
    metadata: {
      duration: number;
      timelineCount: number;
      entryCount: number;
      agent: string;
    };
  }>;

  // rehydrateSession restores a previous session from episodic memory
  rehydrateSession(
    sessionId: string,
    summaryOnly?: boolean,
  ): Promise<{
    success: boolean;
    message: string;
    entriesRestored?: number;
  }>;

  // getRehydrationStatus gets the current status of a rehydration operation
  getRehydrationStatus(): Promise<{
    status: 'initiated' | 'processing' | 'completed' | 'failed';
    sessionId?: string;
    entriesRestored?: number;
    error?: string;
    initiatedAt?: string;
    completedAt?: string;
  } | null>;

  // searchEpisodicMemory searches across stored episodic memory documents
  searchEpisodicMemory(terms: string): Promise<{
    results: Array<{
      chunkSignature?: string;
      text?: string;
      source?: string | { object?: string };
      payloadSignature?: string;
      score?: number;
      embed?: Float32Array;
      type?: string;
    }>;
    pagination?: {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      hasMore: boolean;
    };
  }>;

  // getSemanticMemory retrieves a semantic memory document by its object ID
  getSemanticMemory(objectId: string): Promise<{
    success: boolean;
    document?: Record<string, unknown>;
    error?: string;
  }>;

  // searchSemanticMemory searches across semantic memory documents
  searchSemanticMemory(needle: string): Promise<{
    success: boolean;
    documentSearchResponse?: {
      results: Array<{
        chunkSignature?: string;
        text?: string;
        source?: string | { object?: string };
        payloadSignature?: string;
        score?: number;
        embed?: Float32Array;
        type?: string;
      }>;
    };
    error?: string;
  }>;

  // putSemanticMemory stores a document in semantic memory
  putSemanticMemory(document: Record<string, unknown>): Promise<{
    success: boolean;
    objectId?: string;
    error?: string;
  }>;

  // deleteSemanticMemory removes a semantic memory document by its object ID
  deleteSemanticMemory(objectId: string): Promise<{
    success: boolean;
    error?: string;
  }>;
}

export interface SmartProceduralMemory {
  state: ActorState;
  env: unknown;

  // putProcedure stores or updates a procedure with a key-value pair
  putProcedure(key: string, value: string): Promise<void>;

  // getProcedure retrieves a procedure value by key
  getProcedure(key: string): Promise<string | null>;

  // deleteProcedure removes a procedure by key
  deleteProcedure(key: string): Promise<boolean>;

  // listProcedures returns all stored procedures
  listProcedures(): Promise<ProcedureEntry[]>;

  // searchProcedures searches stored procedures by text matching
  searchProcedures(query: ProceduralMemorySearchQuery): Promise<ProcedureEntry[] | null>;
}

/*
// Working Memory Sessions
StartWorkingMemorySession()->{Session, Status}
EndWorkingMemorySession(Session, Flush)->Status;
RehydrateWorkingMemorySession(Session)->Status; //restore from snapshot

// optional to use, otherwise defaults to a single *defaultTimeline for the Session
OpenTimeline(Session, string name) -> {Status, Timeline?}; // name → timeline, default to "*defaultTimeline"
CloseTimeline(Timeline) -> Status;

// bookmarking a snapshot of the entire working memory
BookmarkWorkingMemorySession(string annotation) -> {Status, Bookmark?};

// reads/writes of memory in the context of some Session
// get is an exact match on an optional needle
GetWorkingMemory(Session, Timeline?, Key?, NMostRecent, StartTime?, EndTime?) -> {Status, [Entry]?};
// search is a search for nearest matches with required needle
SearchWorkingMemory(Session, Timeline?, Needle, NMostRecent, StartTime?, EndTime?) -> {Status, [Entry]?};
PutWorkingMemory(Session, Timeline?, Entry, Key?) -> Status;
DeleteWorkingMemory(Entry.id)-> Status;

// Episodic Memory (EM) - Long-term context
GetEpisodicMemory(SessionId)->{Succes, Document} // standard object get
SearchEpisodicMemory(Needle, ?StartTime, ?EndTime)->{Success, DocumentSearchResponse} // standard SB document search
PutEpisodicMemory(Memory, StartTime, EndTime)
deleteEpisodicMemory(sessionId) -> {success}; // standard object delete

// Semantic Memory (SM) - Facts & knowledge
GetSemanticMemory(SessionId) -> {Succes, Document} // standard object get
searchSemanticMemory(Needle) -> {Success, DocumentSearchResponse} // standard SB document search
putSemanticMemory() -> {}; // just standard smartbucket input
deleteSemanticMemory(objectKey) -> {success}; // standard smartbucket delete

// Procedural Memory (PM) - Skills & procedures
getProceduralMemory(SemanticMemoryId) -> {Succes, Document} // standard object get
searchProceduralMemory(Needle) -> {Success, DocumentSearchResponse} // standard SB document search
putProceduralMemory(SemanticMemoryId) -> {}; // standard sb put
deleteProceduralMemory(SemanticMemoryId) -> {}; // standard SB delete
*/
