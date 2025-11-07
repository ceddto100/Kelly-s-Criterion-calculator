import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * This function is now EXPORTED so server.js can import it.
 * It wraps the OpenAI call you provided.
 */
export async function getTeamMatchupStats({ sport, team_1, team_2, season }) {

  // We must pass the arguments from the function (like sport, team_1)
  // into the 'input' array of the OpenAI prompt.
  const promptInputs = [
    { "name": "sport", "value": sport },
    { "name": "team_1", "value": team_1 },
    { "name": "team_2", "value": team_2 },
    { "name": "season", "value": season || "current" }
  ];

  // This is the top-level 'await' code, now safely inside an async function
  const response = await openai.responses.create({
    prompt: {
      "id": "pmpt_6905af86ea1081908331b1ff180c06310cbfdf46e0487b36",
      "version": "3"
    },
    input: promptInputs, // <-- Use the inputs here
    text: {
      "format": {
        "type": "text"
      }
    },
    reasoning: {},
    tools: [
      {
        "type": "web_search_preview",
        "filters": {
          "allowed_domains": [
            "www.espn.com"
          ]
        },
        "search_context_size": "medium",
        "user_location": {
          "type": "approximate",
          "city": null,
          "country": null,
          "region": null,
          "timezone": null
        }
      }
    ],
    max_output_tokens: 2048,
    store: true,
    include: ["web_search_call.action.sources"]
  });

  // TODO: You will likely need to process this 'response' object.
  // For example, if the data is in the text part:
  // const data = JSON.parse(response.text.value);
  // return data;
  
  // For now, we return the raw response object.
  return response;
}

// You can add other exported functions here if needed
