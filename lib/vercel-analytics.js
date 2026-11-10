/**
 * Vercel Web Analytics initialization
 * 
 * This script initializes Vercel Analytics for tracking page views
 * and user interactions in the CRM Recupera AI application.
 * 
 * The analytics script is automatically injected by Vercel when deployed,
 * but this initialization ensures proper queue setup for early page loads.
 */

(function() {
  // Initialize the Vercel Analytics queue
  window.va = window.va || function () { 
    (window.vaq = window.vaq || []).push(arguments); 
  };
})();
