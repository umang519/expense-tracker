import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ICategory extends Document {
  userId: Types.ObjectId;
  name: string;
  color: string;
  sortOrder: number;
  isArchived: boolean;
}

const CategorySchema = new Schema<ICategory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    required: true,
  },
  sortOrder: {
    type: Number,
    required: true,
    default: 0,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
});

const Category: Model<ICategory> =
  mongoose.models.Category ??
  mongoose.model<ICategory>("Category", CategorySchema);

export default Category;
