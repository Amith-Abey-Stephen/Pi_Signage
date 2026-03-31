require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('../models/Media');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log('Connected to MongoDB');

  // first fix missing url fields (old schema)
  const items = await Media.find({ url: { $exists: false }, filename: { $exists: true } });

  console.log(`Found ${items.length} items to update (missing url)`);

  for (const item of items) {
    const filename = item.filename;
    if (!filename) continue;

    const newUrl = `/uploads/${filename}`;

    item.url = newUrl;
    await item.save();
    console.log(`Updated ${item._id} -> ${newUrl}`);
  }

  // additionally, report any URLs that look like the API path
  const badItems = await Media.find({ url: /^\/api\/playlist/ });
  if (badItems.length) {
    console.log(`\nFound ${badItems.length} items whose URL looks like an API path:`);
    badItems.forEach(it => console.log(`  ${it._id} -> ${it.url}`));
    console.log('You may want to update or remove these entries manually.');
  } else {
    console.log('No playlist-URL items detected.');
  }

  console.log('Migration complete');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration error', err);
  process.exit(1);
});
