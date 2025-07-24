# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Study Creator is a full-stack web application that generates theologically-informed Bible study guides for cell group ministry. It features a React frontend with Tailwind CSS and an Express.js backend that integrates with Claude AI and retrieves commentary from biblical sources.

## Development Commands

### Backend (Express.js)
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start development server with nodemon (auto-restart)
npm start            # Start production server
```

### Frontend (React + Vite)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Architecture

### Backend Structure
- **server.js**: Main Express server handling `/api/generate-study` and `/api/health` endpoints
- **services/commentaryRetriever.js**: Commentary fetching service that scrapes StudyLight.org
  - Enhanced Bible reference validation with book bounds checking
  - Bilingual error messages for invalid references
- **services/commentaryMapping.js**: Theological denomination to commentary mappings and URL generation
- **services/bibleBounds.js**: Complete Bible metadata with chapter/verse counts for validation

### Frontend Structure
- **BibleStudyCreator.jsx**: Main React component handling the complete UI and study guide generation
  - Includes BibleReferenceHover component for interactive Bible verse tooltips
  - Real-time verse text fetching from Bolls.life API (ESV/CUV)
  - Smart tooltip positioning with hover interactions
- **main.jsx**: React application entry point
- **i18n.js**: Internationalization with comprehensive error messages
- Single-page application with no routing

### Key Architecture Patterns
- **Commentary Integration**: The backend retrieves commentaries from StudyLight.org based on theological stances (Reformed, Arminian, Dispensationalist, Lutheran, Catholic) before generating AI study guides
- **AI Enhancement**: Claude AI processes retrieved commentary content to generate structured study guides with verse-by-verse exegesis, discussion questions, and life applications
- **Theological Alignment**: Each theological stance has mapped commentaries ensuring doctrinally consistent study guides
- **Caching**: Commentary retrieval includes caching with request delays to be respectful to external services
- **Bible Reference Validation**: Comprehensive validation system using bibleBounds.js to ensure valid book/chapter/verse references
- **Interactive Bible Tooltips**: Hover functionality that fetches and displays verse text in real-time, supporting multiple reference formats including Chinese wide colon (：)

### Environment Configuration
Backend requires `.env` file with:
- `ANTHROPIC_API_KEY`: Required for Claude AI integration
- `PORT`: Server port (defaults to 3001)
- `MAX_OUTPUT_TOKENS`: Claude response limit (defaults to 16000)
- `MAX_COMMENTARIES`: Number of commentaries to fetch (defaults to 3)

### API Integration
- **Claude AI**: Uses `claude-3-5-sonnet-20241022` model for study guide generation
- **StudyLight.org**: Web scraping for theological commentaries using axios and cheerio
- **Bolls.life API**: Real-time Bible verse text retrieval for hover tooltips (ESV for English, CUV for Chinese)
- Frontend communicates with backend via REST API at `http://localhost:3001/api`

### Data Flow
1. User selects theological perspective and Bible passage
2. Backend parses verse reference and retrieves relevant commentaries
3. Commentary content is formatted and sent to Claude AI with structured prompt
4. Generated study guide includes overview, exegesis, discussion questions, life application, and additional resources
5. Frontend displays preview and offers downloadable text file

### Tech Stack Details
- **Backend**: Express.js with ES modules, Anthropic SDK, cheerio for web scraping, CORS enabled
- **Frontend**: React 18, Vite build tool, Tailwind CSS, Lucide React icons
- **No database**: All data is processed in real-time through external API calls and web scraping