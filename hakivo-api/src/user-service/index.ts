import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  zipCode?: string;
  city?: string;
  congressionalDistrict?: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  createdAt: number;
}

interface UserPreferences {
  policyInterests: string[];
  briefingTime: string;
  briefingDays: string[];
  playbackSpeed: number;
  autoplay: boolean;
  emailNotifications: boolean;
  state?: string;
  district?: string;
  zipCode?: string;
  city?: string;
  // Document generation preferences
  docDefaultFormat?: 'presentation' | 'document' | 'webpage';
  docDefaultTemplate?: 'lesson_guide' | 'advocacy_deck' | 'policy_brief' | 'citizen_explainer' | 'news_summary' | 'executive_summary' | 'research_report' | 'social_share';
  docDefaultAudience?: string;
  docDefaultTone?: string;
  docAutoExportPdf?: boolean;
  docAutoEnrich?: boolean;
  docTextAmount?: 'brief' | 'medium' | 'detailed' | 'extensive';
  docImageSource?: 'stock' | 'ai' | 'none';
}

export default class extends Service<Env> {
  /**
   * Create a new user
   * Called by auth-service during registration
   */
  async createUser(data: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    zipCode?: string;
  }): Promise<User> {
    const db = this.env.APP_DB;

    // Look up Congressional district if zip code provided
    let districtInfo = null;
    if (data.zipCode) {
      try {
        districtInfo = await this.env.GEOCODIO_CLIENT.lookupDistrict(data.zipCode);
      } catch (error) {
        console.error('Failed to lookup district:', error);
        // Continue without district info
      }
    }

    const user: User = {
      id: data.id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      zipCode: data.zipCode,
      city: districtInfo?.city,
      congressionalDistrict: districtInfo?.congressionalDistrict,
      emailVerified: false,
      onboardingCompleted: false,
      createdAt: Date.now()
    };

    await db
      .prepare(
        `INSERT INTO users (
          id, email, first_name, last_name, zip_code, city,
          congressional_district, email_verified, onboarding_completed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.zipCode || null,
        user.city || null,
        user.congressionalDistrict || null,
        user.emailVerified ? 1 : 0,
        user.onboardingCompleted ? 1 : 0,
        user.createdAt
      )
      .run();

    console.log(`✓ User created: ${user.id} (${user.email})`);

    return user;
  }

  /**
   * Get user by ID
   * Called by auth-service and other services
   */
  async getUserById(userId: string): Promise<User | null> {
    const db = this.env.APP_DB;

    const result = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      email: result.email as string,
      firstName: result.first_name as string,
      lastName: result.last_name as string,
      zipCode: result.zip_code as string | undefined,
      city: result.city as string | undefined,
      congressionalDistrict: result.congressional_district as string | undefined,
      emailVerified: Boolean(result.email_verified),
      onboardingCompleted: Boolean(result.onboarding_completed),
      createdAt: result.created_at as number
    };
  }

  /**
   * Get user by email
   * Called by auth-service during login
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const db = this.env.APP_DB;

    const result = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (!result) {
      return null;
    }

    return {
      id: result.id as string,
      email: result.email as string,
      firstName: result.first_name as string,
      lastName: result.last_name as string,
      zipCode: result.zip_code as string | undefined,
      city: result.city as string | undefined,
      congressionalDistrict: result.congressional_district as string | undefined,
      emailVerified: Boolean(result.email_verified),
      onboardingCompleted: Boolean(result.onboarding_completed),
      createdAt: result.created_at as number
    };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const db = this.env.APP_DB;

    // Get current preferences or create default
    let current = await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .first();

    const updated: UserPreferences = {
      policyInterests: preferences.policyInterests || (current?.policy_interests ? JSON.parse(current.policy_interests as string) : []),
      briefingTime: preferences.briefingTime || current?.briefing_time as string || '08:00',
      briefingDays: preferences.briefingDays || (current?.briefing_days ? JSON.parse(current.briefing_days as string) : ['Monday', 'Wednesday', 'Friday']),
      playbackSpeed: preferences.playbackSpeed ?? (current?.playback_speed as number || 1.0),
      autoplay: preferences.autoplay ?? Boolean(current?.autoplay ?? true),
      emailNotifications: preferences.emailNotifications ?? Boolean(current?.email_notifications ?? true),
      state: preferences.state ?? (current?.state as string || ''),
      // Document generation preferences
      docDefaultFormat: preferences.docDefaultFormat ?? (current?.doc_default_format as UserPreferences['docDefaultFormat']) ?? 'presentation',
      docDefaultTemplate: preferences.docDefaultTemplate ?? (current?.doc_default_template as UserPreferences['docDefaultTemplate']) ?? 'policy_brief',
      docDefaultAudience: preferences.docDefaultAudience ?? (current?.doc_default_audience as string) ?? 'General audience',
      docDefaultTone: preferences.docDefaultTone ?? (current?.doc_default_tone as string) ?? 'Professional and informative',
      docAutoExportPdf: preferences.docAutoExportPdf ?? Boolean(current?.doc_auto_export_pdf ?? false),
      docAutoEnrich: preferences.docAutoEnrich ?? (current?.doc_auto_enrich !== undefined ? Boolean(current.doc_auto_enrich) : true),
      docTextAmount: preferences.docTextAmount ?? (current?.doc_text_amount as UserPreferences['docTextAmount']) ?? 'medium',
      docImageSource: preferences.docImageSource ?? (current?.doc_image_source as UserPreferences['docImageSource']) ?? 'stock',
    };

    if (current) {
      // Update existing
      await db
        .prepare(
          `UPDATE user_preferences SET
            policy_interests = ?,
            briefing_time = ?,
            briefing_days = ?,
            playback_speed = ?,
            autoplay = ?,
            email_notifications = ?,
            state = ?,
            doc_default_format = ?,
            doc_default_template = ?,
            doc_default_audience = ?,
            doc_default_tone = ?,
            doc_auto_export_pdf = ?,
            doc_auto_enrich = ?,
            doc_text_amount = ?,
            doc_image_source = ?
          WHERE user_id = ?`
        )
        .bind(
          JSON.stringify(updated.policyInterests),
          updated.briefingTime,
          JSON.stringify(updated.briefingDays),
          updated.playbackSpeed,
          updated.autoplay ? 1 : 0,
          updated.emailNotifications ? 1 : 0,
          updated.state,
          updated.docDefaultFormat,
          updated.docDefaultTemplate,
          updated.docDefaultAudience,
          updated.docDefaultTone,
          updated.docAutoExportPdf ? 1 : 0,
          updated.docAutoEnrich ? 1 : 0,
          updated.docTextAmount,
          updated.docImageSource,
          userId
        )
        .run();
    } else {
      // Insert new
      await db
        .prepare(
          `INSERT INTO user_preferences (
            user_id, policy_interests, briefing_time, briefing_days,
            playback_speed, autoplay, email_notifications, state,
            doc_default_format, doc_default_template, doc_default_audience, doc_default_tone,
            doc_auto_export_pdf, doc_auto_enrich, doc_text_amount, doc_image_source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          userId,
          JSON.stringify(updated.policyInterests),
          updated.briefingTime,
          JSON.stringify(updated.briefingDays),
          updated.playbackSpeed,
          updated.autoplay ? 1 : 0,
          updated.emailNotifications ? 1 : 0,
          updated.state,
          updated.docDefaultFormat,
          updated.docDefaultTemplate,
          updated.docDefaultAudience,
          updated.docDefaultTone,
          updated.docAutoExportPdf ? 1 : 0,
          updated.docAutoEnrich ? 1 : 0,
          updated.docTextAmount,
          updated.docImageSource
        )
        .run();
    }

    console.log(`✓ Preferences updated for user: ${userId}`);

    return updated;
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const db = this.env.APP_DB;

    const result = await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .bind(userId)
      .first();

    if (!result) {
      // Return defaults
      return {
        policyInterests: [],
        briefingTime: '08:00',
        briefingDays: ['Monday', 'Wednesday', 'Friday'],
        playbackSpeed: 1.0,
        autoplay: true,
        emailNotifications: true,
        state: undefined,
        district: undefined,
        zipCode: undefined,
        city: undefined,
        // Document generation defaults
        docDefaultFormat: 'presentation',
        docDefaultTemplate: 'policy_brief',
        docDefaultAudience: 'General audience',
        docDefaultTone: 'Professional and informative',
        docAutoExportPdf: false,
        docAutoEnrich: true,
        docTextAmount: 'medium',
        docImageSource: 'stock',
      };
    }

    // Safely parse JSON fields with fallbacks
    let policyInterests = [];
    if (result.policy_interests) {
      try {
        policyInterests = JSON.parse(result.policy_interests as string);
      } catch (e) {
        console.error('Failed to parse policy_interests:', e);
        policyInterests = [];
      }
    }

    let briefingDays = ['Monday', 'Wednesday', 'Friday'];
    if (result.briefing_days) {
      try {
        briefingDays = JSON.parse(result.briefing_days as string);
      } catch (e) {
        console.error('Failed to parse briefing_days:', e);
        briefingDays = ['Monday', 'Wednesday', 'Friday'];
      }
    }

    return {
      policyInterests,
      briefingTime: result.briefing_time as string || '08:00',
      briefingDays,
      playbackSpeed: result.playback_speed as number || 1.0,
      autoplay: Boolean(result.autoplay),
      emailNotifications: Boolean(result.email_notifications),
      state: result.state as string | undefined,
      district: result.district as string | undefined,
      zipCode: result.zipcode as string | undefined,
      city: result.city as string | undefined,
      // Document generation preferences
      docDefaultFormat: (result.doc_default_format as 'presentation' | 'document' | 'webpage') || 'presentation',
      docDefaultTemplate: (result.doc_default_template as UserPreferences['docDefaultTemplate']) || 'policy_brief',
      docDefaultAudience: (result.doc_default_audience as string) || 'General audience',
      docDefaultTone: (result.doc_default_tone as string) || 'Professional and informative',
      docAutoExportPdf: Boolean(result.doc_auto_export_pdf),
      docAutoEnrich: result.doc_auto_enrich !== undefined ? Boolean(result.doc_auto_enrich) : true,
      docTextAmount: (result.doc_text_amount as 'brief' | 'medium' | 'detailed' | 'extensive') || 'medium',
      docImageSource: (result.doc_image_source as 'stock' | 'ai' | 'none') || 'stock',
    };
  }

  /**
   * Mark onboarding as completed
   */
  async completeOnboarding(userId: string): Promise<void> {
    const db = this.env.APP_DB;

    await db
      .prepare('UPDATE users SET onboarding_completed = ? WHERE id = ?')
      .bind(1, userId)
      .run();

    console.log(`✓ Onboarding completed for user: ${userId}`);
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
