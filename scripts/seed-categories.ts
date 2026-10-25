/**
 * Local/CI entry point for seeding the category catalog — the same logic
 * also runs from GET /api/admin/seed-categories so it can be triggered by
 * just opening a URL after deploying, with no local Node setup required.
 *
 * Usage: npm run seed:categories
 * Requires the same credentials as the app itself: either
 * FIREBASE_SERVICE_ACCOUNT_KEY in the environment, or Application Default
 * Credentials (e.g. `gcloud auth application-default login` locally).
 */
import { seedCategoryCatalog } from '../src/lib/firestore/seedCategories';

seedCategoryCatalog()
  .then(({ groups, categories }) => {
    console.log(`Seeded ${groups} category groups and ${categories} categories.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed categories:', error);
    process.exit(1);
  });
