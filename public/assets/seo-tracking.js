// SEO Analytics & Performance Tracking
// Configurazione avanzata per tracking conversioni

// Enhanced ecommerce tracking per lead generation
function trackLeadGeneration(leadData) {
    // Meta Pixel tracking
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', {
            content_name: 'Form Contatto',
            content_category: 'Lead Generation', 
            custom_data: leadData
        });
    }
    
    // Console log per debug
    console.log('Lead tracked:', leadData);
}

// Page speed optimization
document.addEventListener('DOMContentLoaded', function() {
    // Lazy loading per immagini
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Core Web Vitals monitoring
    if ('web-vital' in window) {
        // Track LCP, FID, CLS
        window.webVitals.getCLS(console.log);
        window.webVitals.getFID(console.log); 
        window.webVitals.getLCP(console.log);
    }
});

// Export tracking functions
window.SEOTracking = {
    trackLeadGeneration
};
