import mongoose from "mongoose";

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log("MongoDB conectado!");
  } catch (err) {
    console.error("Erro ao conectar no MongoDB:", err);
  }
}
