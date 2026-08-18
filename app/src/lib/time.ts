import { add, format, addBusinessDays } from 'date-fns';

export function getDeliveryDate(serviceId: string): string {
  const now = new Date();

  switch (serviceId) {
    case 'sameday':
      return format(now, "EEEE, MMMM do 'at' h:mm a");
    case 'overnight':
      const tomorrow = add(now, { days: 1 });
      return format(tomorrow, "EEEE, MMMM do");
    case 'priority':
      const priority_date = add(now, { days: 1 });
      return format(priority_date, "EEEE, MMMM do");
    case 'standard':
      const standard_date = add(now, { days: 1 });
      return format(standard_date, "EEEE, MMMM do");
    case '2day':
      const twoDay = addBusinessDays(now, 2);
      return format(twoDay, "EEEE, MMMM do");
    case 'ground':
      const ground = addBusinessDays(now, 5);
      return format(ground, "EEEE, MMMM do");
    default:
      return 'N/A';
  }
}
