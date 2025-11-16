import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    Pokemons: { type: Array, default: [] },
    Level: { type: Number, default: 1 },
    XP: { type: Number, default: 0 },
})



export default mongoose.model("Player", playerSchema);