import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env.test.local") });

// Best-effort cleanup so the dedicated test DB doesn't accumulate data across
// runs. global-setup wipes and reseeds unconditionally on the next run either
// way, so this isn't load-bearing for test correctness.
export default async function globalTeardown() {
  const { E2E_EMAIL } = await import("./testUser");
  const mongoose = (await import("mongoose")).default;

  await Promise.all([
    import("../../models/User"),
    import("../../models/Category"),
    import("../../models/Expense"),
    import("../../models/Transaction"),
    import("../../models/Budget"),
    import("../../models/RefreshToken"),
  ]);
  const { User, Category, Expense, Transaction, Budget, RefreshToken } = mongoose.models;

  // Not connectDB(): global-setup already called mongoose.disconnect() in this
  // same process, but lib/db.ts's module-level cache doesn't know that, so it
  // would hand back a dead connection. Connect directly instead.
  await mongoose.connect(process.env.MONGODB_URI as string);

  const user = await User.findOne({ email: E2E_EMAIL });
  if (user) {
    const userId = user._id;
    await Promise.all([
      Expense.deleteMany({ userId }),
      Category.deleteMany({ userId }),
      Transaction.deleteMany({ userId }),
      Budget.deleteMany({ userId }),
      RefreshToken.deleteMany({ userId }),
    ]);
    await User.deleteOne({ _id: userId });
  }

  await mongoose.disconnect();
}
