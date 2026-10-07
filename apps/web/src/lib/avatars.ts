/** Curated cartoony avatars from DiceBear (CC BY 4.0), served from /public/avatars. */

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";

export type AvatarCategory = "men" | "women" | "animals" | "fun";

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  url: string;
}

interface AvatarSource {
  id: string;
  label: string;
  category: AvatarCategory;
  style: string;
  seed: string;
  backgroundColor?: string;
}

function dicebear(style: string, seed: string, backgroundColor?: string): string {
  const params = new URLSearchParams({ seed });
  if (backgroundColor) params.set("backgroundColor", backgroundColor);
  return `${DICEBEAR_BASE}/${style}/svg?${params.toString()}`;
}

function localPath(id: string): string {
  return `/avatars/${id}.svg`;
}

/** Style/seed pairs used to generate the checked-in SVGs (and to map legacy API URLs). */
export const AVATAR_SOURCES: AvatarSource[] = [
  // Guys — adventurer & avataaars
  { id: "man-jack", label: "Jack", category: "men", style: "adventurer", seed: "Jack" },
  { id: "man-mike", label: "Mike", category: "men", style: "adventurer", seed: "Mike" },
  { id: "man-carlos", label: "Carlos", category: "men", style: "adventurer", seed: "Carlos" },
  { id: "man-omar", label: "Omar", category: "men", style: "adventurer", seed: "Omar" },
  { id: "man-diego", label: "Diego", category: "men", style: "adventurer", seed: "Diego" },
  { id: "man-marcus", label: "Marcus", category: "men", style: "adventurer", seed: "Marcus" },
  { id: "man-tyler", label: "Tyler", category: "men", style: "adventurer", seed: "Tyler" },
  { id: "man-vince", label: "Vince", category: "men", style: "adventurer", seed: "Vince" },
  { id: "man-rex", label: "Rex", category: "men", style: "adventurer", seed: "Rex" },
  { id: "man-brock", label: "Brock", category: "men", style: "adventurer", seed: "Brock" },
  { id: "man-felix", label: "Felix", category: "men", style: "avataaars", seed: "Felix" },
  { id: "man-oliver", label: "Oliver", category: "men", style: "avataaars", seed: "Oliver" },
  { id: "man-james", label: "James", category: "men", style: "avataaars", seed: "James" },
  { id: "man-ethan", label: "Ethan", category: "men", style: "avataaars", seed: "Ethan" },
  { id: "man-mason", label: "Mason", category: "men", style: "avataaars", seed: "Mason" },
  { id: "man-aiden", label: "Aiden", category: "men", style: "micah", seed: "Aiden" },
  { id: "man-noah", label: "Noah", category: "men", style: "micah", seed: "Noah" },
  { id: "man-liam", label: "Liam", category: "men", style: "micah", seed: "Liam" },
  { id: "man-jake", label: "Jake", category: "men", style: "micah", seed: "Jake" },
  { id: "man-ryan", label: "Ryan", category: "men", style: "micah", seed: "Ryan" },
  { id: "man-victor", label: "Victor", category: "men", style: "personas", seed: "Victor" },
  { id: "man-stefan", label: "Stefan", category: "men", style: "personas", seed: "Stefan" },
  { id: "man-arthur", label: "Arthur", category: "men", style: "notionists", seed: "Arthur" },
  { id: "man-bruce", label: "Bruce", category: "men", style: "notionists", seed: "Bruce" },

  // Gals — lorelei & neutral styles
  { id: "woman-sophia", label: "Sophia", category: "women", style: "lorelei", seed: "Sophia" },
  { id: "woman-emma", label: "Emma", category: "women", style: "lorelei", seed: "Emma" },
  { id: "woman-olivia", label: "Olivia", category: "women", style: "lorelei", seed: "Olivia" },
  { id: "woman-mia", label: "Mia", category: "women", style: "lorelei", seed: "Mia" },
  { id: "woman-zoe", label: "Zoe", category: "women", style: "lorelei", seed: "Zoe" },
  { id: "woman-luna", label: "Luna", category: "women", style: "lorelei", seed: "Luna" },
  { id: "woman-chloe", label: "Chloe", category: "women", style: "lorelei", seed: "Chloe" },
  { id: "woman-grace", label: "Grace", category: "women", style: "lorelei", seed: "Grace" },
  { id: "woman-nina", label: "Nina", category: "women", style: "lorelei", seed: "Nina" },
  { id: "woman-ruby", label: "Ruby", category: "women", style: "lorelei", seed: "Ruby" },
  { id: "woman-aria", label: "Aria", category: "women", style: "avataaars-neutral", seed: "Aria" },
  { id: "woman-bella", label: "Bella", category: "women", style: "avataaars-neutral", seed: "Bella" },
  { id: "woman-jade", label: "Jade", category: "women", style: "avataaars-neutral", seed: "Jade" },
  { id: "woman-alex", label: "Alex", category: "women", style: "adventurer-neutral", seed: "Alex" },
  { id: "woman-sam", label: "Sam", category: "women", style: "adventurer-neutral", seed: "Sam" },
  { id: "woman-jordan", label: "Jordan", category: "women", style: "adventurer-neutral", seed: "Jordan" },
  { id: "woman-casey", label: "Casey", category: "women", style: "adventurer-neutral", seed: "Casey" },
  { id: "woman-riley", label: "Riley", category: "women", style: "micah", seed: "Riley" },
  { id: "woman-quinn", label: "Quinn", category: "women", style: "micah", seed: "Quinn" },

  // Animals — fun-emoji & big-ears cartoony critters
  { id: "animal-cat", label: "Cat", category: "animals", style: "fun-emoji", seed: "Cat", backgroundColor: "ffd5dc" },
  { id: "animal-dog", label: "Dog", category: "animals", style: "fun-emoji", seed: "Dog", backgroundColor: "c0aede" },
  { id: "animal-lion", label: "Lion", category: "animals", style: "fun-emoji", seed: "Lion", backgroundColor: "ffdfbf" },
  { id: "animal-bear", label: "Bear", category: "animals", style: "fun-emoji", seed: "Bear", backgroundColor: "d1d4f9" },
  { id: "animal-fox", label: "Fox", category: "animals", style: "fun-emoji", seed: "Fox", backgroundColor: "ffd5dc" },
  { id: "animal-panda", label: "Panda", category: "animals", style: "fun-emoji", seed: "Panda", backgroundColor: "c0aede" },
  { id: "animal-owl", label: "Owl", category: "animals", style: "fun-emoji", seed: "Owl", backgroundColor: "ffdfbf" },
  { id: "animal-frog", label: "Frog", category: "animals", style: "fun-emoji", seed: "Frog", backgroundColor: "b6e3f4" },
  { id: "animal-monkey", label: "Monkey", category: "animals", style: "fun-emoji", seed: "Monkey", backgroundColor: "ffd5dc" },
  { id: "animal-rabbit", label: "Rabbit", category: "animals", style: "fun-emoji", seed: "Rabbit", backgroundColor: "c0aede" },
  { id: "animal-tiger", label: "Tiger", category: "animals", style: "fun-emoji", seed: "Tiger", backgroundColor: "ffdfbf" },
  { id: "animal-wolf", label: "Wolf", category: "animals", style: "fun-emoji", seed: "Wolf", backgroundColor: "d1d4f9" },
  { id: "animal-koala", label: "Koala", category: "animals", style: "big-ears", seed: "Koala", backgroundColor: "b6e3f4" },
  { id: "animal-bunny", label: "Bunny", category: "animals", style: "big-ears", seed: "Bunny", backgroundColor: "ffd5dc" },
  { id: "animal-mouse", label: "Mouse", category: "animals", style: "big-ears", seed: "Mouse", backgroundColor: "c0aede" },

  // Fun — robots, doodles, big smiles
  { id: "fun-robot-1", label: "Robot", category: "fun", style: "bottts", seed: "Robot-1", backgroundColor: "b6e3f4" },
  { id: "fun-robot-2", label: "Bot", category: "fun", style: "bottts", seed: "Bot-2", backgroundColor: "c0aede" },
  { id: "fun-robot-3", label: "Droid", category: "fun", style: "bottts", seed: "Droid-3", backgroundColor: "d1d4f9" },
  { id: "fun-robot-4", label: "Mech", category: "fun", style: "bottts", seed: "Mech-4", backgroundColor: "ffdfbf" },
  { id: "fun-doodle-1", label: "Doodle", category: "fun", style: "croodles", seed: "Doodle-1", backgroundColor: "ffd5dc" },
  { id: "fun-doodle-2", label: "Sketch", category: "fun", style: "croodles", seed: "Sketch-2", backgroundColor: "b6e3f4" },
  { id: "fun-doodle-3", label: "Scribble", category: "fun", style: "croodles", seed: "Scribble-3", backgroundColor: "c0aede" },
  { id: "fun-smile-1", label: "Sunny", category: "fun", style: "big-smile", seed: "Sunny-1", backgroundColor: "ffdfbf" },
  { id: "fun-smile-2", label: "Cheery", category: "fun", style: "big-smile", seed: "Cheery-2", backgroundColor: "ffd5dc" },
  { id: "fun-smile-3", label: "Grin", category: "fun", style: "big-smile", seed: "Grin-3", backgroundColor: "b6e3f4" },
  { id: "fun-pixel-1", label: "Pixel", category: "fun", style: "pixel-art", seed: "Pixel-1", backgroundColor: "c0aede" },
  { id: "fun-pixel-2", label: "8-Bit", category: "fun", style: "pixel-art", seed: "8-Bit-2", backgroundColor: "d1d4f9" },
];

