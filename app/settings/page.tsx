'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { getUserPreferences, updateUserProfile, updateUserPreferences } from '@/lib/api/backend';

const POLICY_INTERESTS = [
  { name: 'Environment & Energy', icon: '🌱' },
  { name: 'Health & Social Welfare', icon: '🏥' },
  { name: 'Economy & Finance', icon: '💰' },
  { name: 'Education & Science', icon: '🎓' },
  { name: 'Civil Rights & Law', icon: '⚖️' },
  { name: 'Commerce & Labor', icon: '🏭' },
  { name: 'Government & Politics', icon: '🏛️' },
  { name: 'Foreign Policy & Defense', icon: '🌍' },
  { name: 'Housing & Urban Development', icon: '🏘️' },
  { name: 'Agriculture & Food', icon: '🌾' },
  { name: 'Sports, Arts & Culture', icon: '🎨' },
  { name: 'Immigration & Indigenous Issues', icon: '🗽' },
];

const US_STATES = [
  { abbr: '', name: 'Select your state' },
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'DC', name: 'District of Columbia' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'PR', name: 'Puerto Rico' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
];

export default function SettingsPage() {
  const { accessToken, refreshToken, user, updateAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [userState, setUserState] = useState('');
  const [congressionalDistrict, setCongressionalDistrict] = useState('');

  // Policy interests state
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Preferences state
  const [briefingTime, setBriefingTime] = useState('08:00');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoplay, setAutoplay] = useState(false);

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      if (!accessToken) return;

      try {
        console.log('[Settings] Loading user preferences...');
        console.log('[Settings] Access token:', accessToken ? 'present' : 'missing');
        console.log('[Settings] Refresh token:', refreshToken ? 'present' : 'missing');

        // Pass refresh token and callback to update access token if it expires
        const response = await getUserPreferences(
          accessToken,
          refreshToken || undefined,
          (newAccessToken) => {
            console.log('[Settings] Access token refreshed, updating auth context');
            updateAccessToken(newAccessToken);
          }
        );

        console.log('[Settings] Response:', response);
        if (response.success && response.data) {
          console.log('[Settings] User preferences loaded:', response.data);

          // Set user profile data
          setFirstName(user?.firstName || '');
          setLastName(user?.lastName || '');
          setEmail(user?.email || '');
          setCity(response.data.city || '');
          setZipCode(response.data.zipCode || '');
          setUserState(response.data.state || '');
          setCongressionalDistrict(
            response.data.congressionalDistrict ||
            (response.data.state && response.data.district
              ? `${response.data.state}-${response.data.district}`
              : '')
          );

          // Set policy interests
          setSelectedInterests(response.data.policyInterests || []);

          // Set other preferences
          setBriefingTime(response.data.briefingTime || '08:00');
          setEmailNotifications(response.data.emailNotifications !== false);
          setPlaybackSpeed(response.data.playbackSpeed || 1.0);
          setAutoplay(response.data.autoPlay || false);
        }
      } catch (error) {
        console.error('[Settings] Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [accessToken, refreshToken, user, updateAccessToken]);

  const handleInterestToggle = (interestName: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestName)
        ? prev.filter((name) => name !== interestName)
        : [...prev, interestName]
    );
  };

  const handleSaveProfile = async () => {
    if (!accessToken) {
      alert('Not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      // Update user profile (name only)
      await updateUserProfile(accessToken, {
        firstName,
        lastName,
      });

      // Update preferences (includes zipCode and state if changed)
      await updateUserPreferences(accessToken, {
        policyInterests: selectedInterests,
        zipCode,
        state: userState,
        briefingTime,
        emailNotifications,
        playbackSpeed,
        autoPlay: autoplay,
      });

      alert('Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!accessToken) {
      alert('Not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserPreferences(accessToken, {
        policyInterests: selectedInterests,
        briefingTime,
        emailNotifications,
        playbackSpeed,
        autoPlay: autoplay,
      });
      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full px-6 md:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex md:flex-col gap-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'profile'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('interests')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'interests'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Policy Interests
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'notifications'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'audio'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Audio
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 py-2 text-sm font-medium rounded-md text-left ${
              activeTab === 'account'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            Account
          </button>
        </nav>

        <div className="space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Profile Information</h2>
                <p className="text-sm text-muted-foreground">
                  Update your personal information and location
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">ZIP Code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      maxLength={5}
                      className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">State</label>
                  <select
                    value={userState}
                    onChange={(e) => setUserState(e.target.value)}
                    className="w-full px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {US_STATES.map((state) => (
                      <option key={state.abbr} value={state.abbr}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Used to show state legislation relevant to you
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Congressional District</label>
                  <input
                    type="text"
                    value={congressionalDistrict || 'Not set'}
                    disabled
                    className="w-full px-3 py-2 bg-muted border rounded-md text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically determined from your ZIP code
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveProfile}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Changes
                </button>
                <button className="px-4 py-2 border rounded-md hover:bg-accent">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Policy Interests Tab */}
          {activeTab === 'interests' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Policy Interests</h2>
                <p className="text-sm text-muted-foreground">
                  Select topics you'd like to follow in your daily briefings
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {POLICY_INTERESTS.map((interest) => (
                  <button
                    key={interest.name}
                    onClick={() => handleInterestToggle(interest.name)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedInterests.includes(interest.name)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{interest.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{interest.name}</div>
                      </div>
                      {selectedInterests.includes(interest.name) && (
                        <svg
                          className="w-5 h-5 text-primary"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  <strong>{selectedInterests.length}</strong> interest{selectedInterests.length !== 1 ? 's' : ''} selected
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Brief Delivery Time</label>
                  <select
                    value={briefingTime}
                    onChange={(e) => setBriefingTime(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="06:00">6:00 AM</option>
                    <option value="07:00">7:00 AM</option>
                    <option value="08:00">8:00 AM</option>
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Notifications</h2>
                <p className="text-sm text-muted-foreground">
                  Manage how you receive updates
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive daily brief notifications via email
                    </p>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      emailNotifications ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailNotifications ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Bill Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Notify when tracked bills have new actions
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Summary</p>
                    <p className="text-sm text-muted-foreground">
                      Receive weekly recap of legislative activity
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Audio Preferences</h2>
                <p className="text-sm text-muted-foreground">
                  Customize your listening experience
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Playback Speed</label>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="w-full md:w-64 px-3 py-2 bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="0.75">0.75x</option>
                    <option value="1.0">1.0x (Normal)</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="1.75">1.75x</option>
                    <option value="2.0">2.0x</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Autoplay Next Brief</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically play the next brief after current one ends
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoplay(!autoplay)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      autoplay ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        autoplay ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Skip Intro/Outro</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically skip intro and outro segments
                    </p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="rounded-lg border bg-card p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Account Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your account and security
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="font-medium">Change Password</h3>
                  <button className="px-4 py-2 border rounded-md hover:bg-accent">
                    Update Password
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Connected Accounts</h3>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        G
                      </div>
                      <div>
                        <p className="font-medium">Google</p>
                        <p className="text-sm text-muted-foreground">{email}</p>
                      </div>
                    </div>
                    <button className="text-sm text-destructive hover:underline">
                      Disconnect
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <h3 className="font-medium text-destructive">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                  <button className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
