import Player from "./models/player.js";


export const lifeBar = (hp, maxHp) => {
  if (maxHp <= 0 || hp > maxHp) return 'Invalid max HP';

  const totalBlocks = 10;
  const filledBlocks = Math.round((hp / maxHp) * totalBlocks);
  const bar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(totalBlocks - filledBlocks);
  return `${bar} ${hp}/${maxHp} ❤️`;

}




export async function getPlayerLife(userId) {
  let player = await Player.findOne({ userId });

  if (!player) {
    player = await Player.create({
      userId,
      hp: 10,
      maxHp: 10,
    });
  }

  return lifeBar(player.hp, player.maxHp);
}