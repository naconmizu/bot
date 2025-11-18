import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    Pokemons: { type: Array, default: [] },
    Level: { type: Number, default: 1 },
    XP: { type: Number, default: 0 },
    Pokeballs: { 
        type: Object, 
        default: {
            "Pokébola": 5 // Começa com 5 pokébolas básicas
        }
    }
})



export default mongoose.model("Player", playerSchema);