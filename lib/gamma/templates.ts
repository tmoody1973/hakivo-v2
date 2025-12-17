/**
 * Gamma Document Template Presets
 *
 * These presets define default configurations for different document types
 * that can be generated through the Gamma API integration.
 */

export type GammaFormat = "presentation" | "document" | "webpage";
export type TextAmount = "brief" | "medium" | "detailed" | "extensive";
export type ImageSource = "stock" | "ai" | "none";

export interface TemplateDefaults {
  format: GammaFormat;
  textAmount: TextAmount;
  audience: string;
  tone: string;
  imageSource?: ImageSource;
  cardCount?: number;
  suggestedThemes?: string[];
}

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "education" | "advocacy" | "policy" | "general" | "media";
  defaults: TemplateDefaults;
  suggestedUses: string[];
}

/**
 * Template presets for different use cases
 */
export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  lesson_guide: {
    id: "lesson_guide",
    name: "Lesson Guide",
    description: "Educational guide for teachers and students",
    icon: "📚",
    category: "education",
    defaults: {
      format: "document",
      textAmount: "detailed",
      audience: "Teachers and students",
      tone: "Educational and engaging",
      imageSource: "stock",
      cardCount: 12,
    },
    suggestedUses: [
      "Classroom lesson plans",
      "Student handouts",
      "Educational worksheets",
      "Study guides",
    ],
  },

  advocacy_deck: {
    id: "advocacy_deck",
    name: "Advocacy Presentation",
    description: "Persuasive deck for stakeholders and decision makers",
    icon: "📊",
    category: "advocacy",
    defaults: {
      format: "presentation",
      textAmount: "medium",
      audience: "Community stakeholders and decision makers",
      tone: "Professional and persuasive",
      imageSource: "stock",
      cardCount: 15,
    },
    suggestedUses: [
      "Town hall presentations",
      "Stakeholder briefings",
      "Campaign materials",
      "Community organizing",
    ],
  },

  policy_brief: {
    id: "policy_brief",
    name: "Policy Brief",
    description: "Formal policy analysis document",
    icon: "📋",
    category: "policy",
    defaults: {
      format: "document",
      textAmount: "detailed",
      audience: "Policy makers and analysts",
      tone: "Formal and analytical",
      imageSource: "none",
      cardCount: 8,
    },
    suggestedUses: [
      "Legislative analysis",
      "Policy recommendations",
      "Research summaries",
      "Position papers",
    ],
  },

  citizen_explainer: {
    id: "citizen_explainer",
    name: "Citizen Explainer",
    description: "Simple guide for general public understanding",
    icon: "🗳️",
    category: "general",
    defaults: {
      format: "webpage",
      textAmount: "brief",
      audience: "General public",
      tone: "Simple and accessible",
      imageSource: "ai",
      cardCount: 6,
    },
    suggestedUses: [
      "Bill explainers",
      "Voting guides",
      "Civic education",
      "Public awareness",
    ],
  },

  news_summary: {
    id: "news_summary",
    name: "News Summary",
    description: "Digestible news briefing format",
    icon: "📰",
    category: "media",
    defaults: {
      format: "document",
      textAmount: "brief",
      audience: "News readers and general public",
      tone: "Journalistic and factual",
      imageSource: "stock",
      cardCount: 5,
    },
    suggestedUses: [
      "Legislative updates",
      "Bill tracking",
      "Congressional news",
      "Political briefings",
    ],
  },

  executive_summary: {
    id: "executive_summary",
    name: "Executive Summary",
    description: "High-level overview for busy professionals",
    icon: "💼",
    category: "policy",
    defaults: {
      format: "presentation",
      textAmount: "brief",
      audience: "Executives and senior leaders",
      tone: "Concise and actionable",
      imageSource: "none",
      cardCount: 5,
    },
    suggestedUses: [
      "Board presentations",
      "Executive briefings",
      "Quick overviews",
      "Decision support",
    ],
  },

  research_report: {
    id: "research_report",
    name: "Research Report",
    description: "Comprehensive research document",
    icon: "🔬",
    category: "policy",
    defaults: {
      format: "document",
      textAmount: "extensive",
      audience: "Researchers and academics",
      tone: "Academic and thorough",
      imageSource: "none",
      cardCount: 20,
    },
    suggestedUses: [
      "Policy research",
      "Impact analysis",
      "Data reports",
      "Academic papers",
    ],
  },

  social_share: {
    id: "social_share",
    name: "Social Media Shareable",
    description: "Visual content optimized for social sharing",
    icon: "📱",
    category: "media",
    defaults: {
      format: "presentation",
      textAmount: "brief",
      audience: "Social media users",
      tone: "Engaging and shareable",
      imageSource: "ai",
      cardCount: 3,
    },
    suggestedUses: [
      "Twitter threads",
      "Instagram carousels",
      "LinkedIn posts",
      "Viral content",
    ],
  },
};

/**
 * Get a template preset by ID
 */
export function getTemplatePreset(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS[id];
}

/**
 * Get all template presets as an array
 */
export function getAllTemplatePresets(): TemplatePreset[] {
  return Object.values(TEMPLATE_PRESETS);
}

/**
 * Get template presets by category
 */
export function getTemplatesByCategory(category: TemplatePreset["category"]): TemplatePreset[] {
  return Object.values(TEMPLATE_PRESETS).filter((t) => t.category === category);
}

/**
 * Get the default template ID (policy_brief is a good default for congressional content)
 */
export function getDefaultTemplateId(): string {
  return "policy_brief";
}

/**
 * Get suggested template based on artifact type
 */
export function getSuggestedTemplate(artifactType: string): TemplatePreset {
  const suggestions: Record<string, string> = {
    report: "policy_brief",
    slides: "advocacy_deck",
    policy_brief: "policy_brief",
    bill_summary: "citizen_explainer",
    research: "research_report",
    news: "news_summary",
    education: "lesson_guide",
    default: "policy_brief",
  };

  const templateId = suggestions[artifactType] || suggestions.default;
  return TEMPLATE_PRESETS[templateId];
}

/**
 * Get template label for display
 */
export function getTemplateLabel(templateId: string): string {
  const preset = TEMPLATE_PRESETS[templateId];
  return preset ? preset.name : templateId.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Category labels for UI grouping
 */
export const CATEGORY_LABELS: Record<TemplatePreset["category"], string> = {
  education: "Education",
  advocacy: "Advocacy & Outreach",
  policy: "Policy & Research",
  general: "General Public",
  media: "Media & Social",
};

/**
 * Get category label
 */
export function getCategoryLabel(category: TemplatePreset["category"]): string {
  return CATEGORY_LABELS[category];
}
