export const categoryPages = [
  { name: 'Phones', slug: 'phones', description: 'Smartphones and everyday phone essentials, all in one place.' },
  { name: 'Computers', slug: 'computers', description: 'Laptops, tablets, and work-from-anywhere essentials.' },
  { name: 'Audio', slug: 'audio', description: 'Headphones, speakers, and sound made for every moment.' },
  { name: 'Wearables', slug: 'wearables', description: 'Watches and wearable technology that keeps you connected.' },
  { name: 'Gaming', slug: 'gaming', description: 'Gaming gear for play, competition, and everything in between.' },
  { name: 'Smart Home', slug: 'smart-home', description: 'Connected devices that make home life easier.' },
  { name: 'Accessories', slug: 'accessories', description: 'Chargers, cases, cables, and finishing touches for your setup.' },
];
export const categories = categoryPages.map(page => page.name);
export const categoryPath = name => `/category/${categoryPages.find(page => page.name === name)?.slug || ''}`;
export const categoryFromPath = pathname => categoryPages.find(page => `/category/${page.slug}` === pathname.replace(/\/$/, ''));
