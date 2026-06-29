/** Curated cartoony avatars via DiceBear (already used for defaults). */

const BASE = "https://api.dicebear.com/7.x";

export type AvatarCategory = "men" | "women" | "animals" | "fun";

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  url: string;
}

function dicebear(style: string, seed: string, backgroundColor?: string): string {
  const params = new URLSearchParams({ seed });
  if (backgroundColor) params.set("backgroundColor", backgroundColor);
  return `${BASE}/${style}/svg?${params.toString()}`;
}

function entry(
  id: string,
  label: string,
  category: AvatarCategory,
  style: string,
  seed: string,
  backgroundColor?: string
): AvatarOption {
  return { id, label, category, url: dicebear(style, seed, backgroundColor) };
}

export const AVATAR_CATEGORIES: { id: AvatarCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "men", label: "Guys" },
  { id: "women", label: "Gals" },
  { id: "animals", label: "Animals" },
  { id: "fun", label: "Fun" },
];

export const AVATAR_LIBRARY: AvatarOption[] = [
  // Guys — adventurer & avataaars
  entry("man-jack", "Jack", "men", "adventurer", "Jack"),
  entry("man-mike", "Mike", "men", "adventurer", "Mike"),
  entry("man-carlos", "Carlos", "men", "adventurer", "Carlos"),
  entry("man-omar", "Omar", "men", "adventurer", "Omar"),
  entry("man-diego", "Diego", "men", "adventurer", "Diego"),
  entry("man-marcus", "Marcus", "men", "adventurer", "Marcus"),
  entry("man-tyler", "Tyler", "men", "adventurer", "Tyler"),
  entry("man-vince", "Vince", "men", "adventurer", "Vince"),
  entry("man-rex", "Rex", "men", "adventurer", "Rex"),
  entry("man-brock", "Brock", "men", "adventurer", "Brock"),
  entry("man-felix", "Felix", "men", "avataaars", "Felix"),
  entry("man-oliver", "Oliver", "men", "avataaars", "Oliver"),
  entry("man-james", "James", "men", "avataaars", "James"),
  entry("man-ethan", "Ethan", "men", "avataaars", "Ethan"),
  entry("man-mason", "Mason", "men", "avataaars", "Mason"),
  entry("man-aiden", "Aiden", "men", "micah", "Aiden"),
  entry("man-noah", "Noah", "men", "micah", "Noah"),
  entry("man-liam", "Liam", "men", "micah", "Liam"),
  entry("man-jake", "Jake", "men", "micah", "Jake"),
  entry("man-ryan", "Ryan", "men", "micah", "Ryan"),
  entry("man-victor", "Victor", "men", "personas", "Victor"),
  entry("man-stefan", "Stefan", "men", "personas", "Stefan"),
  entry("man-arthur", "Arthur", "men", "notionists", "Arthur"),
  entry("man-bruce", "Bruce", "men", "notionists", "Bruce"),

  // Gals — lorelei & neutral styles
  entry("woman-sophia", "Sophia", "women", "lorelei", "Sophia"),
  entry("woman-emma", "Emma", "women", "lorelei", "Emma"),
  entry("woman-olivia", "Olivia", "women", "lorelei", "Olivia"),
  entry("woman-mia", "Mia", "women", "lorelei", "Mia"),
  entry("woman-zoe", "Zoe", "women", "lorelei", "Zoe"),
  entry("woman-luna", "Luna", "women", "lorelei", "Luna"),
  entry("woman-chloe", "Chloe", "women", "lorelei", "Chloe"),
  entry("woman-grace", "Grace", "women", "lorelei", "Grace"),
  entry("woman-nina", "Nina", "women", "lorelei", "Nina"),
  entry("woman-ruby", "Ruby", "women", "lorelei", "Ruby"),
  entry("woman-aria", "Aria", "women", "avataaars-neutral", "Aria"),
  entry("woman-bella", "Bella", "women", "avataaars-neutral", "Bella"),
  entry("woman-jade", "Jade", "women", "avataaars-neutral", "Jade"),
  entry("woman-alex", "Alex", "women", "adventurer-neutral", "Alex"),
  entry("woman-sam", "Sam", "women", "adventurer-neutral", "Sam"),
  entry("woman-jordan", "Jordan", "women", "adventurer-neutral", "Jordan"),
  entry("woman-casey", "Casey", "women", "adventurer-neutral", "Casey"),
  entry("woman-riley", "Riley", "women", "micah", "Riley"),
  entry("woman-quinn", "Quinn", "women", "micah", "Quinn"),

  // Animals — fun-emoji & big-ears cartoony critters
  entry("animal-cat", "Cat", "animals", "fun-emoji", "Cat", "ffd5dc"),
  entry("animal-dog", "Dog", "animals", "fun-emoji", "Dog", "c0aede"),
  entry("animal-lion", "Lion", "animals", "fun-emoji", "Lion", "ffdfbf"),
  entry("animal-bear", "Bear", "animals", "fun-emoji", "Bear", "d1d4f9"),
  entry("animal-fox", "Fox", "animals", "fun-emoji", "Fox", "ffd5dc"),
  entry("animal-panda", "Panda", "animals", "fun-emoji", "Panda", "c0aede"),
  entry("animal-owl", "Owl", "animals", "fun-emoji", "Owl", "ffdfbf"),
  entry("animal-frog", "Frog", "animals", "fun-emoji", "Frog", "b6e3f4"),
  entry("animal-monkey", "Monkey", "animals", "fun-emoji", "Monkey", "ffd5dc"),
  entry("animal-rabbit", "Rabbit", "animals", "fun-emoji", "Rabbit", "c0aede"),
  entry("animal-tiger", "Tiger", "animals", "fun-emoji", "Tiger", "ffdfbf"),
  entry("animal-wolf", "Wolf", "animals", "fun-emoji", "Wolf", "d1d4f9"),
  entry("animal-koala", "Koala", "animals", "big-ears", "Koala", "b6e3f4"),
  entry("animal-bunny", "Bunny", "animals", "big-ears", "Bunny", "ffd5dc"),
  entry("animal-mouse", "Mouse", "animals", "big-ears", "Mouse", "c0aede"),

  // Fun — robots, doodles, big smiles
  entry("fun-robot-1", "Robot", "fun", "bottts", "Robot-1", "b6e3f4"),
  entry("fun-robot-2", "Bot", "fun", "bottts", "Bot-2", "c0aede"),
  entry("fun-robot-3", "Droid", "fun", "bottts", "Droid-3", "d1d4f9"),
  entry("fun-robot-4", "Mech", "fun", "bottts", "Mech-4", "ffdfbf"),
  entry("fun-doodle-1", "Doodle", "fun", "croodles", "Doodle-1", "ffd5dc"),
  entry("fun-doodle-2", "Sketch", "fun", "croodles", "Sketch-2", "b6e3f4"),
  entry("fun-doodle-3", "Scribble", "fun", "croodles", "Scribble-3", "c0aede"),
  entry("fun-smile-1", "Sunny", "fun", "big-smile", "Sunny-1", "ffdfbf"),
  entry("fun-smile-2", "Cheery", "fun", "big-smile", "Cheery-2", "ffd5dc"),
  entry("fun-smile-3", "Grin", "fun", "big-smile", "Grin-3", "b6e3f4"),
  entry("fun-pixel-1", "Pixel", "fun", "pixel-art", "Pixel-1", "c0aede"),
  entry("fun-pixel-2", "8-Bit", "fun", "pixel-art", "8-Bit-2", "d1d4f9"),
];

const ALLOWED_URLS = new Set(AVATAR_LIBRARY.map((a) => a.url));

export function isAllowedAvatarUrl(url: string): boolean {
  return ALLOWED_URLS.has(url);
}

export function findAvatarByUrl(url: string | null | undefined): AvatarOption | undefined {
  if (!url) return undefined;
  return AVATAR_LIBRARY.find((a) => a.url === url);
}
