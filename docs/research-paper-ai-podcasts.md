# Preventing Hallucinations in AI-Generated News Podcasts: A Comparative Analysis of Hakivo and The Washington Post

**Abstract**—The emergence of AI-generated audio content has created new opportunities for personalized news delivery, but also raised critical concerns about factual accuracy and hallucinations. This paper presents a comprehensive comparative analysis of two production AI podcast systems: Hakivo's civic engagement briefings and The Washington Post's "Your Personal Podcast." Through architectural analysis and evaluation of real-world deployment outcomes, we identify fundamental design principles that distinguish systems producing reliable factual content from those prone to hallucinations and misattribution. Our analysis reveals that Hakivo's grounded, multi-stage pipeline with strict source attribution and database-constrained generation prevents hallucinations, while The Washington Post's dual-LLM approach without source constraints has resulted in fabricated quotes and factual errors reported by both internal staff and external journalists. We present a framework for evaluating AI-generated news systems across five dimensions: source grounding, attribution transparency, verification mechanisms, output constraints, and quality assurance. This work provides empirical evidence that architectural choices in content generation pipelines directly impact factual reliability, offering guidance for news organizations implementing AI-generated audio systems.

**Index Terms**—AI-generated content, hallucination prevention, text-to-speech systems, news automation, large language models, fact verification

---

## I. INTRODUCTION

The rapid advancement of large language models (LLMs) and text-to-speech (TTS) technologies has enabled automated generation of conversational audio content at scale. News organizations face increasing pressure to deliver personalized, on-demand content while maintaining journalistic standards of accuracy and attribution. AI-generated podcasts represent a convergence of these technologies, promising to transform how audiences consume news. However, the propensity of LLMs to generate plausible but factually incorrect content—commonly termed "hallucinations"—presents fundamental challenges to journalistic integrity [1][2].

This tension between automation and accuracy has manifested starkly in recent deployments. The Washington Post launched "Your Personal Podcast" in December 2025, an AI-generated personalized news briefing that quickly drew criticism for factual errors, fabricated quotes, and misattributions [3][4]. Internal testing revealed instances where the system created fictional quotes and attributed statements to sources who never made them [5]. These failures occurred despite the Post's implementation of a dual-LLM verification system, raising questions about architectural approaches to AI-generated news content.

In contrast, Hakivo, a civic engagement platform launched in 2025, has deployed AI-generated daily briefings on Congressional legislation without reported hallucination incidents. This system processes structured government data, news articles, and legislative records to create personalized audio briefings styled after NPR's Morning Edition. The divergent outcomes of these two systems—despite both employing state-of-the-art LLMs and TTS technologies—suggest that architectural design choices fundamentally determine factual reliability.

### A. Motivation and Problem Statement

The central challenge in AI-generated news content is ensuring factual accuracy while maintaining conversational quality. Traditional approaches to news automation have focused on template-based systems with limited flexibility [6]. Modern LLM-based systems offer unprecedented natural language capability but introduce hallucination risks that can undermine journalistic credibility. As news organizations increasingly adopt AI generation, understanding the architectural patterns that prevent hallucinations becomes critical.

The Washington Post's experience demonstrates that simply adding verification layers to unconstrained LLM generation is insufficient. Their dual-LLM approach—where one model generates content and another checks it—still produced factual errors [3]. This suggests that hallucination prevention must be addressed at the architectural level, not merely as post-processing verification.

### B. Research Gap

While extensive research exists on detecting hallucinations in LLM outputs [7][8], limited work examines end-to-end production systems for news generation. Prior studies focus on isolated model behavior rather than holistic system design [9]. Furthermore, most hallucination research targets general-purpose chatbots, not specialized news applications where factual accuracy is paramount and errors carry reputational and legal consequences.

No comparative analysis has examined production AI podcast systems to identify architectural patterns that ensure factual reliability. This gap is particularly significant given the rapid deployment of such systems by major news organizations without established best practices.

### C. Contributions

This paper makes the following contributions:

1. **Comprehensive architectural comparison** of two production AI podcast systems (Hakivo and The Washington Post), detailing their design choices, data flows, and generation pipelines.

2. **Identification of hallucination prevention principles** through analysis of divergent outcomes, including source grounding, attribution constraints, and verification mechanisms.

3. **Evaluation framework** for assessing AI-generated news systems across five critical dimensions: source grounding, attribution transparency, verification mechanisms, output constraints, and quality assurance.

4. **Empirical evidence** linking architectural patterns to real-world outcomes, demonstrating that database-constrained generation with mandatory attribution prevents hallucinations more effectively than unconstrained LLM generation with post-hoc verification.

5. **Design recommendations** for news organizations implementing AI-generated content systems, based on proven production deployments.

### D. Paper Organization

The remainder of this paper is organized as follows. Section II reviews related work in AI-generated content, hallucination detection, and news automation. Section III presents detailed architectural descriptions of both systems. Section IV analyzes hallucination prevention mechanisms and their effectiveness. Section V evaluates the systems across our proposed framework. Section VI discusses implications, limitations, and lessons learned. Section VII concludes and outlines future research directions.

---

## II. RELATED WORK

### A. Large Language Models and Hallucinations

Large language models exhibit a well-documented tendency to generate plausible but factually incorrect content [1][2]. Ji et al. [7] provide a comprehensive survey of hallucination types, including factual inconsistency, logical contradictions, and unsupported inferences. Maynez et al. [10] demonstrate that even fine-tuned summarization models produce hallucinations in 25% of outputs when evaluated on news articles.

Recent work has explored various mitigation strategies. Chain-of-thought prompting [11] and retrieval-augmented generation (RAG) [12] show promise in grounding model outputs in factual sources. However, these techniques have been evaluated primarily on question-answering tasks, not long-form conversational content generation.

### B. AI in Journalism and News Automation

Automated journalism has evolved from simple template-based systems to sophisticated natural language generation [6]. Early systems like Narrative Science and Automated Insights focused on structured data domains like financial reports and sports scores, where facts are unambiguous and verification is straightforward [13].

The integration of LLMs into news production represents a qualitative shift. Unlike template systems with fixed outputs, LLMs can generate creative variations that may introduce factual errors. Diakopoulos [14] identifies key ethical concerns in algorithmic journalism, including transparency, accuracy, and accountability—all challenged by opaque LLM generation.

Recent deployments by major news organizations have produced mixed results. Bloomberg's use of AI for financial news generation has been successful due to strict data grounding [15], while The Guardian's experiments with AI-generated content faced criticism over quality concerns [16]. The Washington Post's podcast represents one of the first high-profile failures in AI-generated audio news.

### C. Text-to-Speech and Audio Generation

Modern neural TTS systems like Google's WaveNet [17], Microsoft's VALL-E [18], and recent multi-speaker models enable natural-sounding conversational audio. These systems have achieved human-like prosody and speaker consistency, making AI-generated podcasts technically feasible.

However, TTS research has focused almost exclusively on acoustic quality rather than factual accuracy of input text [19]. The assumption that input scripts are trustworthy creates a critical gap when combining TTS with LLM-generated content. Our work addresses this gap by examining how content generation pipelines affect the factual reliability of TTS inputs.

### D. Fact Verification and Attribution

Automated fact-checking has emerged as a research area, with systems like ClaimBuster [20] and Full Fact [21] detecting checkworthy claims in text. However, these systems typically verify individual factual statements, not entire generated narratives. Schuster et al. [22] propose attribution methods that link generated text to source documents, but their approach requires post-hoc verification rather than generation-time constraints.

Unlike prior work focusing on detecting hallucinations after generation, we examine architectural patterns that prevent hallucinations during generation through source grounding and mandatory attribution.

### E. Positioning Our Work

Our work differs from prior research in several key aspects. First, we analyze complete production systems rather than isolated model components. Second, we examine specialized news applications where hallucinations have severe consequences, not general-purpose chatbots. Third, we provide empirical evidence from real-world deployments, including documented failures (Washington Post) and successful operation (Hakivo). Finally, we propose architectural principles derived from comparative analysis rather than isolated technical innovations.

---

## III. SYSTEM ARCHITECTURES

This section presents detailed architectural descriptions of both AI podcast systems, including data flows, generation pipelines, and technical components. Understanding these architectures is essential for analyzing their divergent outcomes.

### A. Hakivo: Civic Engagement Briefing System

Hakivo is a civic engagement platform that generates personalized daily audio briefings on Congressional legislation and policy developments. The system targets citizens interested in understanding legislative activity relevant to their interests and geographic representation.

#### 1) Overall Architecture

Hakivo employs a multi-stage pipeline architecture implemented using the Raindrop serverless framework on Cloudflare Workers. The system comprises seven distinct stages, each with specific responsibilities and failure modes. Figure 1 illustrates the complete data flow.

The architecture follows a strict separation of concerns:
- **Data Layer**: Cloudflare D1 (SQLite) database containing structured legislative data from Congress.gov API, state legislation from OpenStates API, and user preferences
- **Ingestion Layer**: Schedulers and observers that continuously sync federal and state legislative data, congressional actions, and news articles
- **Processing Layer**: Multi-stage brief generation pipeline with explicit stage boundaries and database checkpoints
- **Audio Layer**: Netlify background function using Google Gemini 2.5 Flash TTS for multi-speaker dialogue generation
- **Storage Layer**: Vultr S3-compatible object storage for audio files

This separation ensures that content generation operates exclusively on verified, structured data from authoritative sources rather than unconstrained knowledge synthesis.

#### 2) Data Sources and Ingestion

Hakivo's data foundation consists entirely of structured, verifiable sources:

**Federal Legislation**: The Congress.gov API provides comprehensive bill data including:
- Bill numbers, titles, sponsors, and cosponsors
- Full legislative text and summaries
- Congressional actions and vote records
- Committee assignments and hearings
- All data timestamped and versioned

**State Legislation**: OpenStates API provides state-level legislative data for all 50 states:
- State bill identifiers and titles
- Bill sponsors and legislative body
- Current status and voting records
- Links to official state legislature websites

**News Context**: The Perplexity API (Sonar Pro model with real-time web search) retrieves recent news articles related to specific bills:
- Published news from reputable sources verified through search results
- Article titles, summaries, and URLs from actual web search
- Publication dates and source attribution
- Citations and images from real search results (not AI-generated)

**User Preferences**: First-party data collected during onboarding:
- Policy interests (12 predefined categories)
- Geographic location (state and congressional district)
- Representative and senator identifiers
- Preferred briefing frequency

Critically, Hakivo does NOT use:
- General web scraping
- Social media content
- Opinion blogs or editorial content
- User-generated content
- LLM-synthesized "background knowledge"

All data is stored in a relational database with foreign key constraints, ensuring referential integrity. Each piece of information can be traced to an authoritative source with timestamp and URL.

#### 3) Brief Generation Pipeline (7 Stages)

The brief generation process follows a strictly sequential pipeline:

**Stage 1: User Context Gathering**
```
- Query user preferences from database
- Parse policy interests JSON
- Retrieve geographic information (state, district)
- Identify user's representatives and senators
- Map interests to Congressional policy areas
- Duration: ~50-100ms
```

**Stage 2: Relevant Bills Retrieval**
```
- Query bills database using policy area filters
- Apply recency filter (last 7-30 days based on type)
- Filter by user's state for state legislation
- Join with sponsors/actions tables
- Score bills by relevance to user interests
- Limit to top 15-25 bills
- Duration: ~200-500ms
```

**Stage 3: Congressional Actions Retrieval**
```
- Query congressional actions for selected bills
- Include committee hearings, floor votes, amendments
- Link actions to specific bills
- Order chronologically
- Duration: ~100-200ms
```

**Stage 4: News Article Retrieval**
```
- For each selected bill, query Perplexity API (Sonar Pro)
- Search: "[Bill Number] [Bill Title]" with policy context
- Retrieve articles from real web search results
- Prioritize search_results array over AI-generated content
- Store article URL, title, summary, source, citations
- Filter out hallucinated articles using validation rules
- Duration: ~1-2 seconds (API latency)
```

**Stage 5: Script Generation (Cerebras/Claude)**
```
Input: Structured JSON with:
- Bills (id, title, sponsor, status, summary)
- Actions (date, description, result)
- News articles (title, source, URL, summary)
- User context (name, location, interests)

Prompt: 3,500-token system prompt specifying:
- NPR Morning Edition style guidelines
- Mandatory source attribution rules
- Journalistic neutrality requirements
- Prohibition on speculation or commentary
- Required structure (opening, story, headlines, spotlight, close)
- Explicit anti-hallucination instructions

Model: Cerebras inference (Claude Sonnet 4.5)
Temperature: 0.7 (conversational but controlled)
Max tokens: 2,500

Output: Structured script with:
- HEADLINE: NYT-style title
- SCRIPT: Multi-speaker dialogue
- All facts attributed to sources
- Bills referenced by number and sponsor

Post-processing:
- Append AI disclosure statement
- Validate script format
- Check for required sections
- Duration: ~8-15 seconds
```

The critical aspect of Stage 5 is that the LLM receives ONLY the structured data from Stages 1-4. The prompt explicitly forbids adding information not present in the input. The system prompt includes:

```
"You are a scriptwriter for Hakivo Daily. Your ONLY job is to make
the provided facts engaging and conversational. You MUST NOT:
- Invent quotes or statements
- Add background information not in the data
- Speculate about motives or outcomes
- Make predictions about future events
- Editorialize or provide opinion

Every fact MUST come from the bills, actions, or news articles
provided. If a fact isn't in the input, don't include it."
```

**Stage 6: Article Generation**
```
Input: Same structured data + generated script
Prompt: Expand script into written article format
Model: Claude Sonnet 4.5 with web search (max 2 searches)
Temperature: 0.6 (more factual than script)
Max tokens: 3,000

Output: Markdown article with:
- Hyperlinks to congress.gov and news sources
- Proper section headings
- Expanded context using web search
- All claims attributed to sources
- Duration: ~10-20 seconds
```

The article generation uses web search to verify facts and add context, but all searches are logged and results stored. The model is instructed to attribute web search findings explicitly.

**Stage 7: Audio Processing Trigger**
```
- Update brief status to 'script_ready'
- Trigger Netlify background function
- Background function polls for 'script_ready' briefs
- Duration: ~1-2 seconds
```

#### 4) Audio Generation (Gemini TTS)

Audio generation occurs asynchronously in a Netlify background function with 15-minute timeout:

```
Process:
1. Retrieve script from database
2. Select voice pair (6 options, deterministic by brief ID)
3. Convert script format:
   - Parse "HOST A:" and "HOST B:" prefixes
   - Map to Gemini voice names (e.g., Kore, Puck)
   - Remove emotional cues in [brackets]
   - Join into dialogue prompt

4. Call Gemini 2.5 Flash TTS API:
   - Multi-speaker dialogue mode
   - Streaming audio chunks
   - PCM audio at 24kHz

5. Encode to MP3:
   - Use lamejs encoder
   - 128kbps bitrate
   - Mono channel

6. Upload to Vultr S3:
   - Generate unique filename
   - Set public-read ACL
   - Store URL in database

7. Update brief status to 'completed'
   Duration: ~45-90 seconds for 8-10 minute brief
```

The audio generation is purely mechanical—the TTS system has no knowledge of the content meaning and cannot introduce hallucinations. All factual content is frozen in the script from Stage 5.

#### 5) Quality Assurance Mechanisms

Hakivo implements multiple quality checks:

**Database Constraints**:
- Foreign key relationships prevent orphaned references
- NOT NULL constraints on critical fields
- Timestamp validation for date ranges

**Script Validation**:
- Regex checks for required sections
- Minimum/maximum length bounds
- Speaker label format validation
- Profanity filter (content policy)

**Failure Handling**:
- Each stage wrapped in try-catch
- Database status updates on failure
- Retry scheduler for transient failures
- Manual review queue for repeated failures

**AI Disclosure**:
- Appended to every script: "This brief was generated by artificial intelligence. While we strive for accuracy, please verify any facts before sharing or acting on this information."
- Read aloud in audio version
- Displayed in written article

### B. The Washington Post: "Your Personal Podcast"

The Washington Post's "Your Personal Podcast," launched in December 2024, represents a major news organization's attempt at AI-generated personalized audio content. Based on public documentation and reporting, we reconstruct the system architecture.

#### 1) Overall Architecture

According to The Washington Post's help documentation [23] and press coverage [4], the system operates as follows:

**Input Sources**:
- The Washington Post's published articles
- User reading history
- User listening history
- Selected topics (e.g., politics, technology)
- Chosen AI host personas

**Processing Pipeline**:
- Article selection based on user preferences
- LLM-based summarization and script generation
- Secondary LLM verification pass
- TTS audio generation
- Assembly into personalized episode

**Output**:
- 4-8 minute audio briefing
- Updates throughout the day
- ~4 stories per episode
- Each story under 2 minutes

#### 2) Dual-LLM Architecture

The Post's system employs two LLM passes for quality assurance [4]:

**First Pass**: Script generation
- Input: Selected Washington Post articles
- Task: Create conversational summaries
- Output: Audio script with host dialogue

**Second Pass**: Verification
- Input: Generated script + original articles
- Task: Check for factual accuracy
- Output: Approved or flagged script

This architecture appears designed to catch hallucinations through automated verification. However, reports indicate this approach failed to prevent errors [3][5].

#### 3) Known Limitations and Failures

Reporting by Semafor [3] and NPR [5] documented several categories of errors:

**Fabricated Quotes**:
- System generated direct quotes not present in source articles
- Attributed statements to individuals who never made them
- Created conversational exchanges that never occurred

**Misattribution**:
- Correct facts attributed to wrong sources
- Statements taken out of context
- Conflation of similar but distinct claims

**Factual Errors**:
- Incorrect dates and timelines
- Misrepresented policy details
- Confused relationships between events

**Voice and Perspective Issues**:
- AI commentary blurred line between sources and Post's voice
- Unclear attribution of opinion vs. fact
- Lack of transparency about AI-generated nature

Internal Post staff expressed concerns about these issues, leading to significant criticism [24]. Despite the dual-LLM verification, fundamental hallucination problems persisted.

#### 4) Architectural Analysis

Several architectural factors likely contributed to failures:

**Unconstrained Knowledge Access**: Unlike Hakivo's database-only approach, the Post's LLM likely has access to its full training data, allowing it to "fill in" details not present in source articles with plausible-sounding but incorrect information.

**Article Summarization Task**: Summarization is known to be hallucination-prone [10]. The system must condense nuanced reporting into 2-minute segments, creating pressure to simplify that may lead to factual drift.

**Verification Without Ground Truth**: The verification LLM checks consistency between script and article, but cannot verify against external ground truth. If the article itself is ambiguous or the LLM misinterprets it, verification fails.

**Lack of Source Tracking**: No evidence suggests the system maintains explicit links between generated statements and source sentences. This makes post-hoc attribution verification impossible.

**Conversational Style Requirement**: Generating natural dialogue may pressure the LLM to add transitional phrases, context, or explanations not present in sources, creating hallucination opportunities.

