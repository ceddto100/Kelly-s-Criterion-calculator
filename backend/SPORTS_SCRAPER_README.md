# 🏀 Sports Matchup Engine - NBA Stats & AI Analysis

## 📌 Overview

A **100% FREE** sports matchup analysis engine that allows users to compare NBA teams using real-time ESPN stats and AI-powered analysis via Groq's Llama-3.2 model.

### Key Features

- ✅ Real-time ESPN stats scraping (Points Per Game, Points Allowed, Rebound Margin, Turnover Margin)
- ✅ Free AI analysis powered by Groq's Llama-3.2 90B model
- ✅ No authentication required - completely open access
- ✅ RESTful API endpoints for easy integration
- ✅ No paid subscriptions or hidden costs

---

## 🎯 API Endpoints

### 1. Get Offensive Stats (Points Per Game)

```bash
GET /api/offense
```

**Response:**
```json
[
  {
    "team": "Los Angeles Lakers",
    "ppg": 117.2
  },
  {
    "team": "Golden State Warriors",
    "ppg": 115.8
  }
]
```

---

### 2. Get Defensive Stats (Points Allowed)

```bash
GET /api/defense
```

**Response:**
```json
[
  {
    "team": "Los Angeles Lakers",
    "papg": 113.5
  },
  {
    "team": "Golden State Warriors",
    "papg": 114.2
  }
]
```

---

### 3. Get Differential Stats (Rebound & Turnover Margins)

```bash
GET /api/differential
```

**Response:**
```json
[
  {
    "team": "Los Angeles Lakers",
    "reboundMargin": 3.2,
    "turnoverMargin": -1.1
  },
  {
    "team": "Golden State Warriors",
    "reboundMargin": 2.5,
    "turnoverMargin": 0.8
  }
]
```

---

### 4. Get Complete Matchup Comparison

```bash
GET /api/matchup?teamA=Lakers&teamB=Warriors
```

**Response:**
```json
{
  "teamA": {
    "team": "Los Angeles Lakers",
    "points_per_game": 117.2,
    "points_allowed": 113.5,
    "rebound_margin": 3.2,
    "turnover_margin": -1.1
  },
  "teamB": {
    "team": "Golden State Warriors",
    "points_per_game": 115.8,
    "points_allowed": 114.2,
    "rebound_margin": 2.5,
    "turnover_margin": 0.8
  }
}
```

---

### 5. Get AI-Powered Matchup Analysis

```bash
GET /api/analyze?teamA=Lakers&teamB=Warriors
```

**Response:**
```json
{
  "teamA": "Lakers",
  "teamB": "Warriors",
  "stats": {
    "teamA": { ... },
    "teamB": { ... }
  },
  "analysis": "Based on the current stats, the Lakers have a slight offensive advantage with 117.2 PPG compared to the Warriors' 115.8 PPG. However, the Warriors show better ball security with a positive turnover margin of 0.8 versus the Lakers' -1.1..."
}
```

---

## 🚀 Quick Start Guide

### Prerequisites

