import type { LeaderboardResponse, UserProfileResponse } from './types';

const isMocked = true;

// Use import.meta.glob to eagerly load all fixtures for the mock mode
// This is more robust in Vite than dynamic string-based imports
const userFixtures = import.meta.glob('./fixtures/users/*.json', { eager: true });
const leaderboardFixture = import.meta.glob('./fixtures/leaderboard.json', { eager: true });

export async function fetchLeaderboard(days: number): Promise<LeaderboardResponse> {
  console.log('Fetching leaderboard for days:', days);
  if (isMocked) {
    const data = leaderboardFixture['./fixtures/leaderboard.json'] as any;
    return { ...data.default, days_window: days } as LeaderboardResponse;
  }
  
  const response = await fetch(`/api/leaderboard?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch leaderboard');
  return response.json();
}

export async function fetchUserProfile(author: string, days: number): Promise<UserProfileResponse> {
  console.log('Fetching user profile for:', author, 'days:', days);
  if (isMocked) {
    const key = `./fixtures/users/${author}.json`;
    const data = userFixtures[key] as any;
    
    if (!data) {
      console.error(`Mock data for ${author} not found in keys:`, Object.keys(userFixtures));
      throw new Error(`Mock data for ${author} not found`);
    }
    
    return data.default as UserProfileResponse;
  }

  const response = await fetch(`/api/users/${author}?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch user profile');
  return response.json();
}
