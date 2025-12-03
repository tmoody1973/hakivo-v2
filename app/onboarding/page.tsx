'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveOnboardingPreferences } from '@/lib/api/backend';
import { useAuth } from '@/lib/auth/auth-context';

// US States list
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'PR', name: 'Puerto Rico' },
];

// Interest categories matching backend USER_INTERESTS schema
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

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading, updateUser, user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [representatives, setRepresentatives] = useState<any[] | null>(null);
  const [stateLegislators, setStateLegislators] = useState<any[] | null>(null);
  const [district, setDistrict] = useState<any | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  // Step 1: Personal Information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [selectedState, setSelectedState] = useState('');

  // Step 2: Policy Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const handleInterestToggle = (interestName: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestName)
        ? prev.filter((name) => name !== interestName)
        : [...prev, interestName]
    );
  };

  const handleStep1Next = () => {
    if (!firstName.trim() || !lastName.trim() || !zipCode.trim() || !city.trim()) {
      alert('Please fill in all fields');
      return;
    }

    if (zipCode.length !== 5 || !/^\d+$/.test(zipCode)) {
      alert('Please enter a valid 5-digit ZIP code');
      return;
    }

    if (!selectedState) {
      alert('Please select your state');
      return;
    }

    setStep(2);
  };

  const handleComplete = async () => {
    console.log('[OnboardingPage] handleComplete called');
    console.log('[OnboardingPage] selectedInterests:', selectedInterests);
    console.log('[OnboardingPage] accessToken exists:', !!accessToken);
    console.log('[OnboardingPage] firstName:', firstName);
    console.log('[OnboardingPage] lastName:', lastName);
    console.log('[OnboardingPage] zipCode:', zipCode);
    console.log('[OnboardingPage] city:', city);

    if (selectedInterests.length === 0) {
      setError('Please select at least one policy interest');
      return;
    }

    if (!accessToken) {
      setError('Not authenticated. Please sign in again.');
      router.push('/auth/signin');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    console.log('[OnboardingPage] About to call saveOnboardingPreferences...');

    try {
      // Call onboarding endpoint with all data
      const response = await saveOnboardingPreferences(accessToken, {
        policyInterests: selectedInterests,
        firstName,
        lastName,
        zipCode,
        city,
        state: selectedState, // User-selected state (used as fallback if geocoding fails)
        briefingTime: '08:00', // Default to 8 AM
        briefingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // Default weekdays
        playbackSpeed: 1.0,
        autoplay: false,
        emailNotifications: true,
      });

      console.log('[OnboardingPage] saveOnboardingPreferences returned:', response);

      if (!response.success) {
        console.error('[OnboardingPage] Response not successful:', response.error);
        throw new Error(response.error?.message || 'Failed to save preferences');
      }

      console.log('[OnboardingPage] Response successful, data:', response.data);

      // Store representatives, state legislators, and district info from response
      // The backend returns representatives and district at the root level of response.data
      const responseData = response.data as any;
      if (responseData?.representatives) {
        console.log('[OnboardingPage] Found representatives:', responseData.representatives);
        setRepresentatives(responseData.representatives);
      }
      if (responseData?.stateLegislators) {
        console.log('[OnboardingPage] Found state legislators:', responseData.stateLegislators);
        setStateLegislators(responseData.stateLegislators);
      }
      if (responseData?.district) {
        console.log('[OnboardingPage] Found district:', responseData.district);
        setDistrict(responseData.district);
      }

      // Update user in auth context to mark onboarding as completed
      updateUser({
        firstName,
        lastName,
        email: user?.email || '',
        id: user?.id || '',
        emailVerified: user?.emailVerified || false,
        onboardingCompleted: true,
      } as any);

      // Move to step 3 to show representatives, or redirect if none found
      const hasReps = responseData?.representatives && responseData.representatives.length > 0;
      const hasStateLegislators = responseData?.stateLegislators && responseData.stateLegislators.length > 0;
      if (hasReps || hasStateLegislators) {
        setStep(3);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setError(error instanceof Error ? error.message : 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to Hakivo</CardTitle>
          <CardDescription>
            Let's personalize your legislative briefing experience
          </CardDescription>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span>Personal Info</span>
            <span>Policy Interests</span>
            <span>Your Representatives</span>
          </div>
        </CardHeader>

        <CardContent>
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Tell us about yourself</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  We'll use this information to personalize your experience and find your Congressional representatives.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium">First Name</label>
                  <Input
                    id="firstName"
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium">Last Name</label>
                  <Input
                    id="lastName"
                    placeholder="Johnson"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="zipCode" className="text-sm font-medium">ZIP Code</label>
                  <Input
                    id="zipCode"
                    placeholder="10001"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    maxLength={5}
                    required
                  />
                  <p className="text-sm text-gray-500">Used to find your Congressional district</p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="city" className="text-sm font-medium">City</label>
                  <Input
                    id="city"
                    placeholder="New York"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="state" className="text-sm font-medium">State</label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger id="state" className="w-full">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">Used to show state legislature bills</p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleStep1Next} size="lg">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Policy Interests */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Choose your policy interests</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Select topics you'd like to follow. We'll prioritize these in your daily briefings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {POLICY_INTERESTS.map((interest) => (
                  <button
                    key={interest.name}
                    onClick={() => handleInterestToggle(interest.name)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedInterests.includes(interest.name)
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{interest.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{interest.name}</div>
                      </div>
                      {selectedInterests.includes(interest.name) && (
                        <svg
                          className="w-5 h-5 text-blue-600"
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

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>{selectedInterests.length}</strong> interest{selectedInterests.length !== 1 ? 's' : ''} selected
                  {selectedInterests.length > 0 && ' • You can change these later in Settings'}
                </p>
              </div>

              <div className="flex justify-between pt-4">
                <Button onClick={() => setStep(1)} variant="outline" size="lg">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  size="lg"
                  disabled={isSubmitting || selectedInterests.length === 0}
                >
                  {isSubmitting ? 'Saving...' : 'Complete Setup'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Your Representatives */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Meet Your Representatives</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Based on your ZIP code {zipCode}, we found your federal and state representatives. We'll keep you informed about their voting activity and legislation they sponsor.
                </p>
                {district && (
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-4">
                    Your Congressional District: {district.congressionalDistrict}
                  </p>
                )}
              </div>

              {/* Federal Representatives Section */}
              {representatives && representatives.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span>🏛️</span> Federal Representatives
                  </h4>
                  <div className="grid gap-4">
                    {representatives.map((rep) => (
                      <div key={rep.bioguideId} className="border rounded-lg p-4 flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-lg">{rep.name}</h4>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              rep.party === 'Democratic' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                              rep.party === 'Republican' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}>
                              {rep.party}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {rep.chamber === 'Senate' ? 'U.S. Senator' : 'U.S. Representative'} from {rep.state}
                            {rep.district !== null && ` - District ${rep.district}`}
                          </p>
                          {rep.officeAddress && (
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              📍 {rep.officeAddress}
                            </p>
                          )}
                          {rep.phoneNumber && (
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              📞 {rep.phoneNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* State Legislators Section */}
              {stateLegislators && stateLegislators.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <span>🏢</span> State Legislators
                  </h4>
                  <div className="grid gap-4">
                    {stateLegislators.map((rep) => (
                      <div key={rep.id} className="border rounded-lg p-4 flex items-start gap-4">
                        {rep.imageUrl && (
                          <img
                            src={rep.imageUrl}
                            alt={rep.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-lg">{rep.name}</h4>
                            <span className={`text-sm px-2 py-1 rounded-full ${
                              rep.party === 'Democratic' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                              rep.party === 'Republican' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                              'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}>
                              {rep.party}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            {rep.chamber === 'upper' ? 'State Senator' : 'State Representative'}
                            {rep.district && ` - District ${rep.district}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {rep.state}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  ✓ Your preferences have been saved! We'll use this information to personalize your legislative briefings.
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={() => router.push('/dashboard')} size="lg">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
