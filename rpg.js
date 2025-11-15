

export const lifeBar = (hp, maxHp) => {
  if (maxHp <= 0 || hp > maxHp) return 'Invalid max HP';

  const totalBlocks = 10;
  const filledBlocks = Math.round((hp / maxHp) * totalBlocks);
  const bar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(totalBlocks - filledBlocks);
  return `${bar} ${hp}/${maxHp} ❤️`;

}