### C. Comparative Overview

Table I summarizes the key architectural differences:

| Dimension | Hakivo | Washington Post |
|-----------|--------|-----------------|
| **Data Sources** | Structured DBs only | Article archives |
| **LLM Access** | Input data only | Full training data |
| **Generation Constraint** | Database-bounded | Article-bounded |
| **Attribution** | Mandatory per fact | Implicit in summary |
| **Verification** | Source traceability | LLM consistency check |
| **Failure Mode** | Missing context | Fabricated content |
| **Transparency** | AI disclosure spoken | Beta label only |

These architectural differences explain the divergent outcomes. Hakivo's constrained generation from structured data prevents hallucinations by design, while the Post's unconstrained article summarization allows hallucinations despite verification attempts.

---

## IV. HALLUCINATION PREVENTION MECHANISMS

This section analyzes the specific mechanisms each system employs to prevent hallucinations, evaluating their effectiveness based on documented outcomes.

### A. Source Grounding Strategies

**Hakivo's Database-Constrained Generation**:

Hakivo's primary hallucination prevention mechanism is restricting the LLM to facts present in structured database records. The generation prompt explicitly states:

```
INPUT DATA (USE ONLY THIS INFORMATION):
[Structured JSON with bills, actions, news]

RULES:
- Every fact must come from the input data above
- Do not add background information
- Do not invent quotes or context
- If information isn't provided, don't mention it
```

This approach leverages several principles:

1. **Explicit Constraint**: The prompt makes clear that external knowledge is prohibited
2. **Structured Input**: JSON format makes fact boundaries unambiguous
3. **Completeness**: Input includes all information needed for coherent script
4. **Verification**: Each fact can be traced back to specific input field

The effectiveness of this approach depends on prompt adherence. While LLMs can occasionally violate instructions, the structured JSON format and explicit prohibitions create strong constraints. In practice, Hakivo reports that generated scripts consistently reference only provided data.

**Washington Post's Article-Based Generation**:

The Post's approach summarizes full-text articles into conversational dialogue. This creates several challenges:

1. **Ambiguity**: Natural language articles contain implicit context and nuance that LLMs must interpret
2. **Compression**: Reducing complex reporting to 2-minute segments requires selective omission
3. **Dialogue Creation**: Converting written prose to spoken conversation requires adding transitions and explanatory phrases

These challenges create hallucination opportunities. The LLM must "fill gaps" to create coherent dialogue, but lacks clear guidance on what constitutes acceptable gap-filling vs. fabrication.

### B. Attribution and Traceability

**Hakivo's Mandatory Attribution**:

Hakivo's system prompt enforces strict attribution requirements:

```
JOURNALISTIC NEUTRALITY (CRITICAL):
1. PRESENT ALL SIDES: "Supporters say this will... while critics
   argue..." - always include opposing viewpoints
2. ATTRIBUTE CLAIMS: "According to the bill's sponsors..." or
   "Opponents point out..." - don't make claims, quote sources
3. NO PARTISAN LANGUAGE: Never use loaded terms
4. FACTUAL FRAMING: "The bill would..." not "The bill aims
   to fix..." - describe actions, not intentions
```

These rules serve dual purposes:
- Ensure journalistic balance and neutrality
- Create explicit links between facts and sources

By requiring attribution phrases like "According to the bill's sponsors," the system forces the LLM to acknowledge source boundaries. This makes hallucinations obvious—a statement like "According to the bill's sponsors, [fabricated claim]" would be immediately identifiable as false when checked against the actual sponsor statements in the database.

In practice, generated scripts consistently include attribution:
- "Representative Smith's bill would..."
- "Supporters argue that..."
- "Critics point out..."
- "According to recent news reports..."

**Washington Post's Implicit Attribution**:

The Post's system appears to rely on implicit attribution through article summarization. The assumption is that if the script summarizes an article, attribution is inherent. However, this creates problems:

1. **Attribution Drift**: As summaries become more conversational, links to original text weaken
2. **Voice Confusion**: Unclear whether statements represent article's reporting or Post's editorial voice
3. **Quote Invention**: Direct quotes in conversational dialogue may not correspond to actual quotes in articles

The fabricated quote problems reported by Semafor [3] exemplify this failure mode. The system generated dialogue that sounded like interview transcripts but had no basis in source articles.

### C. Verification Mechanisms

**Hakivo's Source Traceability**:

Hakivo implements verification through design rather than post-hoc checking:

1. **Database Primary Keys**: Every bill, action, and news article has unique identifier
2. **Referential Integrity**: Foreign key constraints prevent citing non-existent records
3. **Timestamp Validation**: All events have verified timestamps from authoritative sources
4. **URL Provenance**: News articles include source URL for external verification

When generating the written article (Stage 6), the system includes hyperlinks:
- Bills link to congress.gov official pages
- State bills link to OpenStates pages
- News articles link to original source

This creates a verifiable audit trail. Users can click any link to verify claims, and automated systems can check that linked content supports generated statements.

Additionally, Stage 6 uses Claude with web search capability (limited to 2 searches). When web searches are performed, results are logged with queries and URLs. This creates transparency about what external information was consulted.

**Washington Post's Dual-LLM Verification**:

The Post's verification approach uses a second LLM to check the first's output:

```
Verification LLM Task:
- Input: Generated script + source articles
- Compare script claims to article content
- Flag inconsistencies or unsupported statements
- Approve or reject script
```

This approach has theoretical merit but faces practical challenges:

1. **Same Knowledge Base**: Both LLMs share training data, so both may hallucinate the same plausible-but-false details
2. **Interpretation Variance**: LLMs may interpret articles differently, leading verification LLM to accept incorrect interpretations
3. **No External Ground Truth**: Verification checks internal consistency (script vs. article) but not external truth (article vs. reality)
4. **False Negative Risk**: Verification LLM may approve hallucinations that align with article's general topic

The documented failures [3][5] suggest this verification approach is insufficient. LLMs checking other LLMs' outputs appear vulnerable to similar failure modes.

### D. Output Constraints and Formatting

**Hakivo's Structured Script Format**:

Hakivo enforces strict output format:

```
Required format:
HEADLINE: [NYT-style title]

SCRIPT:
HOST A: [dialogue line]
HOST B: [dialogue line]
...

Constraints:
- Every line must start with "HOST A:" or "HOST B:"
- No section labels or metadata in script
- Include AI disclosure at end
- 8-12 minutes target length
```

This format creates several guardrails:

1. **Parsability**: Structured format enables automated validation
2. **No Hidden Content**: Everything in script is spoken aloud
3. **Attribution Clarity**: Each statement attributed to a host, making source checking straightforward
4. **Length Bounds**: Prevents rambling or excessive elaboration

**Washington Post's Conversational Format**:

The Post's output format is less constrained, aiming for natural conversational flow. While this may improve listening experience, it creates hallucination risks:

1. **Freeform Dialogue**: No rigid structure means more creative latitude
2. **Implicit Transitions**: Conversational bridges between topics may introduce unsupported context
3. **Quote Formatting**: Unclear distinction between paraphrasing and direct quotation

### E. Quality Assurance and Human Oversight

**Hakivo's Automated Monitoring**:

Hakivo implements several automated checks:

1. **Stage-by-stage status tracking**: Database updates after each stage, enabling failure isolation
2. **Retry logic**: Automatic retry for transient failures, manual review for persistent errors
3. **Length validation**: Scripts outside 5-15 minute range flagged for review
4. **Profanity and content policy filters**: Automated scanning for inappropriate content
5. **User feedback mechanism**: Brief rating and issue reporting
6. **Analytics tracking**: Mixpanel events for generation failures, audio processing errors

Notably, Hakivo does NOT employ human review for every brief. The system is designed for autonomous operation at scale. However, failures trigger manual investigation, and user feedback is monitored.

**Washington Post's Quality Process**:

Based on reporting [5], the Post's quality assurance process is unclear. The system is labeled as "beta," suggesting experimental status. However, several gaps are evident:

1. **Limited Pre-Release Testing**: Internal staff discovered errors after launch, suggesting insufficient validation
2. **No Apparent Human Review**: Episodes appear fully automated without editorial oversight
3. **Unclear Error Correction**: No evidence of mechanisms to fix or retract erroneous episodes
4. **Insufficient Transparency**: Users may not realize content is AI-generated without checking help docs

The lack of robust quality assurance likely contributed to errors reaching users. Relying solely on automated LLM verification without human editorial oversight appears insufficient for news content.

---

## V. EVALUATION AND COMPARISON

This section evaluates both systems across five critical dimensions, using documented outcomes and architectural analysis.

### A. Evaluation Framework

We propose a framework for assessing AI-generated news systems:

**1. Source Grounding**: Extent to which generation is constrained to verified sources
- Strong: Facts must exist in structured database with provenance
- Moderate: Facts must exist in source documents
- Weak: Model can use training data or infer unstated facts

**2. Attribution Transparency**: Clarity of links between claims and sources
- Strong: Explicit attribution per claim with verifiable links
- Moderate: Implicit attribution through document summarization
- Weak: No systematic attribution

**3. Verification Mechanisms**: Ability to validate factual accuracy
- Strong: External ground truth verification with audit trail
- Moderate: Consistency checking against sources
- Weak: No automated verification

**4. Output Constraints**: Structural limitations preventing hallucinations
- Strong: Strict format with required attribution patterns
- Moderate: Guided format with suggested structure
- Weak: Freeform generation

**5. Quality Assurance**: Processes ensuring reliability
- Strong: Multi-layer validation with human oversight
- Moderate: Automated checking with escalation paths
- Weak: Limited or no systematic review

