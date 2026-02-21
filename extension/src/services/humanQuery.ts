export type ParsedHumanQuery = {
  question: string;
};

export function parseHumanQuery(output: string): ParsedHumanQuery | undefined {
  const tagged = output.match(/\[NEED_HUMAN:\s*([\s\S]*?)\]/i);
  if (tagged) {
    const question = tagged[1].trim();
    if (question.length > 0) {
      return { question };
    }
  }

  // Backward compatibility with older prompts that used [NEED_HUMAN] suffix style.
  const fallbackTagged = output.match(/\[NEED_HUMAN\]([\s\S]*)$/i);
  if (!fallbackTagged) {
    return undefined;
  }
  const question = fallbackTagged[1].trim();
  if (!question) {
    return undefined;
  }
  return { question };
}
