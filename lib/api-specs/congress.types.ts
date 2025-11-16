/**
 * Congress.gov API Types
 *
 * Type definitions for Congress.gov API including bills, members, votes,
 * committees, and legislative actions for the 118th & 119th Congress.
 *
 * API Documentation: https://api.congress.gov/
 */

import { PaginatedResponse, SortOrder } from './common.types';

// ============================================================================
// Congress Types
// ============================================================================

/**
 * Congress number (118th = 2023-2024, 119th = 2025-2026)
 */
export type CongressNumber = 118 | 119;

/**
 * Legislative chamber
 */
export enum Chamber {
  HOUSE = 'house',
  SENATE = 'senate',
}

// ============================================================================
// Bill Types
// ============================================================================

/**
 * Bill type abbreviations
 */
export enum BillType {
  HR = 'hr', // House Bill
  S = 's', // Senate Bill
  HJRES = 'hjres', // House Joint Resolution
  SJRES = 'sjres', // Senate Joint Resolution
  HCONRES = 'hconres', // House Concurrent Resolution
  SCONRES = 'sconres', // Senate Concurrent Resolution
  HRES = 'hres', // House Simple Resolution
  SRES = 'sres', // Senate Simple Resolution
}

/**
 * Legislative bill object
 */
export interface Bill {
  congress: number;
  type: string;
  number: string;
  originChamber?: string;
  originChamberCode?: string;
  title: string;
  introducedDate: string;
  updateDate: string;
  latestAction?: BillAction;
  sponsors?: Sponsor[];
  cosponsors?: Cosponsor[];
  committees?: Committee[];
  subjects?: Subject[];
  summaries?: Summary[];
  laws?: Law[];
  policyArea?: string;
  constitutionalAuthorityStatementText?: string;
  url?: string;
}

/**
 * Detailed bill information
 */
export interface BillDetail extends Bill {
  actions: BillAction[];
  amendments?: Amendment[];
  relatedBills?: RelatedBill[];
  titles: Title[];
  textVersions?: TextVersion[];
  cboCostEstimates?: CBOCostEstimate[];
}

/**
 * Bill action/activity
 */
export interface BillAction {
  actionDate: string;
  text: string;
  type?: string;
  actionCode?: string;
  sourceSystem?: {
    code: number;
    name: string;
  };
  committees?: Committee[];
}

/**
 * Bill sponsor
 */
export interface Sponsor {
  bioguideId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  party: string;
  state: string;
  district?: number;
  url?: string;
  isByRequest?: string;
}

/**
 * Bill cosponsor
 */
export interface Cosponsor extends Sponsor {
  sponsorshipDate: string;
  isOriginalCosponsor: boolean;
}

/**
 * Bill subject/topic
 */
export interface Subject {
  name: string;
  updateDate?: string;
}

/**
 * Bill summary
 */
export interface Summary {
  actionDate: string;
  actionDesc: string;
  text: string;
  updateDate: string;
  versionCode?: string;
}

/**
 * Public law information
 */
export interface Law {
  number: string;
  type: string;
}

/**
 * Bill title
 */
export interface Title {
  title: string;
  titleType: string;
  titleTypeCode?: number;
  chamberCode?: string;
  chamberName?: string;
  billTextVersionCode?: string;
  billTextVersionName?: string;
  updateDate?: string;
}

/**
 * Bill amendment
 */
export interface Amendment {
  congress: number;
  type: string;
  number: string;
  purpose?: string;
  description?: string;
  proposedDate?: string;
  updateDate: string;
  latestAction?: BillAction;
  sponsors?: Sponsor[];
}

/**
 * Related bill
 */
export interface RelatedBill {
  congress: number;
  type: string;
  number: string;
  relationshipDetails: {
    type: string;
    identifiedBy: string;
  }[];
  title?: string;
  latestAction?: BillAction;
}

/**
 * Bill text version
 */
export interface TextVersion {
  type: string;
  date: string;
  formats: {
    type: string;
    url: string;
  }[];
}

