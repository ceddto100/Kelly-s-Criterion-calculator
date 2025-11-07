import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.responses.create({
  prompt: {
    "id": "pmpt_6905af86ea1081908331b1ff180c06310cbfdf46e0487b36",
    "version": "3"
  },
  input: [],
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
