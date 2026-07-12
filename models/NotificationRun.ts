import mongoose from "mongoose";

export interface INotificationRun {
  key: string;
  lastSentDate: string; // YYYY-MM-DD, IST
}

const schema = new mongoose.Schema<INotificationRun>({
  key: { type: String, required: true, unique: true },
  lastSentDate: { type: String, required: true },
});

export default mongoose.models.NotificationRun ??
  mongoose.model<INotificationRun>("NotificationRun", schema);
