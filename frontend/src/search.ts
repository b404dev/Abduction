export function regexError(query: string): string {
  try { new RegExp(query); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "Invalid regular expression"; }
}

// fuzzyScore implements fzf-style ordered matching; lower scores are better.
export function fuzzyScore(candidate: string, query: string): number | null {
  const haystack = candidate.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  let score = haystack.length - needle.length;
  let previousIndex = -2;
  let searchFrom = 0;
  for (const character of needle) {
    const matchIndex = haystack.indexOf(character, searchFrom);
    if (matchIndex < 0) return null;
    score += matchIndex - searchFrom;
    if (matchIndex === previousIndex + 1) score -= 4;
    if (matchIndex === 0 || "/._- ".includes(haystack[matchIndex - 1])) score -= 6;
    previousIndex = matchIndex;
    searchFrom = matchIndex + 1;
  }
  return score;
}

export function fuzzyFilter<T>(items: T[], query: string, text: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items.map((item, index) => ({ item, index, score: fuzzyScore(text(item), query) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.item);
}

// markTextMatches wraps literal or regular-expression matches without replacing syntax markup.
export function markTextMatches(rootElement: HTMLElement, query: string, useRegex = false): HTMLElement[] {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(useRegex ? query : escapedQuery, "gi");
  const textWalker = window.document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.parentElement?.closest("button") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const textNodes: Text[] = [];
  while (textWalker.nextNode()) textNodes.push(textWalker.currentNode as Text);
  const matches: HTMLElement[] = [];
  textNodes.forEach((textNode) => {
    const sourceText = textNode.nodeValue ?? "";
    const textMatches = Array.from(sourceText.matchAll(pattern));
    if (!textMatches.length || !textNode.parentNode) return;
    const fragment = window.document.createDocumentFragment();
    let searchOffset = 0;
    textMatches.forEach((textMatch) => {
      const matchOffset = textMatch.index ?? 0;
      const matchedText = textMatch[0];
      if (!matchedText) return;
      fragment.append(sourceText.slice(searchOffset, matchOffset));
      const matchElement = window.document.createElement("mark");
      matchElement.className = "code-search-match";
      matchElement.textContent = matchedText;
      matches.push(matchElement);
      fragment.append(matchElement);
      searchOffset = matchOffset + matchedText.length;
    });
    fragment.append(sourceText.slice(searchOffset));
    textNode.parentNode.replaceChild(fragment, textNode);
  });
  return matches;
}
