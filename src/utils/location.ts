export function parseCoordinatesFromText(value: string) {
  const atPattern = value.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const placePattern = value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const directMatch = atPattern ?? placePattern;

  if (directMatch) {
    const lat = Number(directMatch[1]);
    const lng = Number(directMatch[2]);

    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (numbers.length < 2) {
    return null;
  }

  const [lat, lng] = numbers;
  const isValidLat = lat >= -90 && lat <= 90;
  const isValidLng = lng >= -180 && lng <= 180;

  if (!isValidLat || !isValidLng) {
    return null;
  }

  return { lat, lng };
}
