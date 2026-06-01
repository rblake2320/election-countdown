import Stripe from 'stripe';

async function seedDonationProducts() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY environment variable is required');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);

  console.log('Creating donation product...');

  // Check if product already exists
  const existingProducts = await stripe.products.search({
    query: "name:'Election Countdown Donation'"
  });

  if (existingProducts.data.length > 0) {
    console.log('Donation product already exists:', existingProducts.data[0].id);
    
    // List existing prices
    const prices = await stripe.prices.list({
      product: existingProducts.data[0].id,
      active: true
    });
    
    console.log('Existing prices:', prices.data.map(p => ({ 
      id: p.id, 
      amount: p.unit_amount 
    })));
    
    return;
  }

  // Create donation product
  const product = await stripe.products.create({
    name: 'Election Countdown Donation',
    description: 'Support the Election Countdown platform',
    metadata: {
      category: 'donation',
    }
  });

  console.log('Created product:', product.id);

  // Create price tiers for donations
  const priceTiers = [
    { amount: 500, name: '$5 Donation' },
    { amount: 1000, name: '$10 Donation' },
    { amount: 2500, name: '$25 Donation' },
    { amount: 5000, name: '$50 Donation' },
    { amount: 10000, name: '$100 Donation' },
  ];

  for (const tier of priceTiers) {
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: tier.amount,
      currency: 'usd',
      metadata: {
        tier: tier.name
      }
    });
    console.log(`Created price: ${price.id} - ${tier.name}`);
  }

  console.log('Donation products seeded successfully!');
}

seedDonationProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding products:', error);
    process.exit(1);
  });
