const fetch = require('node-fetch');

/**
 * Generate text using OpenAI GPT
 * @param {string} userPrompt - The user prompt
 * @param {string} systemPrompt - The system prompt
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model to use (default: gpt-3.5-turbo)
 * @param {number} maxTokens - Maximum tokens (default: 150)
 * @param {number} temperature - Temperature (default: 0.7)
 * @returns {Promise<string>} Generated text
 */
async function generateText(userPrompt, systemPrompt, apiKey, model = 'gpt-3.5-turbo', maxTokens = 150, temperature = 0.7) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    max_tokens: maxTokens,
    temperature: temperature
  };

  try {
    console.log('🤖 Generating search keyword with OpenAI...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && data.choices && data.choices.length > 0) {
      const generatedText = data.choices[0].message.content.trim();
      console.log(`🎯 Generated search keyword: "${generatedText}"`);
      return generatedText;
    } else {
      console.error('❌ OpenAI API error:', data);
      return 'mechanic'; // Default fallback
    }
  } catch (error) {
    console.error('❌ Error calling OpenAI API:', error);
    return 'mechanic'; // Default fallback
  }
}

/**
 * Generate search keyword for mechanic search based on breakdown reason
 * @param {string} reason - Primary breakdown reason
 * @param {string} reason2 - Secondary breakdown reason (optional)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Generated search keyword
 */
async function generateMechanicSearchKeyword(reason, reason2 = '', apiKey) {
  const systemPrompt = `Context: 
Vehicles break down on the roads, and the drivers need help. We help them by getting them mechanics who can help them fix their vehicles, or transport it to where it can be fixed... We get these mechanics by checking google maps to find suitable candidates

Task:
Based on the reason the vehicle broke down (the break down reason), you are required to generate a single keyword/search phrase that we can use to find suitable candidates on google maps, e.g mechanic, or towing services...

Breakdown Reason:
<insert as much breakdown reason info as possible here>

Rules:
1. Your response must be only one word or phrase
2. Make sure it is a keyword that relates to a google maps business category, e.g. mechanic`;

  const userPrompt = `Break Down Reason 1: ${reason}
Break Down Reason 2: ${reason2 || ""}`;

  return await generateText(userPrompt, systemPrompt, apiKey);
}

module.exports = {
  generateText,
  generateMechanicSearchKeyword
}; 