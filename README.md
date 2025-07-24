# Bible Study Guide Generator

A comprehensive web application that generates theologically-informed Bible study guides for cell group ministry. The application features a React frontend and Express backend that integrates with Claude AI to create detailed study materials.

## Features

- **Real-Time Progress Tracking**: Live updates showing backend actions during study guide generation
- **Interactive Bible Tooltips**: Hover over any Bible reference to instantly view verse text in a tooltip
- **Theological Perspectives**: Choose from major theological stances (Reformed, Arminian, Dispensationalist, Lutheran, Catholic)
- **Multilingual Support**: Full internationalization with English and Chinese language support
- **Comprehensive Study Guides**: Generates detailed guides with verse-by-verse exegesis, discussion questions, and life applications
- **Expert Commentary**: Draws from respected biblical commentaries and scholarship from StudyLight.org
- **Enhanced Bible Validation**: Comprehensive validation with specific error messages for invalid chapters/verses
- **Server-Sent Events (SSE)**: Real-time progress updates with fallback to standard API
- **Downloadable Content**: Export study guides as text files for offline use
- **Group-Ready**: Designed specifically for cell group leaders and Bible study facilitators
- **Progressive Web App**: PWA-ready with optimized meta tags and responsive design
- **Analytics**: Integrated Vercel Analytics for usage tracking
- **Production Ready**: Dual deployment support (Vercel serverless + Express backend)

## Project Structure

```
bible-study-guide-generator/
├── api/                     # Vercel serverless API functions
│   ├── generate-study.js    # Standard API endpoint (Vercel deployment)
│   ├── generate-study-stream.js  # SSE endpoint for real-time progress
│   └── health.js           # Health check endpoint
├── backend/                 # Express.js API server (local development)
│   ├── server.js           # Main server with SSE support and progress tracking
│   ├── services/           # Backend services
│   │   ├── commentaryRetriever.js  # StudyLight.org scraping service with validation
│   │   ├── commentaryMapping.js    # Theological denomination mappings
│   │   └── bibleBounds.js         # Bible metadata for validation
│   ├── package.json        # Backend dependencies
│   └── .env.example        # Environment variables template
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── BibleStudyCreator.jsx  # Main component with SSE progress tracking and Bible tooltips
│   │   ├── main.jsx        # React entry point with Analytics
│   │   ├── i18n.js         # Internationalization configuration
│   │   └── index.css       # Tailwind CSS imports
│   ├── public/
│   │   ├── favicon.svg     # App favicon
│   │   ├── icon.svg        # App icon
│   │   └── apple-touch-icon.svg  # iOS app icon
│   ├── index.html          # HTML template with updated PWA meta tags
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
   - Supports Chinese abbreviations (e.g., "来 6:4-6" for Hebrews 6:4-6)
   - Supports Chinese wide colon (：) in references (e.g., "太：3:16")
   - **Interactive Bible Tooltips**: Hover over any Bible reference in the generated study guide to instantly view the verse text
4. **Generate Study Guide**: Click the generate button and watch real-time progress
   - **Live Progress Tracking**: See each step as it happens:
     - Parsing verse reference
     - Retrieving commentaries from StudyLight.org
     - Filtering available commentary content
     - Generating study guide with Claude AI
   - **Automatic Fallback**: If real-time updates fail, automatically switches to standard mode
5. **Download**: Use the download button to save the complete study guide as a text file

### Language Support
- **English**: Full interface and study guide generation in English
- **Chinese (简体中文)**: Complete Chinese interface with study guides generated in Simplified Chinese
- Automatic browser language detection on first visit

## API Endpoints

### GET /api/generate-study-stream (SSE)
**NEW**: Real-time study guide generation with Server-Sent Events for live progress tracking.

**Query Parameters:**
- `verseInput`: Bible passage (e.g., "John 3:16")
- `selectedTheology`: Theological stance ID
- `theologicalStances`: JSON-encoded array of theological stances
- `language`: Language code ("en" or "zh")

**SSE Response Stream:**
```javascript
// Progress updates
data: {"type": "progress", "step": "parsing", "message": "Parsing verse reference..."}
data: {"type": "progress", "step": "retrieving_commentaries", "message": "Retrieving commentaries..."}
data: {"type": "progress", "step": "generating_guide", "message": "Generating with Claude AI..."}

// Final result
data: {"type": "complete", "data": {...}, "message": "Study guide generated successfully!"}
```

### POST /api/generate-study
Standard API endpoint for study guide generation (fallback when SSE fails).

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
  "additionalResources": {...},
  "commentariesUsed": [...]
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
- Lucide React (icon library with real-time progress indicators)
- i18next (internationalization framework)
- react-i18next (React integration for i18n)
- Server-Sent Events (EventSource API for real-time updates)
- Vercel Analytics (usage tracking)

### Backend
- Express.js with SSE support (local development)
- Vercel Serverless Functions (production API with SSE endpoint)
- Anthropic SDK (Claude AI integration)
- Axios + Cheerio (web scraping for commentaries)
- CORS (cross-origin resource sharing)
- dotenv (environment variables)
- Real-time progress streaming

### Services & Integrations
- StudyLight.org (biblical commentary retrieval)
- Claude AI (study guide generation with enhanced prompts)
- Bolls.life API (real-time Bible verse text retrieval)
- Vercel (hosting and serverless functions)
- Language Detection (automatic locale detection)
- Progressive Web App (PWA) capabilities

## Progress Tracking Feature

The application now includes **real-time progress tracking** that shows users exactly what's happening during study guide generation:

### Progress Steps
1. **Parsing** - Validates and parses the Bible verse reference
2. **Commentary Retrieval** - Fetches relevant commentaries from StudyLight.org
3. **Commentary Filtering** - Filters commentaries that contain content for the requested verses
4. **AI Generation** - Generates the study guide using Claude AI
5. **Completion** - Finalizes and delivers the study guide

### Technical Implementation
- **Server-Sent Events (SSE)**: Primary method for real-time updates
- **Automatic Fallback**: Gracefully falls back to standard API if SSE fails
- **Bilingual Messages**: Progress messages in both English and Chinese
- **Visual Feedback**: Icons and animations indicate current step status
- **Error Handling**: Robust error handling with user-friendly messages

### User Experience Benefits
- **Transparency**: Users see exactly what's happening behind the scenes
- **Engagement**: Real-time updates keep users engaged during longer processes
- **Trust**: Showing commentary sources builds confidence in the results
- **Feedback**: Clear indication of progress and any issues encountered

## Bible Reference Tooltips

The application includes an interactive Bible reference tooltip feature that enhances the reading experience:

### Features
- **Hover Interactions**: Hover over any Bible reference to see verse text instantly
- **Smart Detection**: Automatically detects Bible references in multiple formats:
  - English: "John 3:16", "1 Corinthians 13:4-8"
  - Chinese: "约 3:16", "太：3:16", "约一 2:1"
- **Bilingual Support**: Fetches ESV for English and CUV for Chinese references
- **Smart Positioning**: Tooltips appear above or below references based on available space
- **Loading States**: Shows loading indicator while fetching verse text
- **Smooth Experience**: 300ms hover delay prevents accidental triggers

### Technical Details
- Powered by Bolls.life API for real-time verse retrieval
- Regex-based reference detection supporting various formats
- Automatic language detection based on reference format
- Responsive design that works on all screen sizes

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart with SSE support
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