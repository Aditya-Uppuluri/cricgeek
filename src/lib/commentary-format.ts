export function beautifyCommentaryText(input: string): string {
  let text = input.replace(/\s+/g, " ").trim();

  if (!text) {
    return "";
  }

  // Normalize spacing around punctuation without breaking cricket over notation like 12.3
  text = text
    .replace(/\s+([,!?;:])/g, "$1")
    .replace(/([,!?;:])([^\s])/g, "$1 $2")
    .replace(/(?<!\d)\.(?=\S)/g, ". ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");

  text = text.replace(/\bi\b/g, "I");
  text = text.replace(/\s+/g, " ").trim();

  text = text.charAt(0).toUpperCase() + text.slice(1);
  text = text.replace(/([.!?]\s+)([a-z])/g, (_, boundary: string, letter: string) => {
    return boundary + letter.toUpperCase();
  });

  if (!/[.!?]$/.test(text)) {
    text += ".";
  }

  return text;
}
