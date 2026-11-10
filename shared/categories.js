export const categoryPages = [
  { name: 'Furniture', slug: 'furniture', description: 'Thoughtful furniture for the places you gather, rest, and make your own.' },
  { name: 'Sports', slug: 'sports', description: 'Everyday essentials for movement, training, and time outdoors.' },
  { name: 'Living', slug: 'living', description: 'Practical essentials and accessories for your daily routines.' },
  { name: 'Lighting', slug: 'lighting', description: 'A softer glow for quiet evenings, focused work, and everything between.' },
  { name: 'Kitchen', slug: 'kitchen', description: 'Beautifully useful pieces for cooking, sharing, and daily rituals.' },
  { name: 'Objects', slug: 'objects', description: 'Explore useful accessories, gifts, and everyday finds.' },
];
export const categories = categoryPages.map(page => page.name);
export const categoryPath = name => `/category/${categoryPages.find(page => page.name === name)?.slug || ''}`;
export const categoryFromPath = pathname => categoryPages.find(page => `/category/${page.slug}` === pathname.replace(/\/$/, ''));
