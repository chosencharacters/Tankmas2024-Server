export const zero_pad = (num: number, places = 2) =>
  String(num).padStart(places, '0');

export const format_time = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return `${zero_pad(hours)}:${zero_pad(minutes - hours * 60)}:${zero_pad(Math.floor(seconds % 60.0))})`;
};
