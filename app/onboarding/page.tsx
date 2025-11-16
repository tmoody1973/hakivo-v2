'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { updateUserProfile, saveOnboardingPreferences } from '@/lib/api/backend';

const POLICY_INTERESTS = [
  { id: 'environment-energy', label: 'Environment & Energy', icon: '🌱' },
  { id: 'health-welfare', label: 'Health & Social Welfare', icon: '🏥' },
  { id: 'economy-finance', label: 'Economy & Finance', icon: '💰' },
  { id: 'education-science', label: 'Education & Science', icon: '🎓' },
  { id: 'civil-rights-law', label: 'Civil Rights & Law', icon: '⚖️' },
  { id: 'commerce-labor', label: 'Commerce & Labor', icon: '🏭' },
  { id: 'government-politics', label: 'Government & Politics', icon: '🏛️' },
  { id: 'foreign-policy-defense', label: 'Foreign Policy & Defense', icon: '🌍' },
  { id: 'housing-urban', label: 'Housing & Urban Development', icon: '🏘️' },
  { id: 'agriculture-food', label: 'Agriculture & Food', icon: '🌾' },
  { id: 'sports-arts-culture', label: 'Sports, Arts & Culture', icon: '🎨' },
  { id: 'immigration-indigenous', label: 'Immigration & Indigenous Issues', icon: '🗽' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Personal Information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');

  // Step 2: Policy Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const handleInterestToggle = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId]
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

    setStep(2);
  };

  const handleComplete = async () => {
    if (selectedInterests.length === 0) {
      alert('Please select at least one policy interest');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Get actual access token from WorkOS session
      const mockAccessToken = 'mock_access_token';

      // Save user profile
      const profileResponse = await updateUserProfile(mockAccessToken, {
        firstName,
        lastName,
        zipCode,
        city,
      });

      if (!profileResponse.success) {
        throw new Error('Failed to save profile');
      }

      // Save onboarding preferences
      const preferencesResponse = await saveOnboardingPreferences(mockAccessToken, {
        policyInterests: selectedInterests,
        briefingTime: '08:00', // Default to 8 AM
        briefingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], // Default weekdays
        playbackSpeed: 1.0,
        autoplay: false,
        emailNotifications: true,
      });

      if (!preferencesResponse.success) {
        throw new Error('Failed to save preferences');
      }

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      alert('Failed to complete onboarding. Please try again.');
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
          </div>
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span>Personal Info</span>
            <span>Policy Interests</span>
          </div>
        </CardHeader>

        <CardContent>
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
                    key={interest.id}
                    onClick={() => handleInterestToggle(interest.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedInterests.includes(interest.id)
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{interest.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{interest.label}</div>
                      </div>
                      {selectedInterests.includes(interest.id) && (
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
        </CardContent>
      </Card>
    </div>
  );
}
