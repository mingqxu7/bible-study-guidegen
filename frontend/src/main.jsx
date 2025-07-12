import React from 'react'
import ReactDOM from 'react-dom/client'
import BibleStudyCreator from './BibleStudyCreator.jsx'
import './index.css'
import './i18n'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BibleStudyCreator />
  </React.StrictMode>,
)