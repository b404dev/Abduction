export function regexError(query: string): string {
  try { new RegExp(query); return ""; }
  catch (reason) { return reason instanceof Error ? reason.message : "Invalid regular expression"; }
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
