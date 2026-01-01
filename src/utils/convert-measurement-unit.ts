export function convertMeasurementUnit(value: string) {
  switch (value) {
    case 'Quantity':
      value = 'шт.';
      break;
    case 'Kilogram':
      value = 'кг.';
      break;
    case 'Liter':
      value = 'л.';
      break;
    case 'Meter':
      value = 'м.';
      break;
  }
  return value;
}
