/**
 * Words that name a subject, not a place or a house.
 *
 * Creating an "English" department should hand you the English subject; "Mangalore"
 * should not invent a Mangalore subject (founder, 2026-09-13). This decides only
 * whether the "also create a subject" tick starts on — the admin sees it and can
 * always change it, so a miss here costs one click, never a surprise.
 *
 * Source of truth for the mapping itself is the server's
 * paperhint-service/src/modules/subjects/subjectTaxonomy.js.
 */
const SUBJECT_WORDS = [
  "english",
  "hindi",
  "tamil",
  "sanskrit",
  "telugu",
  "kannada",
  "malayalam",
  "marathi",
  "french",
  "german",
  "urdu",
  "language",
  "mathematics",
  "maths",
  "math",
  "statistics",
  "science",
  "physics",
  "chemistry",
  "biology",
  "botany",
  "zoology",
  "environmentalscience",
  "evs",
  "socialscience",
  "social",
  "history",
  "geography",
  "civics",
  "economics",
  "politicalscience",
  "sociology",
  "psychology",
  "commerce",
  "accounts",
  "accountancy",
  "businessstudies",
  "business",
  "computerscience",
  "computers",
  "informationtechnology",
  "informationpractices",
  "art",
  "drawing",
  "painting",
  "music",
  "dance",
  "drama",
  "craft",
  "physicaleducation",
  "yoga",
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

/** True when the name reads as something taught, so the tick starts on. */
export function looksLikeSubject(
  name: string,
  existingSubjects: string[] = []
) {
  const n = norm(name)
  if (!n) return false
  if (existingSubjects.some((s) => norm(s) === n)) return true
  return SUBJECT_WORDS.some((w) => n === w || n.includes(w))
}