- Node.js 18+ and npm 9+
- A free Groq API key (get it from https://console.groq.com/keys)

### Local Development Setup

1. **Clone the repository:**

```bash
git clone <your-repo-url>
cd Kelly-s-Criterion-calculator/backend
```

2. **Install dependencies:**

```bash
npm install
```

3. **Create environment file:**

```bash
cp .env.example .env
```

4. **Configure your environment variables:**

Edit the `.env` file and add your Groq API key:

```env
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
PORT=3000
NODE_ENV=development
```

5. **Start the server:**

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

6. **Test the endpoints:**

```bash
# Test offense stats
curl http://localhost:3000/api/offense

# Test matchup comparison
curl "http://localhost:3000/api/matchup?teamA=Lakers&teamB=Warriors"

# Test AI analysis
curl "http://localhost:3000/api/analyze?teamA=Lakers&teamB=Warriors"
```

---

## 🌐 Production Deployment

### Deploy to Render (Free Tier)

1. **Push your code to GitHub:**

```bash
git add .
git commit -m "Add sports matchup engine"
git push origin main
```

2. **Create a new Web Service on Render:**

- Go to https://render.com
- Click "New +" → "Web Service"
- Connect your GitHub repository
- Configure the service:

**Build Command:**
```bash
cd backend && npm install
```

**Start Command:**
```bash
cd backend && npm start
```

**Environment Variables:**
Add these in the Render dashboard:
```
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend.vercel.app
```

3. **Deploy:**

- Click "Create Web Service"
- Wait for deployment to complete
- Your API will be live at: `https://your-app.onrender.com`

---

## 🔑 Getting a FREE Groq API Key

1. Go to https://console.groq.com/
2. Sign up for a free account (no credit card required)
3. Navigate to https://console.groq.com/keys
4. Click "Create API Key"
5. Copy your API key (starts with `gsk_`)
6. Add it to your `.env` file or Render environment variables

**Important:** Groq's free tier is extremely generous:
- ✅ Llama-3.2 90B model available
- ✅ 14,400 requests per day
- ✅ 30 requests per minute
- ✅ No credit card required

---

## 📁 Project Structure

```
backend/
├── server.js                 # Main Express server (includes all routes)
├── scrapers/
│   ├── utils.js             # Shared scraping utilities (axios + cheerio)
│   ├── offense.js           # Points Per Game scraper
│   ├── defense.js           # Points Allowed scraper
│   ├── differential.js      # Rebound & Turnover Margin scraper
│   └── matchup.js           # Combined matchup data endpoint
├── groq/
│   └── chat.js              # Groq LLM integration for AI analysis
├── package.json             # Dependencies (axios, cheerio, groq-sdk, etc.)
├── .env.example             # Environment variables template
└── SPORTS_SCRAPER_README.md # This file
```

---

## 🧪 Testing the API

### Using cURL

```bash
# Get all offensive stats
curl http://localhost:3000/api/offense

# Get all defensive stats
curl http://localhost:3000/api/defense

# Get all differential stats
curl http://localhost:3000/api/differential

# Compare two teams
curl "http://localhost:3000/api/matchup?teamA=Lakers&teamB=Celtics"

# Get AI analysis
curl "http://localhost:3000/api/analyze?teamA=Lakers&teamB=Celtics"
```

### Using JavaScript (Fetch API)

```javascript
// Get matchup data
const response = await fetch(
  'http://localhost:3000/api/matchup?teamA=Lakers&teamB=Warriors'
);
const data = await response.json();
console.log(data);

// Get AI analysis
const analysis = await fetch(
  'http://localhost:3000/api/analyze?teamA=Lakers&teamB=Warriors'
);
const result = await analysis.json();
console.log(result.analysis);
```

---

## 🛠️ Troubleshooting

### Issue: "Failed to load page" error

**Solution:** ESPN may have changed their page structure. Check the URLs:
- https://www.espn.com/nba/stats/team
- https://www.espn.com/nba/stats/team/_/view/opponent/table/offensive/sort/avgPoints/dir/asc
- https://www.espn.com/nba/stats/team/_/view/differential

If the structure changed, update the selectors in the scraper files.

### Issue: "Groq API Error"

**Solution:**
1. Verify your API key is correct in `.env`
2. Check that `GROQ_API_KEY` is properly set in environment variables
3. Ensure you haven't exceeded the free tier rate limits (30 req/min)

### Issue: "Team not found"

**Solution:**
- Use partial team names (e.g., "Lakers" instead of "Los Angeles Lakers")
- The scraper uses case-insensitive partial matching
- Check the `/api/offense` endpoint to see available team names

---

## 📊 Data Sources

All data is scraped in real-time from ESPN:

- **Points Per Game:** https://www.espn.com/nba/stats/team
- **Points Allowed:** https://www.espn.com/nba/stats/team/_/view/opponent/table/offensive/sort/avgPoints/dir/asc
- **Rebound & Turnover Margins:** https://www.espn.com/nba/stats/team/_/view/differential

**Note:** Data updates as ESPN updates their stats (typically daily).

---

## 🎨 Frontend Integration (Optional)

To create a user-facing interface:

1. Create a simple React/Next.js frontend
2. Deploy to Vercel (free)
3. Connect to your Render backend API
4. Add a chat interface that calls `/api/analyze`

Example frontend code:

```jsx
const [teamA, setTeamA] = useState('');
const [teamB, setTeamB] = useState('');
const [analysis, setAnalysis] = useState('');

async function analyzeMatchup() {
  const res = await fetch(
    `https://your-backend.onrender.com/api/analyze?teamA=${teamA}&teamB=${teamB}`
  );
  const data = await res.json();
  setAnalysis(data.analysis);
}
```

---

## 🔒 Security & Best Practices

- ✅ API key stored in environment variables (never commit `.env` to Git)
- ✅ CORS configured for secure cross-origin requests
- ✅ Rate limiting enabled to prevent abuse
- ✅ Error handling for all endpoints
- ✅ Timeout protection for external requests

---

## 📝 License

MIT License - Free to use, modify, and distribute.

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Test your changes locally
4. Submit a pull request

---

## 📧 Support

For issues or questions:
- Open a GitHub issue
- Check the troubleshooting section above
- Review the ESPN page structure if scrapers fail

---

## 🎉 What's Next?

Potential enhancements:

- 📈 Add more stats (Field Goal %, Three-Point %, Free Throw %)
- 🏈 Expand to NFL, MLB, NHL
- 📊 Historical data tracking
- 🎯 Betting odds integration
- 📱 Mobile app version
- 🔔 Real-time game notifications

---

**Built with ❤️ using Node.js, Express, Cheerio, and Groq AI**

**100% Free. No Limits. Open Source.**
