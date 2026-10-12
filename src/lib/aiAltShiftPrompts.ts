const ALTSHIFT_AI_PROMPT = `Tell me how I could use AltShift (https://www.altshift.ca) in my company or personal life. AltShift is a Canadian services marketplace where clients can find professionals, request quotes, and book services; professionals can publish services, receive requests, send quotes, and manage bookings. Suggest concrete ways I could use the marketplace, and relate them to my goals, work, and preferences using saved memories or prior conversations that are already available to you in your own account. You cannot access my browser cache, AltShift account, or private AltShift data through this link. Do not imply that you can. If you have no relevant saved context, say so and ask me a couple of useful questions.`;

const promptQuery = encodeURIComponent(ALTSHIFT_AI_PROMPT);

export const ALTSHIFT_AI_PROMPT_LINKS = {
  claude: `https://claude.ai/new?q=${promptQuery}`,
  chatgpt: `https://chatgpt.com/?q=${promptQuery}`,
} as const;
