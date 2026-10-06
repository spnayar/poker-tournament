export type ProfileSetupUser = {
  displayNameSet: boolean;
  avatarUrl: string | null | undefined;
};

/** True until the player confirms a display name and picks an avatar. */
export function needsProfileSetup(user: ProfileSetupUser): boolean {
  return !user.displayNameSet || !user.avatarUrl;
}

export const PROFILE_PROMPT_DISMISS_KEY = "poker-profile-prompt-dismissed";
