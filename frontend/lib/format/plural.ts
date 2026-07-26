export function pluralizeCars(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return "автомобиль";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100))
    return "автомобиля";
  return "автомобилей";
}