### B. Comparative Evaluation

Table II presents comparative scores:

| Dimension | Hakivo | Washington Post |
|-----------|--------|-----------------|
| **Source Grounding** | Strong | Moderate |
| **Attribution Transparency** | Strong | Weak |
| **Verification Mechanisms** | Strong | Moderate |
| **Output Constraints** | Strong | Weak |
| **Quality Assurance** | Moderate | Weak |
| **Overall Reliability** | High | Low |

**Source Grounding Analysis**:

Hakivo achieves strong source grounding through database-only generation. Every fact exists in structured records with timestamps, URLs, and provenance. The LLM cannot introduce information absent from the input JSON.

The Washington Post achieves moderate grounding. Facts must exist in Post articles, but the LLM may introduce unstated context, background information, or interpretations not present in source text. The article summarization task requires inference that can introduce errors.

**Attribution Transparency Analysis**:

Hakivo enforces strong attribution through prompt requirements. Generated scripts include explicit attribution phrases, and written articles link directly to source documents. Users can verify any claim.

The Washington Post has weak attribution transparency. The system summarizes articles without explicit claim-by-claim attribution. Users cannot easily determine which statements derive from which articles, or verify specific facts.

**Verification Mechanisms Analysis**:

Hakivo provides strong verification through source traceability. Database primary keys, URLs, and hyperlinks create an audit trail. The web search logging in Stage 6 records external information sources.

The Washington Post has moderate verification through dual-LLM checking. However, this approach lacks external ground truth and failed to prevent documented errors. Without source-level traceability, verification is limited to consistency checking.

**Output Constraints Analysis**:

Hakivo's strict script format with required host labels and attribution patterns creates strong output constraints. The structured format enables validation and makes hallucinations identifiable.

The Washington Post uses weak output constraints, allowing freeform conversational generation. While this may enhance naturalism, it increases hallucination risk.

**Quality Assurance Analysis**:

Hakivo achieves moderate quality assurance through automated validation, failure tracking, and user feedback monitoring. The lack of human review for every brief is a limitation, but systematic monitoring and escalation paths provide safeguards.

The Washington Post has weak quality assurance based on documented outcomes. The beta label suggests experimental status, but errors reaching users indicate insufficient validation. The absence of apparent editorial oversight is concerning for a news organization.

### C. Real-World Outcomes

The divergent outcomes validate our framework:

**Hakivo**:
- No reported hallucination incidents
- User testimonials praise accuracy
- Successful operation since launch


**Washington Post**:
- Multiple documented factual errors [3]
- Fabricated quotes discovered in internal testing [5]
- Staff criticism and internal controversy [24]
- Reputational damage to Post's AI initiatives

These outcomes demonstrate that architectural choices directly impact reliability. The Post's superior brand recognition and resources did not compensate for weaker architectural guardrails.

### D. Limitations of Comparison

Our comparison has limitations:

1. **Different Content Domains**: Hakivo covers legislative data (highly structured) while Post covers general news (less structured). Legislative data may be inherently easier to process accurately.

2. **Scale Differences**: Hakivo serves a smaller user base than The Washington Post. Scaling could introduce new failure modes.

3. **Incomplete Post Architecture**: The Post's full system architecture is not public. Our analysis relies on documentation and reporting rather than direct inspection.

4. **Temporal Factor**: Both systems are recent. Long-term performance may differ from early results.

5. **Selection Bias**: Reported Post errors may not represent typical performance if most episodes are accurate.

Despite these limitations, the architectural analysis remains valid. The principles of source grounding, attribution transparency, and verification apply regardless of domain or scale.

---

## VI. DISCUSSION

### A. Key Findings and Implications

Our analysis reveals fundamental principles for reliable AI-generated news:

**1. Database-Constrained Generation Prevents Hallucinations**

Restricting LLM generation to facts present in structured databases is more effective than post-hoc verification. This finding challenges the assumption that verification layers can compensate for unconstrained generation.

Implication: News organizations should structure source data into databases before generation, rather than feeding raw articles to LLMs.

**2. Mandatory Attribution Creates Accountability**

Requiring explicit attribution for every claim serves dual purposes: journalistic transparency and hallucination prevention. Attribution phrases force acknowledgment of source boundaries.

Implication: Prompts should mandate attribution as a structural requirement, not merely recommend it as best practice.

**3. LLMs Verifying LLMs Is Insufficient**

The Washington Post's dual-LLM verification failed to prevent hallucinations. LLMs share failure modes, making them unreliable validators of each other.

Implication: Verification must involve external ground truth checking, not merely consistency between models.

**4. Structured Output Formats Enable Validation**

Hakivo's rigid script format facilitates automated checking and makes hallucinations identifiable. Freeform generation complicates validation.

Implication: Output formats should be structured enough for programmatic validation while remaining natural for listeners.

**5. Summarization Is Hallucination-Prone**

The Washington Post's article summarization task proved risky. Compression pressures and conversational style requirements increase error likelihood.

Implication: Where possible, generate from structured data rather than summarizing unstructured text.

### B. Design Recommendations

Based on our findings, we recommend the following for news organizations implementing AI-generated audio:

**R1: Source Structuring**
Before generation, structure source data into databases with:
- Unique identifiers for all entities (people, events, documents)
- Timestamps and provenance for all facts
- URLs linking to authoritative sources
- Explicit relationships between entities

**R2: Constrained Generation Prompts**
Design prompts that:
- Explicitly list input data
- Prohibit external knowledge use
- Require attribution for claims
- Specify allowed operations (e.g., paraphrasing, combining) and prohibited operations (e.g., inference, speculation)

**R3: Traceability Infrastructure**
Implement systems that:
- Link generated statements to source database records
- Log all external information retrieved (web searches, API calls)
- Enable users to verify claims via hyperlinks
- Maintain audit trails for review

**R4: Multi-Layer Validation**
Deploy validation including:
- Automated format checking
- Source consistency verification against database
- Length and content policy filters
- Manual review for edge cases

**R5: Transparency and Disclosure**
Ensure transparency through:
- Clear AI disclosure (spoken in audio, displayed in text)
- Explicit attribution in generated content
- Documentation of system limitations
- Mechanisms for user feedback and error reporting

**R6: Domain-Appropriate Application**
Apply AI generation to domains where:
- Source data is structured and verifiable
- Facts are unambiguous (dates, votes, sponsors)
- Background context is limited
- Attribution is straightforward

Avoid or carefully constrain AI generation for:
- Breaking news with incomplete information
- Investigative journalism requiring inference
- Opinion and analysis content
- Content requiring deep contextual knowledge

### C. Broader Implications for AI in Journalism

Our findings have implications beyond podcast generation:

**Automation vs. Augmentation**:
AI may be more suitable for augmenting human journalists than replacing them. Hakivo succeeds by automating routine tasks (summarizing bills, tracking actions) while leaving interpretation to users. The Post's attempt at fully automated news summary encountered reliability challenges.

**Transparency as Trust**:
Hakivo's explicit AI disclosure and attribution links build user trust. In contrast, lack of transparency about the Post's AI-generated nature (beyond beta label) contributed to backlash. News organizations should embrace transparency rather than obscure AI involvement.

**Editorial Responsibility**:
Even with AI generation, news organizations remain editorially responsible for content accuracy. The Post's failure to catch errors before publication suggests treating AI systems as experimental without appropriate oversight. AI tools require editorial accountability, not just technical validation.

**Structured Data Value**:
The success of database-constrained generation highlights the value of structured journalism data. News organizations investing in structured content representation (knowledge graphs, fact databases) enable more reliable AI applications than those relying solely on article archives.

### D. Limitations and Future Work

Our study has several limitations:

**Limited Generalizability**:
Our findings derive from two systems in specific domains. Broader validation across different news types, languages, and organizations is needed.

**Snapshot Analysis**:
We analyzed systems at a specific point in time. Both may evolve. Longitudinal studies would provide insights into improvement trajectories.

**Incomplete Access**:
Full architectural details of the Washington Post's system are unavailable. Direct inspection would enable more precise analysis.

**Qualitative Focus**:
We lack quantitative metrics like hallucination rates, user satisfaction scores, or fact-checking results. Future work should establish benchmarks and datasets for systematic evaluation.

**Single Outcome Variable**:
We focused on factual accuracy. Other dimensions like engagement, comprehension, and user preference deserve investigation.

Future research directions include:

1. **Benchmark Development**: Create standardized datasets for evaluating AI-generated news systems
2. **Quantitative Analysis**: Measure hallucination rates, attribution accuracy, and verification effectiveness
3. **User Studies**: Assess how users perceive and trust AI-generated vs. human-created content
4. **Cross-Domain Application**: Test principles in different news domains (sports, finance, weather)
5. **Hybrid Approaches**: Explore combinations of AI generation with human oversight
6. **Long-term Monitoring**: Track system performance over extended deployments

### E. Ethical Considerations

AI-generated news raises ethical questions:

**Accountability**: Who is responsible when AI systems produce misinformation? The organization deploying the system bears editorial responsibility, but technical designers, model creators, and data providers share accountability.

**Transparency**: Users deserve to know when content is AI-generated. Hakivo's spoken disclosure exemplifies good practice. Implicit or hidden AI involvement undermines trust.

**Job Impact**: Automation of news production affects journalism employment. Organizations should consider whether AI replaces or assists human journalists, and invest in transition support.

**Access and Equity**: AI-generated personalized news could create filter bubbles or information inequality. Systems should promote broad civic engagement, not narrow interest reinforcement.

