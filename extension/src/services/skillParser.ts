import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import matter from "gray-matter";
import type { Skill } from "../types";
import { validateSkillMeta } from "./skillValidator";

export async function parseSkillFile(input: {
  filePath: string;
  scope: Skill["scope"];
  providerId: string;
  ownerAgentId: string;
}): Promise<Skill> {
  try {
    const source = await readFile(input.filePath, "utf8");
    const parsed = matter(source);
    const folderName = basename(dirname(input.filePath));

    const name = typeof parsed.data.name === "string" ? parsed.data.name : folderName;
    const description = typeof parsed.data.description === "string" ? parsed.data.description : "";

    const validation = validateSkillMeta({
      name: parsed.data.name,
      description: parsed.data.description,
      folderName,
      body: parsed.content
    });

    const extraFrontmatter = { ...parsed.data };
    delete (extraFrontmatter as Record<string, unknown>).name;
    delete (extraFrontmatter as Record<string, unknown>).description;

    return {
      id: input.filePath,
      ownerAgentId: input.ownerAgentId,
      name,
      description,
      path: input.filePath,
      folderName,
      scope: input.scope,
      providerId: input.providerId,
      enabled: true,
      extraFrontmatter,
      validation
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse skill file (${input.filePath}): ${detail}`);
  }
}
