import Player from "../models/player";


const GivePokemon = async (req,res) => {
    const { userId, pokemonId } = req.body;
    const player = await Player.findOne({ userId });
    
    if (!player) {
        return res.status(404).json({ message: "Player not found" });
    }
    player.Pokemons.push(pokemonId);
    await player.save();
    return res.status(200).json({ message: "Pokemon given to player" });
}


export default GivePokemon;