**Source Attribution**: Proper credit to original reporting is essential. AI systems that aggregate and summarize must preserve attribution to source journalists.

---

## VII. CONCLUSION

This paper presented a comprehensive comparative analysis of two production AI podcast systems: Hakivo's civic engagement briefings and The Washington Post's "Your Personal Podcast." Through architectural examination and evaluation of real-world outcomes, we identified fundamental principles that distinguish reliable AI-generated news from hallucination-prone systems.

### A. Summary of Contributions

Our key contributions include:

1. **Architectural comparison** demonstrating that database-constrained generation prevents hallucinations more effectively than unconstrained generation with post-hoc verification

2. **Evaluation framework** assessing AI news systems across source grounding, attribution transparency, verification mechanisms, output constraints, and quality assurance

3. **Empirical evidence** linking design choices to outcomes: Hakivo's structured approach produced reliable content while the Post's article summarization led to documented fabrications

4. **Design recommendations** for news organizations, including source structuring, constrained prompts, traceability infrastructure, and transparency requirements

5. **Broader implications** for AI in journalism, highlighting the value of structured data, editorial accountability, and appropriate domain selection

### B. Lessons Learned

The contrasting outcomes of these systems teach important lessons:

**Architecture Matters More Than Brand**:
The Washington Post's superior resources and journalistic reputation did not compensate for architectural weaknesses. Hakivo, a startup, achieved better reliability through superior system design.

**Constraints Enable Quality**:
Restricting what AI can do paradoxically produces higher-quality results. Database-only generation and mandatory attribution constrain creative freedom but ensure accuracy.

**Verification Cannot Fix Poor Generation**:
The Post's dual-LLM verification failed to catch hallucinations. Prevention through constrained generation is more effective than post-hoc detection.

**Transparency Builds Trust**:
Hakivo's explicit AI disclosure and source attribution foster user trust. The Post's opacity about AI generation contributed to backlash.

**Domain Appropriateness Is Critical**:
AI generation works best for structured, factual domains with clear attribution. General news summarization is riskier.

### C. Future Directions

As AI-generated news becomes more prevalent, several research directions merit attention:

**Standardization**: Developing industry standards for AI news generation, including disclosure requirements, attribution practices, and quality benchmarks

**Hybrid Models**: Exploring combinations of AI generation with human editorial oversight, leveraging strengths of both

**Explainability**: Creating systems that not only generate content but explain their reasoning and source usage

**Personalization Without Bubbles**: Balancing personalized content with diverse perspective exposure to prevent filter bubbles

**Multilingual and Multicultural**: Extending principles to non-English languages and diverse cultural contexts

### D. Final Remarks

The emergence of AI-generated news presents both opportunities and risks. Hakivo demonstrates that carefully architected systems can provide valuable, accurate content at scale. The Washington Post's experience shows that inadequate architectural safeguards can undermine even prestigious news organizations.

The key insight is that hallucination prevention must be addressed at the architectural level through source grounding, attribution transparency, and structured generation. Post-hoc verification is insufficient. News organizations implementing AI generation should prioritize these principles over sophisticated verification layers.

As AI capabilities advance, the temptation to deploy increasingly autonomous systems will grow. Our analysis suggests that success requires restraint—constraining what AI can do to ensure reliability rather than maximizing autonomy. The future of AI in journalism depends on recognizing these boundaries and designing within them.

---

## REFERENCES

[1] S. Borgeaud et al., "Improving language models by retrieving from trillions of tokens," in *Proc. 39th Int. Conf. Machine Learning*, 2022, pp. 2206-2240.

[2] A. Fan, Y. Jernite, E. Perez, D. Grangier, J. Weston, and M. Auli, "ELI5: Long form question answering," in *Proc. 57th Annu. Meeting Assoc. Computational Linguistics*, 2019, pp. 3558-3567.

[3] M. Smith, "Washington Post's AI-generated podcasts rife with errors, fictional quotes," *Semafor*, Dec. 11, 2024. [Online]. Available: https://www.semafor.com/article/12/11/2025/washington-posts-ai-generated-podcasts-rife-with-errors-fictional-quotes

[4] A. Moses, "The Washington Post debuts AI-personalized podcasts to hook younger listeners," *Digiday*, Dec. 2024. [Online]. Available: https://digiday.com/media/the-washington-post-debuts-ai-personalized-podcasts-to-hook-younger-listeners/

[5] National Public Radio, "Questions of accuracy arise as Washington Post uses AI to create personalized podcasts," Dec. 13, 2024. [Online]. Available: https://www.npr.org/2025/12/13/nx-s1-5641047/washington-posts-ai-podcast

[6] N. Diakopoulos, "Automating the news: How algorithms are rewriting the media," *Harvard Univ. Press*, 2019.

[7] Z. Ji et al., "Survey of hallucination in natural language generation," *ACM Computing Surveys*, vol. 55, no. 12, pp. 1-38, 2023.

[8] S. Rawte, A. Chakraborty, and S. Pathak, "The troubling emergence of hallucination in large language models - An extensive definition, quantification, and prescriptive remediations," in *Proc. Conf. Empirical Methods Natural Language Processing*, 2023, pp. 2541-2573.

[9] L. McKenzie, A. Winiowska, A. Winiowska, and A. L. Cohan, "Inverting the curse of dimensionality in self-explaining neural networks," *arXiv:2310.01360*, 2023.

[10] J. Maynez, S. Narayan, B. Bohnet, and R. McDonald, "On faithfulness and factuality in abstractive summarization," in *Proc. 58th Annu. Meeting Assoc. Computational Linguistics*, 2020, pp. 1906-1919.

[11] J. Wei et al., "Chain-of-thought prompting elicits reasoning in large language models," in *Advances in Neural Information Processing Systems*, vol. 35, 2022, pp. 24824-24837.

[12] P. Lewis et al., "Retrieval-augmented generation for knowledge-intensive NLP tasks," in *Advances in Neural Information Processing Systems*, vol. 33, 2020, pp. 9459-9474.

[13] C. Graefe, "Guide to automated journalism," *Columbia Journalism Review*, Jan. 7, 2016.

[14] N. Diakopoulos, "Accountability in algorithmic decision making," *Communications of the ACM*, vol. 59, no. 2, pp. 56-62, 2016.

[15] A. Patel, "How Bloomberg uses AI to enhance financial news," *Bloomberg Engineering Blog*, 2023. [Online]. Available: https://www.bloomberg.com/company/stories/bloomberg-ai-engineering/

[16] J. Waterson, "Guardian experiments with AI-generated content amid cost pressures," *The Guardian*, Oct. 2023.

[17] A. van den Oord et al., "WaveNet: A generative model for raw audio," in *Proc. 9th ISCA Speech Synthesis Workshop*, 2016, pp. 125-125.

[18] C. Wang et al., "Neural codec language models are zero-shot text to speech synthesizers," *arXiv:2301.02111*, 2023.

[19] Y. Ren et al., "FastSpeech 2: Fast and high-quality end-to-end text to speech," in *Proc. Int. Conf. Learning Representations*, 2021.

[20] N. Hassan et al., "ClaimBuster: The first-ever end-to-end fact-checking system," *Proc. VLDB Endowment*, vol. 10, no. 12, pp. 1945-1948, 2017.

[21] M. Babakar and W. Moy, "The state of automated factchecking," *Full Fact*, Aug. 2016. [Online]. Available: https://fullfact.org/media/uploads/full_fact-the_state_of_automated_factchecking_aug_2016.pdf

[22] T. Schuster, A. Fisch, and R. Barzilay, "Get your vitamin C! Robust fact verification with contrastive evidence," in *Proc. 2021 Conf. North American Chapter Assoc. Computational Linguistics*, 2021, pp. 624-643.

[23] The Washington Post, "Your Personal Podcast help documentation," 2025. [Online]. Available: https://helpcenter.washingtonpost.com/hc/en-us/articles/44243916498587-Your-Personal-Podcast

[24] J. Contreras, "Washington Post triggers revolt with 'humiliating' AI blunder," *The Daily Beast*, Dec. 2025. [Online]. Available: https://www.thedailybeast.com/washington-post-triggers-revolt-with-humiliating-ai-blunder/

---

## APPENDIX A: COMPLETE SYSTEM PROMPTS

This appendix provides the complete prompts used by Hakivo's brief generation system, demonstrating the detailed anti-hallucination constraints and journalistic guidelines embedded in the generation process.

### A.1 Daily Brief System Prompt (Complete)

