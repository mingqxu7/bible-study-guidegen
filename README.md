# Bible Study Guide Generator

A comprehensive web application that generates theologically-informed Bible study guides for cell group ministry. The application features a React frontend and Express backend that integrates with Claude AI to create detailed study materials.

## Features

- **Theological Perspectives**: Choose from major theological stances (Reformed, Arminian, Dispensationalist, Lutheran, Catholic)
- **Multilingual Support**: Full internationalization with English and Chinese language support
- **Comprehensive Study Guides**: Generates detailed guides with verse-by-verse exegesis, discussion questions, and life applications
- **Expert Commentary**: Draws from respected biblical commentaries and scholarship from StudyLight.org
- **Downloadable Content**: Export study guides as text files for offline use
- **Group-Ready**: Designed specifically for cell group leaders and Bible study facilitators
- **Analytics**: Integrated Vercel Analytics for usage tracking
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Project Structure

```
bible-study-guide-generator/
├── api/                     # Vercel serverless API functions
│   └── generate-study.js    # Main API endpoint (Vercel deployment)
├── backend/                 # Express.js API server (local development)
│   ├── server.js           # Main server file
│   ├── services/           # Backend services
│   │   ├── commentaryRetriever.js  # StudyLight.org scraping service
│   │   └── commentaryMapping.js    # Theological denomination mappings
│   ├── package.json        # Backend dependencies
│   └── .env.example        # Environment variables template
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── BibleStudyCreator.jsx  # Main React component with i18n
│   │   ├── main.jsx        # React entry point with Analytics
│   │   ├── i18n.js         # Internationalization configuration
│   │   └── index.css       # Tailwind CSS imports
│   ├── public/
│   │   ├── favicon.svg     # App favicon
│   │   ├── icon.svg        # App icon
│   │   └── apple-touch-icon.svg  # iOS app icon
│   ├── index.html          # HTML template with PWA meta tags
│   ├── package.json        # Frontend dependencies with analytics
│   ├── vite.config.js      # Vite configuration with proxy
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── postcss.config.js   # PostCSS configuration
├── vercel.json             # Vercel deployment configuration
├── render.yaml             # Render deployment configuration
├── DEPLOYMENT.md           # Deployment instructions
├── CLAUDE.md              # AI development guidelines
└── README.md               # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Anthropic API key

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Add your Anthropic API key to the `.env` file:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   PORT=3001
   ```

5. Start the backend server:
   ```bash
   npm run dev
   ```

The backend server will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:3000`

## Usage

1. **Choose Language**: Select English or Chinese (中文) from the language switcher
2. **Select Theological Perspective**: Choose from the available theological stances that best aligns with your church's beliefs
3. **Enter Bible Passage**: Input the passage you want to study (e.g., "Matthew 5:1-12", "John 3:16", "Romans 8:28-39")
   - Supports English book names (e.g., "Matthew", "John", "Romans")
   - Supports Chinese book names (e.g., "马太福音", "约翰福音", "罗马书")
4. **Generate Study Guide**: Click the generate button to create a comprehensive study guide
5. **Download**: Use the download button to save the study guide as a text file

### Language Support
- **English**: Full interface and study guide generation in English
- **Chinese (简体中文)**: Complete Chinese interface with study guides generated in Simplified Chinese
- Automatic browser language detection on first visit

## API Endpoints

### POST /api/generate-study
Generates a Bible study guide based on the provided passage and theological perspective.

**Request Body:**
```json
{
  "verseInput": "John 3:16",
  "selectedTheology": "calvinism",
  "theologicalStances": [...],
  "language": "en"
}
```

**Response:**
```json
{
  "title": "Study title",
  "passage": "John 3:16",
  "theology": "Reformed/Calvinist",
  "overview": {...},
  "exegesis": [...],
  "discussionQuestions": [...],
  "lifeApplication": {...},
  "additionalResources": {...}
}
```

### GET /api/health
Health check endpoint to verify the API is running.

## Getting an Anthropic API Key

1. Visit [Anthropic's website](https://www.anthropic.com/)
2. Sign up for an account
3. Navigate to the API section
4. Generate a new API key
5. Add the key to your `.env` file

## Technologies Used

### Frontend
- React 18 with React Router
- Vite (build tool and development server)
- Tailwind CSS (utility-first styling)
- Lucide React (icon library)
- i18next (internationalization framework)
- react-i18next (React integration for i18n)
- Vercel Analytics (usage tracking)

### Backend
- Express.js (web framework for local development)
- Vercel Serverless Functions (production API)
- Anthropic SDK (Claude AI integration)
- Axios + Cheerio (web scraping for commentaries)
- CORS (cross-origin resource sharing)
- dotenv (environment variables)

### Services & Integrations
- StudyLight.org (biblical commentary retrieval)
- Claude AI (study guide generation)
- Vercel (hosting and serverless functions)
- Language Detection (automatic locale detection)

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm run dev  # Uses Vite for hot module replacement
```

### Building for Production

#### Frontend
```bash
cd frontend
npm run build
```

#### Backend
The backend runs directly with Node.js - no build step required.

## License

This project is intended for educational and ministry purposes. Please ensure you comply with Anthropic's usage policies when using the Claude API.

## Support

For questions or issues, please refer to the documentation or create an issue in the project repository.