import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";

export async function updateSkillFrontmatter(input: {
  skillFilePath: string;
  name: string;
  description: string;
  extraFrontmatter: Record<string, unknown>;
}): Promise<void> {
  try {
    const source = await readFile(input.skillFilePath, "utf8");
    const parsed = matter(source);

    const mergedData = {
      ...input.extraFrontmatter,
      name: input.name,
      description: input.description
    };

    const next = matter.stringify(parsed.content, mergedData);
    await writeFile(input.skillFilePath, next, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update frontmatter (${input.skillFilePath}): ${detail}`);
  }
}
