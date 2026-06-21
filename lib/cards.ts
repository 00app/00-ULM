import { getAppUrl } from '@/lib/site'

export const getCards = async () => {
  const response = await fetch(`${getAppUrl()}/api/cards`);
  const cards = await response.json();
  
  const grouped = cards.reduce((acc: any, c: any) => {
    if (!acc[c.category]) acc[c.category] = [];
    if (acc[c.category].length < 2) acc[c.category].push(c);
    return acc;
  }, {});

  return Object.values(grouped).flat().slice(0, 3);
};
