# Product Requirements Document (PRD)
# Hakivo Legislative Intelligence Suite

**Version:** 1.0
**Date:** December 23, 2025
**Author:** Tarik Moody
**Status:** Draft

---

## Executive Summary

Hakivo will expand from personalized daily briefings to a comprehensive legislative intelligence platform. This suite adds five major capabilities: Budget & Appropriations tracking, Bill Text Comparison, Congressional Documents Library, Session Calendars, and Hearing Transcripts—all built on Next.js without Raindrop dependencies.

**Goal:** Deliver enterprise-grade legislative intelligence features for free, democratizing access to tools currently only available to well-funded lobbyists and organizations.

---

## Problem Statement

### Current State
- Enterprise tools (Quorum, FiscalNote) cost $20,000-$100,000+/year
- Congress.gov has data but terrible UX and no analysis tools
- Citizens can't easily track where their tax dollars go
- Bill changes between versions are hidden in dense legal text
- No way to compare similar legislation across states
- Hearing transcripts are scattered across committee websites

### Opportunity
- Public data exists—it just needs better presentation
- AI can now summarize and explain complex documents
- Modern web tech enables rich visualizations
- Mobile-first design can reach users where they are
- Hakivo already has user base interested in civic engagement

---

## Goals & Success Metrics

### Business Goals
| Goal | Metric | Target |
|------|--------|--------|
| User growth | Monthly Active Users | 2x in 6 months |
| Engagement | Features used per session | 3+ |
| Retention | 30-day retention | 40% |
| Press coverage | Media mentions | 5+ publications |

### User Goals
| Goal | Metric | Target |
|------|--------|--------|
| Find budget info | Time to answer | < 30 seconds |
| Compare bills | Comparison accuracy | 95%+ |
| Track hearings | Calendar completeness | 98%+ |
| Read transcripts | Search response time | < 2 seconds |

---

## User Personas

### 1. The Engaged Citizen (Primary)
- **Who:** Voter who wants to understand government
- **Needs:** Simple explanations, personalized to their interests
- **Pain:** Current tools are too complex or too expensive
- **Value:** "I finally understand where my tax dollars go"

### 2. The Policy Advocate (Secondary)
- **Who:** Works for nonprofit, advocacy org, or campaign
- **Needs:** Track specific bills, compare across states, find reports
- **Pain:** Can't afford enterprise tools, wastes time on manual research
- **Value:** "I can do my job without a $50K software budget"

### 3. The Journalist (Secondary)
- **Who:** Reporter covering politics or policy
- **Needs:** Quick access to transcripts, bill text, vote records
- **Pain:** Deadline pressure, scattered sources, can't afford Bloomberg
- **Value:** "I found the quote I needed in minutes, not hours"

### 4. The Researcher (Tertiary)
- **Who:** Academic, think tank analyst, student
- **Needs:** Historical data, cross-state comparison, exportable data
- **Pain:** Data locked in PDFs, no API access
- **Value:** "I can actually do quantitative analysis now"

---

## Feature Requirements

## Feature 1: Budget & Appropriations Tracker

### 1.1 Appropriations Pipeline View
**Priority:** P0 (MVP)

**Description:**
Visual tracker showing the 12 annual appropriations bills moving through Congress. Displays House and Senate tracks with subcommittee, committee, and floor stages.

**User Story:**
> As a citizen, I want to see where each appropriations bill is in the process so I know when funding decisions are being made for issues I care about.

**Requirements:**
- [ ] Display all 12 appropriations subcommittees
- [ ] Show House and Senate tracks side-by-side
- [ ] Status indicators: Not started → Subcommittee → Committee → Floor → Passed
- [ ] Click to see bill details, amounts, and votes
- [ ] Filter by policy area (Defense, Health, Education, etc.)
- [ ] Compare requested vs. appropriated amounts
- [ ] Link to full bill text

**Acceptance Criteria:**
- Data updates within 24 hours of congressional action
- Mobile-responsive layout
- Accessible to screen readers

### 1.2 Budget Explorer
**Priority:** P1

**Description:**
Interactive visualization of federal spending by category, agency, and program.

**User Story:**
> As a taxpayer, I want to explore the federal budget visually so I can understand government priorities.

**Requirements:**
- [ ] Treemap showing budget by department/agency
- [ ] Drill-down from department → agency → program
- [ ] Year-over-year comparison
- [ ] Filter by discretionary vs. mandatory spending
- [ ] Show spending by state/district
- [ ] Export data as CSV

### 1.3 CBO Cost Estimates
**Priority:** P1

**Description:**
Display Congressional Budget Office cost estimates linked to bills.

**Requirements:**
- [ ] Pull CBO estimates when available
- [ ] Display 10-year cost projections
- [ ] Compare estimate vs. actual appropriation
- [ ] AI summary of key findings

---

## Feature 2: Bill Text Comparison

### 2.1 Version Comparison
**Priority:** P0 (MVP)

**Description:**
Side-by-side diff view showing what changed between bill versions.

**User Story:**
> As a policy advocate, I want to see exactly what changed in a bill amendment so I can understand its impact.

**Requirements:**
- [ ] Fetch all versions of a bill (IH, RH, EH, ENR, etc.)
- [ ] Side-by-side diff view with highlighted changes
- [ ] Section-by-section navigation
- [ ] AI summary of significant changes
- [ ] Share link to specific comparison
- [ ] Download comparison as PDF

**Acceptance Criteria:**
- Diff renders correctly for bills up to 500 pages
- Changes highlighted: additions (green), deletions (red), modifications (yellow)
- Page loads in < 3 seconds

