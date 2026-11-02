# Donor experience

- `/home`: profile, saved location and eligibility.
- `/donor/requests`: compatible requests, detailed review, one active commitment.
- `/donor/alerts`: contextual matches, unread updates and request links.
- `/donor/activity`: confirmed donation history and eligibility; no rewards (D43).
- `/donor/privacy`: privacy choices and data requests.

Responses and their consents commit atomically through `POST /donor/respond`.
See `docs/DONOR_EXPERIENCE.md` for security, rollout and verification.