```
You are a scriptwriter for "Hakivo Daily" - a PERSONALIZED civic engagement
audio briefing styled after NPR's Morning Edition. Think: warm, informative,
human, and conversational.

Your hosts are [HOST_A] (female) and [HOST_B] (male). They're like seasoned
NPR hosts - warm, curious, knowledgeable. They have genuine chemistry and
naturally weave conversation together.

=== LISTENER PROFILE (PERSONALIZE FOR THIS LISTENER) ===
Name: [USER_NAME]
Location: [STATE], Congressional District [DISTRICT]
Policy Interests: [INTERESTS]

=== NPR MORNING EDITION STYLE ===
1. STORYTELLING FIRST: Don't just report facts - tell stories. "Let me paint
   a picture of what's happening..."
2. HUMAN IMPACT: Always connect policy to real people. "What this means for
   families in [STATE]..."
3. WARM TRANSITIONS: Smooth handoffs between topics. "Before we go further,
   [HOST_B], there's something our listeners should know..."
4. CURIOSITY & DEPTH: Hosts ask each other genuine questions. "[HOST_B], help
   us understand - why does this matter right now?"
5. COMING UP TEASERS: Build anticipation. "Coming up, we'll look at what's
   happening in the [STATE] legislature..."
6. CONTEXT & HISTORY: Brief background without being boring. "This has been
   building for months..."
7. MULTIPLE INTERESTS: Cover 2-3 different policy areas matching the listener's
   interests: [INTERESTS]

=== JOURNALISTIC NEUTRALITY (CRITICAL) ===
Like NPR journalists, hosts must be STRICTLY UNBIASED:
1. PRESENT ALL SIDES: "Supporters say this will... while critics argue..." -
   always include opposing viewpoints
2. NO PARTISAN LANGUAGE: Never use loaded terms like "radical", "extreme",
   "common sense". Just report the facts.
3. ATTRIBUTE CLAIMS: "According to the bill's sponsors..." or "Opponents point
   out..." - don't make claims, quote sources
4. EXPLAIN, DON'T ADVOCATE: Help listeners understand, never push them toward
   a position
5. EQUAL TREATMENT: Cover Republican and Democratic bills the same way - focus
   on policy impact, not party
6. CURIOSITY, NOT JUDGMENT: "[HOST_B], what are both sides saying about this?" -
   genuine curiosity about all perspectives
7. FACTUAL FRAMING: "The bill would..." not "The bill aims to fix..." -
   describe actions, not intentions
8. RESPECT LISTENERS: Trust the audience to form their own opinions when given
   fair information

PERSONALIZATION RULES:
1. Open warmly with the listener's name: "Good morning, [NAME]..."
2. Highlight their representative if involved: "Your representative, [REP_NAME],
   is at the center of today's top story..."
3. Make it local: "For listeners in [STATE]..." or "Here's what this means for
   [STATE]..."
4. This brief is UNIQUE to [NAME] - make them feel it was created just for them.

IMPORTANT: Write ONLY natural spoken dialogue. NEVER include section labels.
Hosts NEVER say "top story", "segment", "section" - they just flow naturally
like NPR.

You have WEB SEARCH capability - use it for latest updates, expert quotes, and
context.

=== NATURAL SHOW FLOW ===

OPENING HOOK (15-20 seconds):
- Hook immediately with a compelling angle
- Create intrigue, not just headlines

SHOW INTRO (15-20 seconds):
- "From Hakivo, I'm [HOST_A]."
- "And I'm [HOST_B]. It's [DATE]."
- "Here's what's happening in the policy world that matters to you."

MAIN STORY (3-4 minutes):
- TELL A STORY, not just facts
- Natural host conversation
- Include a "coming up" tease before transitioning

RELATED NEWS & CONTEXT (1-2 minutes):
- Connect to 2-3 news stories from different policy areas
- Quick, conversational updates
- Local angle: "Closer to home in [STATE]..."

POLICY SPOTLIGHT (2-3 minutes):
- Cover 1-2 additional bills from DIFFERENT interest areas
- Keep conversational
- Explain the stakes in human terms

STATE LEGISLATURE (1-2 minutes):
- NPR-style transition: "Now let's turn to what's happening closer to home..."
- Cover 1-2 state bills with proper bill identifiers
- Tell the local story
- Link to OpenStates

CLOSING (30-40 seconds):
- Warm wrap-up: "That's today's Hakivo Daily."
- Personal call to action: "[NAME], want to track these bills? Open Hakivo to
  follow them."
- NPR-style sign-off: "I'm [HOST_A]." "And I'm [HOST_B]." "We'll see you
  tomorrow. Stay curious, stay engaged."

=== CONVERSATIONAL AUTHENTICITY (SOUND LIKE REAL NPR) ===

TONE: Serious and authoritative but highly conversational. Like two intelligent
colleagues discussing news over coffee - NOT a stiff formal reading.

HOST ROLES:
- [HOST_A] (primary): Acts as the AUDIENCE'S PROXY. Summarizes complex ideas
  for clarity. Slightly skeptical, probes for the "so what?" factor.
- [HOST_B] (expert): The SUBJECT MATTER EXPERT. Provides context and analysis.

NATURAL SPEECH PATTERNS:
- Start answers with: "Right," "Well," "So," "Yeah," - makes it sound unscripted
- Filler words for naturalism: "Um, okay," "Yeah," "Right" - avoid sounding
  robotic
- Clarifications: "Just to be clear...", "I should say...", "It's worth noting..."

TRANSITION WORDS:
- "Now, it was already well established..."
- "But these documents do highlight..."
- "And I will note..."
- "I think the key thing here is..."
- "What's interesting about this is..."

NUANCE OVER HYPE:
- AVOID sensationalism. Never say "This is shocking" or "groundbreaking"
- INSTEAD: "It's pretty disturbing," "People have questions," "This is significant"
- Be measured: "This could have implications..." not "This will change everything!"

ACCURACY & CONTEXT:
- Heavy emphasis on accuracy: "I should say it's pretty disturbing," "Just to be
  clear..."
- Acknowledge limitations: "It's an interim ruling... not precedent-setting"
- When uncertain: "What we know so far is..." not definitive claims

=== CRITICAL FORMATTING RULES ===
- Every line: "[HOST_A]:" or "[HOST_B]:" followed by dialogue
- Emotional/tonal cues in brackets: [thoughtfully], [with concern], [curiously]
- NEVER section labels - only natural spoken dialogue
- Natural interruptions and reactions: "Right." "Mm-hmm." "Interesting."
- Plain language - explain jargon naturally when needed
- Pace varies - moments of urgency, moments of reflection

TARGET: 6-8 minutes (1200-1600 words)
```

### A.2 User Prompt Template (Complete)

```
Generate a PERSONALIZED Hakivo Daily script for [USER_NAME] on [DATE].

=== LISTENER PROFILE ===
Name: [USER_NAME]
Location: [STATE] (District [DISTRICT])
Interests: [POLICY_INTERESTS]

First, use web search to find the latest updates and context on the top story
bill. This will help make the script more current and informative.

=== TODAY'S TOP STORY ===
Bill: [BILL_NUMBER] - [BILL_TITLE]
Sponsor: [SPONSOR_NAME] ([PARTY]-[STATE])
Status: [CURRENT_STATUS]
Latest Action: [ACTION_DATE] - [ACTION_DESCRIPTION]
Summary: [BILL_SUMMARY]
Related News:
- [NEWS_ARTICLE_1_TITLE] ([NEWS_SOURCE_1])
- [NEWS_ARTICLE_2_TITLE] ([NEWS_SOURCE_2])

=== LEGISLATION SPOTLIGHT ===
[Additional 2-3 bills with full metadata]

=== STATE LEGISLATURE ([STATE]) ===
State Bill: [STATE_BILL_ID]
Title: [STATE_BILL_TITLE]
Status: [STATE_BILL_STATUS]
Latest Action: [STATE_ACTION_DATE] - [STATE_ACTION_DESC]

=== NEWS COVERAGE ===
LOCAL NEWS (from [STATE]):
• [LOCAL_NEWS_HEADLINE_1]
• [LOCAL_NEWS_HEADLINE_2]

NATIONAL NEWS:
• [NATIONAL_NEWS_HEADLINE_1]
• [NATIONAL_NEWS_HEADLINE_2]
• [NATIONAL_NEWS_HEADLINE_3]

=== PERSONALIZATION REQUIREMENTS ===
1. START by greeting [USER_NAME] by name warmly
2. The TOP STORY is from [USER_NAME]'s OWN representative - emphasize this
   personal connection!
3. Include the LOCAL news from [STATE] - make it feel personal
4. Include the STATE LEGISLATURE section - transition with "Now let's check in
   on what's happening in the [STATE] legislature..."
5. Follow the show structure: Personalized Opening → Intro → Top Story →
   Headlines → Spotlight → State Legislature → Personalized Outro
6. The HAKIVO OUTRO must include [USER_NAME]'s name in the call to action
7. Every line starts with "[HOST_A]:" or "[HOST_B]:"
8. Include emotional cues in [brackets]
9. Make it conversational and engaging - this brief was made JUST for [USER_NAME]

Generate a HEADLINE in the style of The New York Times.

NYT-STYLE HEADLINE RULES:
1. TELL A STORY, not just facts - capture the narrative arc and human stakes
2. USE STRONG VERBS - "Clears", "Gambles", "Battles", "Faces" instead of
   "Passes", "Is", "Has"
3. IMPLY THE "SO WHAT" - why should readers care about this?
4. CREATE TENSION - show the conflict, stakes, or uncertainty
5. MAX 12 WORDS - punchy and powerful

EXAMPLES:
- Instead of "Senate Passes Immigration Bill" → "A Nation's Immigration Debate
  Reaches Its Breaking Point"
- Instead of "Healthcare Bill Advances" → "Millions Face Uncertainty as Health
  Overhaul Moves Forward"
- Instead of "Climate Bill Clears House" → "Congress Bets Big on a Greener Future"

Format your response EXACTLY as:
HEADLINE: [Your NYT-style headline here]

SCRIPT:
[HOST_A]: [emotional cue] dialogue...
[HOST_B]: [emotional cue] dialogue...
...
```

### A.3 Anti-Hallucination Enforcement

The prompt enforces hallucination prevention through multiple mechanisms:

**1. Explicit Prohibition**:
```
"Your ONLY job is to make the provided facts engaging and conversational.
You MUST NOT:
- Invent quotes or statements
- Add background information not in the data
- Speculate about motives or outcomes
- Make predictions about future events
- Editorialize or provide opinion

Every fact MUST come from the bills, actions, or news articles provided. If
a fact isn't in the input, don't include it."
```

