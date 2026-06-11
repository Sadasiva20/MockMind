- [ ] Remove committed credential file(s) (service-account-key.json) from repo
- [ ] Add service account key filename(s) to .gitignore
- [ ] Update code to use env-based service account auth (GOOGLE_APPLICATION_CREDENTIALS) without any committed JSON key
- [ ] Ensure README does not instruct committing the key
- [ ] Revoke/rotate leaked Google service account key in GCP
- [ ] Re-run local checks (lint/test/build) after changes

