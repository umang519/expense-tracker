// Some lib/ modules read these env vars at module-load time (e.g. lib/auth.ts's
// JWT_SECRET, lib/db.ts's MONGODB_URI), so they must be set before any test file
// imports them. Integration tests that need a real DB overwrite MONGODB_URI
// themselves (see tests/integration/dbHelper.ts) before dynamically importing
// the modules under test.
process.env.JWT_SECRET ??= "test-jwt-secret-do-not-use-in-production";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/expense-tracker-test-placeholder";
