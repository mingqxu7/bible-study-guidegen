import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MigrationBanner = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if user is on the old domain
    const isOldDomain = window.location.hostname === 'biblestudy.banaba.ai';

    // Check if user has previously dismissed the banner
    const dismissed = localStorage.getItem('migration-banner-dismissed');

    // Show banner if on old domain and not dismissed
    if (isOldDomain && !dismissed) {
      setShouldShow(true);
      // Add a small delay for smooth animation
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Store dismissal in localStorage
    localStorage.setItem('migration-banner-dismissed', 'true');
    // Remove from DOM after animation
    setTimeout(() => setShouldShow(false), 300);
  };

  const handleVisitNewSite = () => {
    // Redirect to new domain with current path
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = `https://biblestudy.aibanaba.com${currentPath}`;
  };

  if (!shouldShow) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            {/* Icon and content */}
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">
                  {t('migration.title')}
                </h3>
                <p className="text-sm leading-relaxed opacity-95">
                  {t('migration.message')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleVisitNewSite}
                    className="bg-white text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 shadow-sm"
                  >
                    {t('migration.action')}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors duration-200"
                  >
                    {t('migration.dismiss')}
                  </button>
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 hover:bg-orange-600 rounded-lg transition-colors duration-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationBanner;
