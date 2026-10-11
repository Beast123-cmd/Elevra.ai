/** Match a query when every word appears somewhere in the searchable text. */
export function matchesEveryWord(query: string, searchableText: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const searchableWords = normalize(searchableText).split(/\s+/).filter(Boolean);
  return words.every((word) => searchableWords.some((candidate) => candidate.startsWith(word)));
}