/**
 * CBO cost estimate
 */
export interface CBOCostEstimate {
  description: string;
  pubDate: string;
  title: string;
  url: string;
}

// ============================================================================
// Member Types
// ============================================================================

/**
 * Congressional member
 */
export interface Member {
  bioguideId: string;
  district?: number;
  partyName: string;
  state: string;
  name: string;
  updateDate: string;
  url?: string;
  terms?: MemberTerm[];
  depiction?: {
    attribution?: string;
    imageUrl?: string;
  };
}

/**
 * Detailed member information
 */
export interface MemberDetail extends Member {
  birthYear?: string;
  deathYear?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  honorificName?: string;
  officialWebsiteUrl?: string;
  addressInformation?: AddressInformation;
  sponsoredLegislation?: {
    count: number;
  };
  cosponsoredLegislation?: {
    count: number;
  };
}

/**
 * Member term information
 */
export interface MemberTerm {
  chamber: string;
  startYear: number;
  endYear?: number;
  memberType?: string;
}

/**
 * Member address information
 */
export interface AddressInformation {
  officeAddress?: string;
  city?: string;
  district?: string;
  zipCode?: number;
  phoneNumber?: string;
}

// ============================================================================
// Committee Types
// ============================================================================

/**
 * Congressional committee
 */
export interface Committee {
  systemCode?: string;
  name: string;
  chamber?: string;
  type?: string;
  subcommittees?: Committee[];
  updateDate?: string;
  url?: string;
}

/**
 * Committee detail
 */
export interface CommitteeDetail extends Committee {
  establishedDate?: string;
  history?: {
    date: string;
    description: string;
  }[];
  bills?: {
    count: number;
    url: string;
  };
  reports?: {
    count: number;
    url: string;
  };
}

// ============================================================================
// Vote Types
// ============================================================================

/**
 * Roll call vote
 */
export interface Vote {
  congress: number;
  chamber: string;
  rollNumber: number;
  sessionNumber: number;
  voteDate: string;
  voteQuestion: string;
  voteType: string;
  voteResult: string;
  voteTitle?: string;
  bill?: {
    congress: number;
    type: string;
    number: string;
    title?: string;
  };
  amendment?: {
    congress: number;
    number: string;
    purpose?: string;
  };
  totals?: {
    yea: number;
    nay: number;
    present: number;
    notVoting: number;
  };
  members?: VoteMember[];
  updateDate: string;
  url?: string;
}

/**
 * Member vote record
 */
export interface VoteMember {
  bioguideId: string;
  name: string;
  party: string;
  state: string;
  vote: 'Yea' | 'Nay' | 'Present' | 'Not Voting';
}

// ============================================================================
// Search and Filter Types
// ============================================================================

/**
 * Bill search parameters
 */
export interface BillSearchParams {
  congress?: CongressNumber;
  billType?: BillType;
  query?: string;
  fromDateTime?: string;
  toDateTime?: string;
  sort?: 'updateDate' | 'latestAction';
  limit?: number;
  offset?: number;
}

/**
 * Member search parameters
 */
export interface MemberSearchParams {
  congress?: CongressNumber;
  state?: string;
  district?: number;
  party?: string;
  chamber?: Chamber;
  currentMember?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Vote search parameters
 */
export interface VoteSearchParams {
  congress?: CongressNumber;
  chamber?: Chamber;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Bills list response
 */
export interface BillsResponse {
  bills: Bill[];
  pagination: {
    count: number;
    next?: string;
  };
}

/**
 * Members list response
 */
export interface MembersResponse {
  members: Member[];
  pagination: {
    count: number;
    next?: string;
  };
}

/**
 * Votes list response
 */
export interface VotesResponse {
  votes: Vote[];
  pagination: {
    count: number;
    next?: string;
  };
}

/**
 * Committees list response
 */
export interface CommitteesResponse {
  committees: Committee[];
  pagination: {
    count: number;
    next?: string;
  };
}
