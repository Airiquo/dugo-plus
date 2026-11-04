/**
 * Cloudflare Worker entry point for F7 and F10.
 *
 * `POST /match` is the immediate trigger used by request creation. The cron
 * handler runs matching fallback and notification retries.
 * F10 adds audit trail endpoints; F9 adds `POST /accounts` for the privileged
 * account operations (FR-040).
 */


import { createHospitalDonors } from './hospitalDonors.js'
