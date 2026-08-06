// Fixed test-account identity shared by global-setup (which seeds it) and
// every spec (which logs in as it). Registration can't be exercised in E2E
// since it requires a real email OTP — this user is created pre-verified
// directly in the DB instead.
export const E2E_EMAIL = "e2e-test@example.com";
export const E2E_PASSWORD = "e2e-test-password-123456";
