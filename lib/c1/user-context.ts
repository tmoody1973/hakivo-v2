/**
 * User Context for C1 Chat
 *
 * This module handles fetching and formatting user context
 * (profile, preferences, representatives) for injection into
 * the chat system prompt.
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  location?: {
    state?: string;
    district?: string;
    city?: string;
    zipCode?: string;
  };
}

export interface UserPreferences {
  policyAreas?: string[];
  trackedBills?: string[];
  notificationSettings?: {
    email?: boolean;
    push?: boolean;
  };
}

export interface Representative {
  bioguideId: string;
  name: string;
  party: string;
  chamber: "House" | "Senate";
  state: string;
  district?: number;
  imageUrl?: string;
  phone?: string;
  website?: string;
}

export interface UserContext {
  profile?: UserProfile;
  preferences?: UserPreferences;
  representatives?: Representative[];
}

/**
 * Format user context into a system prompt section
 */
export function formatUserContext(context: UserContext): string {
  const sections: string[] = [];

  // User Profile Section
  if (context.profile) {
    const { profile } = context;
    sections.push(`## Current User

**Name:** ${profile.name}
${profile.location?.state ? `**State:** ${profile.location.state}` : ""}
${profile.location?.district ? `**Congressional District:** ${profile.location.state}-${profile.location.district}` : ""}
${profile.location?.city ? `**City:** ${profile.location.city}` : ""}
${profile.location?.zipCode ? `**Zip Code:** ${profile.location.zipCode}` : ""}`);
  }

  // Representatives Section
  if (context.representatives && context.representatives.length > 0) {
    const reps = context.representatives;
    const senators = reps.filter(r => r.chamber === "Senate");
    const houseReps = reps.filter(r => r.chamber === "House");

    let repSection = `## User's Representatives

When the user asks about "my representatives", "my senator", "my congressman", or similar, they are referring to these elected officials:

`;

    if (senators.length > 0) {
      repSection += `**Senators:**
${senators.map(s => `- Sen. ${s.name} (${s.party}-${s.state})${s.phone ? ` | Phone: ${s.phone}` : ""}`).join("\n")}

`;
    }

    if (houseReps.length > 0) {
      repSection += `**House Representative:**
${houseReps.map(h => `- Rep. ${h.name} (${h.party}-${h.state}${h.district ? `-${h.district}` : ""})${h.phone ? ` | Phone: ${h.phone}` : ""}`).join("\n")}
`;
    }

    sections.push(repSection.trim());
  }

  // Preferences Section
  if (context.preferences) {
    const { preferences } = context;
    const prefParts: string[] = [];

    if (preferences.policyAreas && preferences.policyAreas.length > 0) {
      prefParts.push(`**Policy Interests:** ${preferences.policyAreas.join(", ")}`);
    }

    if (preferences.trackedBills && preferences.trackedBills.length > 0) {
      prefParts.push(`**Tracked Bills:** ${preferences.trackedBills.slice(0, 5).join(", ")}${preferences.trackedBills.length > 5 ? ` (+${preferences.trackedBills.length - 5} more)` : ""}`);
    }

    if (prefParts.length > 0) {
      sections.push(`## User Preferences

${prefParts.join("\n")}

Consider these interests when providing recommendations or suggesting related topics.`);
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return `
---

# USER CONTEXT

The following information is about the current user. Use this to personalize responses and provide relevant local information when appropriate.

${sections.join("\n\n")}

---
`;
}

/**
 * Build a complete system prompt with user context
 */
export function buildSystemPromptWithContext(
  basePrompt: string,
  context: UserContext | null
): string {
  if (!context) {
    return basePrompt;
  }

  const contextSection = formatUserContext(context);
  if (!contextSection) {
    return basePrompt;
  }

  // Inject user context at the end of the system prompt
  return `${basePrompt}

${contextSection}`;
}