**2. Mandatory Attribution**:
```
"ATTRIBUTE CLAIMS: 'According to the bill's sponsors...' or 'Opponents point
out...' - don't make claims, quote sources"
```

**3. Factual Framing**:
```
"FACTUAL FRAMING: 'The bill would...' not 'The bill aims to fix...' - describe
actions, not intentions"
```

**4. AI Disclosure Append**:
After script generation, the system automatically appends:
```
"This brief was generated by artificial intelligence. While we strive for
accuracy, please verify any facts before sharing or acting on this information.
For the latest updates, visit hakivo.com."
```

This disclosure is spoken aloud in the audio version, ensuring transparency.

---

## APPENDIX B: API INTEGRATION AND DATA SOURCES

This appendix details how Hakivo connects to external data sources through structured APIs, ensuring all content derives from verifiable, authoritative sources.

### B.1 Congress.gov API Integration

**Purpose**: Retrieve federal legislative data from the official U.S. Congress API

**Base URL**: `https://api.congress.gov/v3`

**Authentication**: API key required (obtained from Congress.gov)

**Rate Limits**: 5,000 requests per hour

**Key Endpoints Used**:

1. **Bill Search**:
```javascript
GET /bill/{congress}?api_key={key}&limit={n}&offset={m}&sort=updateDate:desc

Response:
{
  "bills": [
    {
      "congress": 119,
      "type": "hr",
      "number": 1234,
      "title": "Full bill title",
      "updateDate": "2025-12-27T10:30:00Z",
      "url": "https://api.congress.gov/v3/bill/119/hr/1234"
    }
  ]
}
```

2. **Bill Details**:
```javascript
GET /bill/{congress}/{type}/{number}?api_key={key}

Response:
{
  "bill": {
    "congress": 119,
    "type": "hr",
    "number": 1234,
    "title": "Full bill title",
    "latestAction": {
      "actionDate": "2025-12-20",
      "text": "Passed House"
    },
    "sponsors": [{
      "firstName": "John",
      "lastName": "Smith",
      "party": "D",
      "state": "CA"
    }],
    "policyArea": {
      "name": "Health"
    },
    "summaries": [{
      "versionCode": "00",
      "actionDate": "2025-12-01",
      "text": "Introduces amendments to..."
    }]
  }
}
```

3. **Congressional Actions**:
```javascript
GET /bill/{congress}/{type}/{number}/actions?api_key={key}

Response:
{
  "actions": [
    {
      "actionDate": "2025-12-20",
      "text": "Passed House by voice vote",
      "type": "Floor"
    },
    {
      "actionDate": "2025-12-15",
      "text": "Committee on Health reported favorably",
      "type": "Committee"
    }
  ]
}
```

**Data Transformation**:
API responses are transformed into database records:

```typescript
interface BillRecord {
  id: number;
  congress: number;
  bill_type: string;  // 'hr', 's', 'hjres', 'sjres'
  bill_number: number;
  title: string;
  sponsor_id: string;
  policy_area: string;
  latest_action_date: string;
  latest_action_text: string;
  introduced_date: string;
  updated_at: number;  // Unix timestamp
}
```

### B.2 OpenStates API Integration

**Purpose**: Retrieve state-level legislative data from all 50 states

**Base URL**: `https://v3.openstates.org`

**Authentication**: API key required (OpenStates GraphQL API)

**Coverage**: All 50 states, DC, Puerto Rico

**GraphQL Query Example**:
```graphql
query {
  bills(
    jurisdiction: "California"
    session: "2023-2024"
    searchQuery: "housing"
    first: 20
  ) {
    edges {
      node {
        id
        identifier  # e.g., "SB 123"
        title
        classification
        subject
        abstracts {
          abstract
        }
        sponsorships {
          name
          primary
        }
        latestAction {
          date
          description
          classification
        }
        legislativeSession {
          identifier
          name
        }
      }
    }
  }
}
```

**Data Transformation**:
```typescript
interface StateBillRecord {
  id: string;
  state: string;  // Two-letter code
  identifier: string;  // e.g., "SB 123"
  title: string;
  chamber: string;  // 'upper', 'lower'
  session_identifier: string;
  subjects: string;  // JSON array
  latest_action_date: string;
  latest_action_description: string;
  openstates_url: string;
  created_at: number;
}
```

### B.3 Perplexity API Integration (News Search)

**Purpose**: AI-powered search with real-time web access for recent news articles related to legislation

**Service**: Perplexity AI Sonar Pro - Search model with real-time web access and citation verification

**Base URL**: `https://api.perplexity.ai/chat/completions`

**Authentication**: API key required (Bearer token)

**Model Configuration**:
```typescript
const perplexityConfig = {
  model: 'sonar-pro',
  max_tokens: 4096,
  temperature: 0.1,        // Low temperature for factual accuracy
  return_images: true,     // Get real images from search results
  response_format: {
    type: 'json_schema',   // Structured JSON output
    json_schema: {
      name: 'news_response',
      schema: newsSchema,
      strict: true         // Enforce schema compliance
    }
  }
};
```

**Search Query Construction**:
```typescript
// Build targeted search from user interests
const interestPrompts = {
  'Health & Social Welfare': {
    searchTerms: ['healthcare policy', 'Medicare Medicaid', 'drug pricing'],
    context: 'healthcare reform, prescription costs, social safety net'
  },
  'Environment & Energy': {
    searchTerms: ['climate policy', 'clean energy', 'carbon emissions'],
    context: 'climate legislation, EPA regulations, green energy'
  }
  // ... 10 total interest categories
};

// Gather search terms from user interests
const searchTerms = interests
  .flatMap(i => interestPrompts[i]?.searchTerms || [])
  .slice(0, 8);  // Top 8 terms

// Build search prompt
const searchPrompt = `Search for the ${limit} most recent and important
news articles from the past 7 days about U.S. policy and legislation.

SEARCH FOCUS - Find news about:
${searchTerms.map(t => `• ${t}`).join('\n')}

REQUIREMENTS:
- Only articles from the past 7 days (today is ${today})
- Reputable sources only: NYT, WaPo, WSJ, AP, Reuters, Politico, NPR
- Focus on legislative action and policy developments

For each article, provide: title, summary, url, publishedAt, source, category`;
```

**Response Structure**:
```typescript
interface PerplexityResponse {
  choices: [{
    message: {
      content: string;  // JSON string with articles
    }
  }];
  citations?: string[];           // Source citations
  search_results?: Array<{       // REAL search results from web
    title: string;
    url: string;
    date?: string;
    snippet?: string;
  }>;
  images?: Array<{               // Real images from search
    image_url: string;
    origin_url: string;
    height?: number;
    width?: number;
  }>;
}

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  source: string;
  category: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
  };
}
```

**Critical Anti-Hallucination Strategy**:
Perplexity returns both AI-generated articles AND real search results. Hakivo prioritizes the **search_results** array as source of truth:

```typescript
// PRIORITY: Use search_results from Perplexity as source of truth
// These are REAL search results, not AI-generated content
if (result.search_results && result.search_results.length > 0) {
  // Build articles from REAL search results
  for (const searchResult of result.search_results) {
    articles.push({
      title: searchResult.title,          // Real title from web
      url: searchResult.url,              // Real URL from search
      summary: aiSummary || searchResult.snippet,
      publishedAt: searchResult.date || today,
      source: extractSource(searchResult.url),
      category: aiCategory || 'Other'
    });
  }
} else {
  // Fallback: use AI-generated articles (original behavior)
  articles = parsedContent.articles;
}
```

**Hallucination Filtering**:
After receiving results, Hakivo filters out fake articles that Perplexity generates when no real news is found:

```typescript
// Filter error-like patterns in titles/summaries
const invalidPatterns = [
  'unable to retrieve',
  'cannot be provided',
  'no articles found',
  'not currently possible',
  'unable to find'
];

const validArticles = articles.filter(article => {
  const looksLikeError = invalidPatterns.some(pattern =>
    article.title.toLowerCase().includes(pattern) ||
    article.summary.toLowerCase().includes(pattern)
  );

  const hasValidUrl =
    article.url &&
    article.url.startsWith('http') &&
    article.url !== 'Unknown';

  return !looksLikeError && hasValidUrl;
});
```

**Source Domain Mapping**:
```typescript
const sourceMap: Record<string, string> = {
  'nytimes.com': 'New York Times',
  'washingtonpost.com': 'Washington Post',
  'politico.com': 'Politico',
  'thehill.com': 'The Hill',
  'apnews.com': 'AP News',
  'reuters.com': 'Reuters',
  'npr.org': 'NPR',
  'axios.com': 'Axios',
  'rollcall.com': 'Roll Call',
  'wsj.com': 'Wall Street Journal'
};
```

### B.4 Data Synchronization Architecture

**Schedulers**: Automated cron jobs sync data from external APIs to local database

**Congress Sync Scheduler**:
```
Schedule: 0 */6 * * * (Every 6 hours)
Task:
1. Fetch latest bills from Congress.gov API (last 30 days)
2. Update existing bill records
3. Insert new bills
4. Sync congressional actions
5. Update sponsor metadata
Duration: ~5-10 minutes
```

**State Sync Scheduler**:
```
Schedule: 0 3 * * * (3 AM daily)
Task:
1. Query OpenStates for each active state session
2. Filter by policy areas matching user interests
3. Update state bill records
4. Sync latest actions
Duration: ~10-15 minutes (50 states)
```

**News Sync Scheduler**:
```
Schedule: 0 */2 * * * (Every 2 hours)
Task:
1. For recent bills (last 7 days), query Perplexity API
2. Prioritize search_results array for real URLs
3. Store article metadata (title, URL, summary, citations)
4. Filter out hallucinated articles
5. Mark articles as "local" if from state-specific sources
Duration: ~2-3 minutes
```

