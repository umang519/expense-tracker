import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env.test.local") });

const DEFAULT_CATEGORIES = [
  { name: "Food", color: "#F97316", sortOrder: 0 },
  { name: "Travel", color: "#3B82F6", sortOrder: 1 },
  { name: "Investments", color: "#10B981", sortOrder: 2 },
  { name: "Extras", color: "#8B5CF6", sortOrder: 3 },
];

// Runs once, before the webServer (a separate `next dev` process) starts —
// seeds a clean, pre-verified test user directly via Mongoose so every E2E
// run starts from a deterministic zero-expenses state.
export default async function globalSetup() {
  const { E2E_EMAIL, E2E_PASSWORD } = await import("./testUser");
  const { connectDB } = await import("../../lib/db");
  const { hashPassword } = await import("../../lib/auth");
  const mongoose = (await import("mongoose")).default;

  // Import for model-registration side effects, then read off mongoose's own
  // registry — more robust than trusting each module's default-export shape
  // under Playwright's on-the-fly TS transform.
  await Promise.all([
    import("../../models/User"),
    import("../../models/Category"),
    import("../../models/Expense"),
    import("../../models/Transaction"),
    import("../../models/Budget"),
    import("../../models/RefreshToken"),
  ]);
  const { User, Category, Expense, Transaction, Budget, RefreshToken } = mongoose.models;

  await connectDB();

  const existing = await User.findOne({ email: E2E_EMAIL });
  if (existing) {
    const userId = existing._id;
    await Promise.all([
      Expense.deleteMany({ userId }),
      Category.deleteMany({ userId }),
      Transaction.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      RefreshToken.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });
  }

  const passwordHash = await hashPassword(E2E_PASSWORD);
  const user = await User.create({
    email: E2E_EMAIL,
    passwordHash,
    isEmailVerified: true,
  });

  await Category.insertMany(
    DEFAULT_CATEGORIES.map((cat) => ({ ...cat, userId: user._id }))
  );

  await mongoose.disconnect();
}
