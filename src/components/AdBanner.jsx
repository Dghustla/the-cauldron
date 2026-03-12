import { useEffect, useRef } from 'react';
import { ADSENSE_PUBLISHER_ID } from '../config/monetization';

/**
 * Google AdSense ad slot component.
 * Renders nothing if ADSENSE_PUBLISHER_ID is not configured.
 *
 * @param {'banner'|'inline'|'rectangle'} format - Ad format
 * @param {string} slot - Ad unit slot ID (optional, uses default from config)
 */
export default function AdBanner({ format = 'banner', slot }) {
  const adRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADSENSE_PUBLISHER_ID || pushed.current) return;
    try {
      if (window.adsbygoogle && adRef.current) {
        window.adsbygoogle.push({});
        pushed.current = true;
      }
    } catch (e) {
      // AdSense not loaded or blocked — fail silently
    }
  }, []);

  // Don't render anything if AdSense isn't configured
  if (!ADSENSE_PUBLISHER_ID) return null;

  const styles = {
    banner: { display: 'block', width: '100%', height: '90px' },
    inline: { display: 'block', width: '100%', height: '250px' },
    rectangle: { display: 'block', width: '300px', height: '250px', margin: '0 auto' },
  };

  return (
    <div className="ad-container my-4 flex justify-center">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={styles[format] || styles.banner}
        data-ad-client={ADSENSE_PUBLISHER_ID}
        data-ad-slot={slot || ''}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
