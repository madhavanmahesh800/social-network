import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  profile_photo: { type: String },
  description: { type: String },
});

export default mongoose.model("Profile", ProfileSchema);