export const AVATAR_CATEGORIES: { id: AvatarCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "men", label: "Guys" },
  { id: "women", label: "Gals" },
  { id: "animals", label: "Animals" },
  { id: "fun", label: "Fun" },
];

export const AVATAR_LIBRARY: AvatarOption[] = AVATAR_SOURCES.map((source) => ({
  id: source.id,
  label: source.label,
  category: source.category,
  url: localPath(source.id),
}));

const LEGACY_TO_LOCAL = new Map(
  AVATAR_SOURCES.map((source) => [
    dicebear(source.style, source.seed, source.backgroundColor),
    localPath(source.id),
  ])
);

const ALLOWED_URLS = new Set<string>([
  ...AVATAR_LIBRARY.map((avatar) => avatar.url),
  ...LEGACY_TO_LOCAL.keys(),
]);

export function isAllowedAvatarUrl(url: string): boolean {
  return ALLOWED_URLS.has(url);
}

/** Map a previously saved DiceBear HTTP URL onto the local asset. */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return LEGACY_TO_LOCAL.get(url) ?? url;
}

export function findAvatarByUrl(url: string | null | undefined): AvatarOption | undefined {
  const resolved = resolveAvatarUrl(url);
  if (!resolved) return undefined;
  return AVATAR_LIBRARY.find((avatar) => avatar.url === resolved);
}