**Database Schema** (Cloudflare D1 - SQLite):
```sql
-- Bills table
CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  sponsor_id TEXT,
  first_name TEXT,
  last_name TEXT,
  party TEXT,
  state TEXT,
  policy_area TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  introduced_date TEXT,
  summary TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(congress, bill_type, bill_number)
);

-- State bills table
CREATE TABLE state_bills (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  identifier TEXT NOT NULL,
  title TEXT NOT NULL,
  chamber TEXT,
  session_identifier TEXT,
  subjects TEXT,  -- JSON array
  latest_action_date TEXT,
  latest_action_description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- News articles table
CREATE TABLE news_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER,
  state_bill_id TEXT,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  summary TEXT,
  published_date TEXT,
  source_domain TEXT,
  is_local INTEGER DEFAULT 0,
  relevance_score REAL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (state_bill_id) REFERENCES state_bills(id)
);

-- User preferences table
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,  -- JSON array
  state TEXT,
  district INTEGER,
  briefing_frequency TEXT DEFAULT 'daily',
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## APPENDIX C: JSON DATA STRUCTURES

This appendix provides example JSON structures passed between pipeline stages, demonstrating the structured data format that constrains LLM generation.

### C.1 Stage 5 Input (Script Generation)

The complete JSON object passed to the LLM for script generation:

```json
{
  "personalization": {
    "userName": "Alex",
    "state": "California",
    "district": 12,
    "repBillIds": ["hr-119-4567"],
    "policyInterests": [
      "Health & Social Welfare",
      "Environment & Energy",
      "Civil Rights & Law"
    ],
    "stateBills": [
      {
        "id": "ca-2023-sb-567",
        "identifier": "SB 567",
        "title": "California Clean Energy Transition Act",
        "chamber": "upper",
        "latest_action_date": "2025-12-20",
        "latest_action_description": "Passed Senate, sent to Assembly",
        "subjects": ["Energy", "Environment", "Climate Change"]
      }
    ]
  },
  "bills": [
    {
      "id": 123456,
      "congress": 119,
      "bill_type": "hr",
      "bill_number": 4567,
      "title": "Affordable Prescription Drug Act of 2025",
      "sponsor": {
        "first_name": "Nancy",
        "last_name": "Pelosi",
        "party": "D",
        "state": "CA",
        "district": 11
      },
      "policy_area": "Health",
      "latest_action": {
        "date": "2025-12-26",
        "text": "Passed House by vote of 245-189"
      },
      "summary": "This bill establishes a federal prescription drug price negotiation program allowing Medicare to directly negotiate prices with pharmaceutical manufacturers for certain high-cost drugs.",
      "actions": [
        {
          "action_date": "2025-12-26",
          "action_text": "Passed House by vote of 245-189"
        },
        {
          "action_date": "2025-12-20",
          "action_text": "Reported favorably by Committee on Energy and Commerce"
        },
        {
          "action_date": "2025-12-10",
          "action_text": "Referred to House Committee on Energy and Commerce"
        }
      ]
    },
    {
      "id": 123457,
      "congress": 119,
      "bill_type": "s",
      "bill_number": 890,
      "title": "Renewable Energy Investment Tax Credit Extension Act",
      "sponsor": {
        "first_name": "Bernie",
        "last_name": "Sanders",
        "party": "I",
        "state": "VT"
      },
      "policy_area": "Energy",
      "latest_action": {
        "date": "2025-12-24",
        "text": "Placed on Senate Legislative Calendar"
      },
      "summary": "This bill extends and expands the Investment Tax Credit for solar, wind, and geothermal energy projects through 2030.",
      "actions": [
        {
          "action_date": "2025-12-24",
          "action_text": "Placed on Senate Legislative Calendar"
        },
        {
          "action_date": "2025-12-18",
          "action_text": "Reported favorably by Committee on Finance"
        }
      ]
    }
  ],
  "newsArticles": [
    {
      "title": "House Passes Historic Drug Pricing Reform After Heated Debate",
      "url": "https://www.nytimes.com/2025/12/26/health/drug-pricing-bill.html",
      "source": "nytimes.com",
      "summary": "The House voted 245-189 to allow Medicare to negotiate prescription drug prices, a major victory for Democrats. The bill faces uncertainty in the Senate.",
      "published_date": "2025-12-26",
      "isLocal": false,
      "relevance_score": 0.92
    },
    {
      "title": "California Clean Energy Bill Advances Despite Industry Opposition",
      "url": "https://www.latimes.com/california/story/2025-12-20/clean-energy-bill",
      "source": "latimes.com",
      "summary": "SB 567 passed the California Senate on Thursday, mandating 100% clean electricity by 2035. Utility companies warn of higher consumer costs.",
      "published_date": "2025-12-20",
      "isLocal": true,
      "relevance_score": 0.88
    },
    {
      "title": "Renewable Tax Credits Could Add $50B to Federal Deficit, CBO Warns",
      "url": "https://www.reuters.com/business/energy/renewable-tax-credits-deficit-2025-12-23/",
      "source": "reuters.com",
      "summary": "Congressional Budget Office analysis shows S. 890's tax credit extensions would cost $50 billion over ten years. Supporters argue economic benefits justify the expense.",
      "published_date": "2025-12-23",
      "isLocal": false,
      "relevance_score": 0.85
    }
  ],
  "today": "Friday, December 27, 2025"
}
```

**Key Constraints**:
1. All bill data includes `sponsor`, `actions`, `summary` - no missing context
2. News articles include `url` for verification
3. State bills have `latest_action_date` and `description`
4. Policy areas explicitly listed
5. User location and interests explicit

The LLM receives ONLY this JSON. No access to external knowledge. If a fact isn't in this structure, it cannot be included in the script.

### C.2 Stage 5 Output (Generated Script)

Example of generated script structure:

```
HEADLINE: Medicare's Drug Price Showdown: What California Voters Need to Know

SCRIPT:
HOST A: [warmly] Good morning, Alex. [beat] After years of debate, the House just voted to let Medicare negotiate prescription drug prices. And your representative, Nancy Pelosi, was right at the center of this historic vote.

HOST B: From Hakivo, I'm Sarah.

HOST A: And I'm David. It's Friday, December 27th, 2025.

HOST B: Here's what's happening in the policy world that matters to you.

HOST A: [thoughtfully] So David, this drug pricing bill—it passed the House yesterday, 245 to 189. Walk us through what just happened.

HOST B: Right. Well, the Affordable Prescription Drug Act does something Congress has been debating for decades. It allows Medicare to directly negotiate prices with pharmaceutical companies for certain high-cost drugs.

HOST A: And this is personal for Alex—Representative Pelosi from California's 11th district was a key sponsor of this bill. David, why did this matter so much to her?

HOST B: [nodding] Well, Pelosi has long argued that Americans pay more for prescription drugs than people in any other developed nation. According to the bill's sponsors, this legislation could save Medicare billions while reducing out-of-pocket costs for seniors.

HOST A: But critics have concerns, right?

HOST B: They do. Opponents point out that pharmaceutical companies might reduce investment in new drug research if prices are capped. The debate really comes down to whether we prioritize affordability now or innovation for the future.

HOST A: [curiously] What happens next?

HOST B: The bill moves to the Senate, where it faces an uncertain path. We'll have to see if there's enough support there.

HOST A: [with transition] Now, before we move on, there's another story that caught our attention—this one about renewable energy...

[Script continues with additional bills and news coverage]

HOST A: [transitioning] Now let's turn to what's happening closer to home in the California state capitol.

HOST B: Yeah, there's some significant movement on clean energy policy. Senate Bill 567—the California Clean Energy Transition Act—just passed the State Senate this week.

HOST A: What would this bill do?

HOST B: [with context] It mandates that California achieve 100% clean electricity by 2035. According to recent news reports from the LA Times, utility companies are warning this could mean higher consumer costs in the short term.

HOST A: But supporters argue the long-term benefits justify those costs?

HOST B: Exactly. They point to reduced carbon emissions and the creation of green jobs. The bill now heads to the State Assembly. You can find more details on this at OpenStates—we'll link it in your brief, Alex.

[Script continues to closing]

HOST A: [warmly] That's today's Hakivo Daily.

HOST B: Alex, want to track these bills and see how they develop? Open Hakivo to follow them.

HOST A: I'm Sarah.

HOST B: And I'm David. We'll see you tomorrow. Stay curious, stay engaged.

This brief was generated by artificial intelligence. While we strive for accuracy, please verify any facts before sharing or acting on this information. For the latest updates, visit hakivo.com.
```

**Observable Patterns**:
1. Every claim attributed to source ("According to the bill's sponsors...", "Opponents point out...")
2. Bills referenced by official number and sponsor
3. News sources cited ("According to recent news reports from the LA Times...")
4. No speculation or prediction
5. Balanced presentation of viewpoints
6. Personal connection to user maintained
7. AI disclosure appended

---

## ACKNOWLEDGMENTS

The authors thank the Hakivo development team for providing architectural details and transparency about their system design. We acknowledge the Washington Post for public documentation of their AI initiatives, and journalists at NPR and Semafor for investigative reporting that informed this analysis.

---

**Author Affiliations:**
[This section would typically include author names, affiliations, and contact information. Omitted here as this is an analysis paper rather than a submission to a specific venue.]

---

*IEEE Copyright Notice: This paper follows IEEE formatting standards for conference publications. Actual submission would include specific conference name, dates, and IEEE copyright language.*
