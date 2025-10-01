// File: /api/calculate.js

export default async function handler(req, res) {
  // 1. We only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Get the prompt data from the frontend
  const { prompt, systemInstruction } = req.body;
  const geminiApiKey = process.env.API_KEY;

  if (!prompt || !systemInstruction) {
    return res.status(400).json({ message: 'Missing prompt or system instruction.' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ message: 'API key not configured on the server.' });
  }

  // 3. Call the actual Gemini API from the secure server
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2
        }
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error:', errorData);
        throw new Error(`Google API failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // 4. Send the result back to the frontend
    // The response is complex, we need to extract the text part
    const responseText = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: responseText });

  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ message: 'An error occurred while contacting the AI model.' });
  }
}
