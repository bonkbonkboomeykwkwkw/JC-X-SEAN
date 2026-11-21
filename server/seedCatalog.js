import Product from './models/Product.js';
import { initialProducts, replacedSeedProductNames } from './seed-data.js';

export async function seedCatalog() {
  await Product.bulkWrite(initialProducts.map(product => ({
    updateOne: { filter: { name: product.name }, update: { $set: product }, upsert: true },
  })));

  const activeNames = new Set(initialProducts.map(product => product.name));
  const staleNames = replacedSeedProductNames.filter(name => !activeNames.has(name));
  const removed = staleNames.length
    ? await Product.deleteMany({ name: { $in: staleNames } })
    : { deletedCount: 0 };

  return { seededCount: initialProducts.length, removedCount: removed.deletedCount };
}
