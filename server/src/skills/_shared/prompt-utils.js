// server/src/skills/_shared/prompt-utils.js

/**
 * Wrap a system prompt and user input into a safe prompt using XML delimiters.
 * Prevents prompt injection by clearly separating system instructions from user data.
 *
 * @param {string} systemPrompt - The skill's system prompt
 * @param {string} userInput - The user-provided input (potentially untrusted)
 * @returns {string}
 */
export function buildSafePrompt(systemPrompt, userInput) {
  return `${systemPrompt}

<user_input>
${userInput}
</user_input>`;
}