### 2.2 Cross-State Comparison
**Priority:** P1

**Description:**
Find and compare similar legislation across states.

**User Story:**
> As a researcher, I want to compare how different states approach the same policy issue.

**Requirements:**
- [ ] Search for similar bills by topic/keywords
- [ ] US map showing which states have similar legislation
- [ ] Table comparing key provisions
- [ ] Status tracking (enacted, pending, failed)
- [ ] Link to original state legislation

### 2.3 Custom Text Comparison
**Priority:** P2

**Description:**
"Add your own text" feature to compare any two documents.

**Requirements:**
- [ ] Upload or paste text
- [ ] Compare against any bill version
- [ ] Highlight similarities and differences
- [ ] Useful for model legislation analysis

---

## Feature 3: Congressional Documents Library

### 3.1 CRS Reports
**Priority:** P0 (MVP)

**Description:**
Searchable database of Congressional Research Service reports.

**User Story:**
> As a journalist, I want to find nonpartisan expert analysis on policy issues.

**Requirements:**
- [ ] Full-text search across all CRS reports
- [ ] Filter by topic, date, author
- [ ] Preview with summary
- [ ] Link related bills
- [ ] Download PDF
- [ ] "New reports" feed

**Data Source:** EveryCRSReport.com + direct from CRS when available

### 3.2 Committee Reports
**Priority:** P1

**Requirements:**
- [ ] House and Senate committee reports
- [ ] Link to related bills
- [ ] Search within reports

### 3.3 Press Releases
**Priority:** P2

**Requirements:**
- [ ] Aggregate from member and committee offices
- [ ] Filter by member, committee, topic
- [ ] Search and alerts

---

## Feature 4: Session Calendars

### 4.1 Congressional Calendar
**Priority:** P1

**Description:**
Unified calendar of House/Senate sessions, hearings, and markups.

**User Story:**
> As an advocate, I want to know when hearings are happening on issues I care about so I can watch or attend.

**Requirements:**
- [ ] Monthly/weekly/daily views
- [ ] Filter by chamber, committee, topic
- [ ] "Happening Now" indicator
- [ ] Subscribe to calendar (iCal export)
- [ ] Link to video stream when available
- [ ] Mobile push notifications (future)

### 4.2 Committee Schedule
**Priority:** P1

**Requirements:**
- [ ] All committee and subcommittee hearings
- [ ] Witness lists when available
- [ ] Related bills
- [ ] Location and time with timezone support

---

## Feature 5: Transcripts

### 5.1 Hearing Transcripts
**Priority:** P2

**Description:**
Searchable, timestamped transcripts of congressional hearings.

**User Story:**
> As a journalist, I want to search hearing transcripts to find specific quotes and statements.

**Requirements:**
- [ ] Full-text search across all transcripts
- [ ] Filter by committee, date, speaker
- [ ] Timestamp links (if video available)
- [ ] Speaker identification
- [ ] Export quotes with citation
- [ ] "Jump to" navigation

### 5.2 Floor Proceedings
**Priority:** P3

**Requirements:**
- [ ] Congressional Record integration
- [ ] Speeches and debates
- [ ] Vote context

---

## Technical Requirements

### Performance
- Page load: < 2 seconds on 3G
- Search results: < 1 second
- Diff rendering: < 3 seconds for 100-page bill

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader compatible
- Keyboard navigation
- Color-blind friendly visualizations

### Data Freshness
| Data Type | Update Frequency |
|-----------|------------------|
| Appropriations status | Daily |
| Bill versions | Within 4 hours |
| CRS Reports | Daily |
| Calendar events | Hourly |
| Transcripts | Within 24 hours |

### Security
- No PII stored beyond user accounts
- API rate limiting
- Input sanitization

---

## Non-Requirements (Out of Scope)

- Lobbying/advocacy workflow tools
- Direct legislator contact integration
- Paid tiers (for now—everything free)
- Native mobile apps (PWA first)
- International legislation

---

## Dependencies

### External APIs
- Congress.gov API (rate limited)
- GovInfo API
- USASpending.gov API
- OpenStates API (state data)

### Internal Systems
- Existing Hakivo user auth
- Existing bill database
- Daily brief personalization engine

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Congress.gov API rate limits | High | Medium | Cache aggressively, batch requests |
| CRS scraping blocked | Medium | Low | Multiple source fallbacks |
| AI costs exceed budget | High | Medium | Selective AI use, caching |
| Data accuracy issues | High | Medium | Multiple source verification |
| Scope creep | High | High | Strict MVP definition |

---

## Timeline

### Phase 1: MVP (Weeks 1-4)
- Appropriations pipeline tracker
- Bill version comparison
- CRS reports browser

### Phase 2: Enhanced (Weeks 5-8)
- Calendar integration
- State bill comparison
- CBO estimates

### Phase 3: Advanced (Weeks 9-12)
- Transcripts
- Advanced AI features
- Personalization

---

## Appendix

### Glossary
- **IH**: Introduced in House
- **RH**: Reported in House
- **EH**: Engrossed in House (passed)
- **ENR**: Enrolled (passed both chambers)
- **CRS**: Congressional Research Service
- **CBO**: Congressional Budget Office
- **GPO**: Government Publishing Office

### References
- [Congress.gov API Documentation](https://api.congress.gov/)
- [GovInfo API](https://api.govinfo.gov/)
- [USASpending.gov API](https://api.usaspending.gov/)
- [OpenStates API](https://v3.openstates.org/)
- [EveryCRSReport.com](https://www.everycrsreport.com/)

> Note: ProPublica Congress API is no longer available as a data source.
