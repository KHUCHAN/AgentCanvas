---
description: How to conduct and write a detailed UI/UX codebase review.
---

# UI/UX Codebase Review Workflow

When requested to review the UI/UX of an application or address UX pain points, you **MUST** follow this comprehensive methodology to ensure actionable, high-quality output.

## Core Tenets
1. **Never stop at just identifying the problem.** A problem without a solution is useless.
2. **Be specific to the codebase.** Do not provide generic UX advice. Point to specific React components, CSS classes, or internal states (e.g., `App.tsx`, `RightPanel.tsx`).
3. **Provide Before/After Code Examples.** Your review must include concrete code snippets showing exactly how to implement the suggested fix.

## Step-by-Step Workflow

1. **Analyze the Target Components**
   - Trace the user journey through the React component tree or HTML structure.
   - Look for state clashes (e.g., modal states overwriting each other, shared panel modes causing context loss).
   - Identify "Information Overload" (e.g., too many inputs in a single view).
   - Trace visual feedback logic (e.g., lack of loading spinners, missing transition states).

2. **Structure the Review Document**
   For each identified pain point, structure your finding exactly like this:

   ### 🚨 [Component Name] - [Short Issue Description]
   - **코드 분석 및 문제점 (Code Analysis & Problem):**
     - Explain *why* the code behaves this way (e.g., `onSelectNode` forces `setPanelMode("library")`).
     - Explain the UX impact (e.g., "The user loses their chat context").

   ### 🛠️ [Proposed Solution]
   - **해결 방안 및 코드 예시 (Improvement & Code Example):**
     - Describe the architectural change needed (e.g., "Decouple the Inspector into a separate floating layer").
     - Provide the **AS-IS** (Current) code snippet if helpful.
     - Provide the **TO-BE** (Fixed) code snippet. Ensure the code is realistic and applies to their tech stack.

3. **Key Areas to Always Check**
   - **Empty States (Onboarding):** Is the canvas/screen empty? Does it tell the user what to do? Add a Call-to-Action (CTA).
   - **Real-time Feedback:** Are there background tasks? Do they have progress bars or spinners?
   - **Form Usability:** Are settings modals too long? Use accordions or tabs to hide advanced settings.
   - **Context Preservation:** Do popups or tab switches destroy the user's current workflow (e.g., wiping out chat history or current form inputs)?

4. **Final Delivery**
   - Write the review in Markdown format.
   - Use emojis (🚨, 🛠️, 💡) to make the document highly readable and scannable.
   - Make sure your tone is proactive and helpful. Offer to implement the code snippets directly if the user approves.
