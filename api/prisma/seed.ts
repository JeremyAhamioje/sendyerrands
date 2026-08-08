import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PRODUCT_IMAGES, VENDOR_COVERS } from './seed-images';

// Mirrors src/lib/mock.ts in the mobile app, so screens look identical whether
// they read from the mock module or from this API.
const prisma = new PrismaClient();

const VENDORS = [
  {
    slug: 'mama-nkechi',
    name: 'Mama Nkechi Kitchen',
    tags: ['Nigerian', 'Rice & Grains', 'Swallow'],
    area: 'Lekki Phase 1',
    rating: 4.8,
    ratingCount: 1200,
    etaMinMinutes: 25,
    etaMaxMinutes: 35,
    deliveryFeeKobo: 130_000,
    freeOverKobo: 1_000_000,
    discountLabel: 'Up to ₦2,300 off today',
    isVerified: true,
    isOpen: true,
    closesAt: '22:00',
    canBid: true,
    products: [
      { name: 'Jollof Rice + Chicken', description: 'Smoky party jollof, grilled chicken, fried plantain & coleslaw.', priceKobo: 450_000, section: 'Popular', badge: 'Bestseller' },
      { name: 'Pounded Yam & Egusi', description: 'Fresh pounded yam with rich egusi and assorted meat.', priceKobo: 520_000, section: 'Popular' },
      { name: 'Peppered Goat Meat', description: 'Spicy, slow-cooked goat meat. Serves 2.', priceKobo: 680_000, section: 'Popular', badge: 'Spicy' },
      { name: 'Ofada Rice & Ayamase', description: 'Local ofada rice with green pepper sauce and assorted meat.', priceKobo: 580_000, section: 'Rice & Grains' },
      { name: 'Fried Rice + Turkey', description: 'Vegetable fried rice with grilled turkey and plantain.', priceKobo: 550_000, section: 'Rice & Grains' },
      { name: 'Eba & Okra Soup', description: 'Garri swallow with okra, stockfish and beef.', priceKobo: 420_000, section: 'Swallow' },
      { name: 'Catfish Pepper Soup', description: 'Hot catfish pepper soup with scent leaf.', priceKobo: 620_000, section: 'Soups' },
      { name: 'Party Jollof Tray (20 plates)', description: 'Feeds a crowd. 24 hours notice preferred.', priceKobo: 6_800_000, section: 'Trays', marketplace: true, biddable: true },
    ],
  },
  {
    slug: 'iya-basira',
    name: 'Iya Basira Amala Spot',
    tags: ['Swallow', 'Soups', 'Local'],
    area: 'Surulere',
    rating: 4.6,
    ratingCount: 840,
    etaMinMinutes: 20,
    etaMaxMinutes: 30,
    deliveryFeeKobo: 90_000,
    discountLabel: 'Up to ₦1,500 off',
    isVerified: true,
    isOpen: true,
    closesAt: '21:00',
    products: [
      { name: 'Amala & Ewedu', description: 'Soft amala with ewedu, gbegiri and assorted meat.', priceKobo: 380_000, section: 'Popular', badge: 'Bestseller' },
      { name: 'Ogufe (Goat Meat)', description: 'Peppered goat meat, Yoruba style.', priceKobo: 550_000, section: 'Popular' },
    ],
  },
  {
    slug: 'suya-republic',
    name: 'Suya Republic',
    tags: ['Grills', 'Suya', 'Small chops'],
    area: 'Victoria Island',
    rating: 4.7,
    ratingCount: 2100,
    etaMinMinutes: 30,
    etaMaxMinutes: 45,
    deliveryFeeKobo: 150_000,
    isVerified: true,
    isOpen: true,
    closesAt: '23:30',
    products: [
      { name: 'Beef Suya Platter', description: 'Half kilo of spicy beef suya with onions and yaji.', priceKobo: 700_000, section: 'Popular', badge: 'Bestseller' },
      { name: 'Small Chops Combo', description: 'Puff-puff, samosa, spring roll and peppered gizzard.', priceKobo: 450_000, section: 'Popular' },
    ],
  },
  {
    slug: 'ikeja-grains',
    name: 'Ikeja Grains Mart',
    tags: ['Foodstuff', 'Grains', 'Bulk'],
    area: 'Ikeja',
    rating: 4.5,
    ratingCount: 310,
    etaMinMinutes: 45,
    etaMaxMinutes: 70,
    deliveryFeeKobo: 220_000,
    isVerified: true,
    isOpen: false,
    opensAt: '08:00',
    canBid: true,
    products: [
      { name: 'Dangote Rice 50kg', description: 'Sealed 50kg bag, long grain.', priceKobo: 5_200_000, section: 'Grains', marketplace: true },
      { name: 'Palm Oil 25L Keg', description: 'Pure red palm oil, 25 litres.', priceKobo: 4_100_000, section: 'Oils', marketplace: true },
    ],
  },
  {
    slug: 'healthplus-vi',
    name: 'HealthPlus Pharmacy, VI',
    tags: ['Pharmacy', 'Wellness'],
    area: 'Victoria Island',
    rating: 4.9,
    ratingCount: 560,
    etaMinMinutes: 15,
    etaMaxMinutes: 25,
    deliveryFeeKobo: 110_000,
    isVerified: true,
    isOpen: true,
    closesAt: '22:00',
    products: [
      { name: 'Emzor Paracetamol (Carton)', description: 'Full carton, sealed.', priceKobo: 1_560_000, section: 'Medicine', marketplace: true },
    ],
  },
  {
    slug: 'gadgethub-lekki',
    name: 'GadgetHub Lekki',
    tags: ['Electronics', 'Accessories'],
    area: 'Lekki Phase 1',
    rating: 4.9,
    ratingCount: 320,
    etaMinMinutes: 30,
    etaMaxMinutes: 50,
    deliveryFeeKobo: 150_000,
    isVerified: true,
    isOpen: true,
    closesAt: '20:00',
    canBid: true,
    products: [
      { name: 'iPhone 15 Charger (20W USB-C)', description: 'Genuine Apple 20W, sealed box, 12-month warranty.', priceKobo: 1_850_000, section: 'Chargers', marketplace: true, biddable: true },
    ],
  },
  {
    slug: 'techplug-ng',
    name: 'TechPlug NG',
    tags: ['Electronics', 'Phones'],
    area: 'Victoria Island',
    rating: 4.7,
    ratingCount: 188,
    etaMinMinutes: 25,
    etaMaxMinutes: 40,
    deliveryFeeKobo: 140_000,
    isVerified: true,
    isOpen: true,
    closesAt: '20:00',
    canBid: true,
    products: [],
  },
];

async function main() {
  console.log('Seeding Sendy…');

  // ── vendors + catalogue ───────────────────────────────────
  for (const v of VENDORS) {
    const { products, ...vendor } = v;

    // Cover art is placeholder CC photography until the client sends real
    // assets — see seed-images.ts. Missing keys stay null and the app falls
    // back to its branded gradient rather than rendering a broken image.
    const withCover = { ...vendor, coverUrl: VENDOR_COVERS[vendor.slug] ?? null };

    const created = await prisma.vendor.upsert({
      where: { slug: vendor.slug },
      create: withCover,
      update: withCover,
    });

    for (const p of products) {
      const existing = await prisma.product.findFirst({
        where: { vendorId: created.id, name: p.name },
      });

      const data = {
        vendorId: created.id,
        name: p.name,
        description: p.description,
        priceKobo: p.priceKobo,
        section: p.section,
        badge: 'badge' in p ? (p.badge as string) : null,
        imageUrl: PRODUCT_IMAGES[p.name] ?? null,
        isMarketplace: 'marketplace' in p ? Boolean(p.marketplace) : false,
        isBiddable: 'biddable' in p ? Boolean(p.biddable) : false,
      };

      if (existing) await prisma.product.update({ where: { id: existing.id }, data });
      else await prisma.product.create({ data });
    }

    console.log(`  ✓ ${created.name} (${products.length} products)`);
  }

  // ── admin ─────────────────────────────────────────────────
  /**
   * The admin password is never hardcoded here.
   *
   * This file is in version control, and the admin dashboard can refund money
   * and reassign orders — a literal in the repo is a working credential for
   * anyone who reads it. Set SEED_ADMIN_PASSWORD to choose one; otherwise a
   * random password is generated and printed once, so an unattended seed still
   * leaves no publishable secret behind.
   */
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@sendy.ng';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');

  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });

  await prisma.admin.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Sendy Operations',
      role: 'SUPERADMIN',
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
    // Re-seeding must not silently reset a password already in use.
    update: {},
  });

  console.log(
    existingAdmin
      ? `  ✓ admin ${adminEmail} (existing — password unchanged)`
      : `  ✓ admin ${adminEmail} / ${adminPassword}   ← save this, it is not shown again`
  );

  // ── demo customer ─────────────────────────────────────────
  const customer = await prisma.user.upsert({
    where: { phone: '+2348031234567' },
    create: {
      phone: '+2348031234567',
      firstName: 'Chinedu',
      lastName: 'Okafor',
      email: 'chinedu.okafor@example.com',
      walletBalanceKobo: 520_000,
      referralCode: 'SENDY-CHI42',
    },
    update: {},
  });

  const hasAddress = await prisma.address.count({ where: { userId: customer.id } });
  if (!hasAddress) {
    await prisma.address.createMany({
      data: [
        {
          userId: customer.id,
          label: 'Home',
          line1: '12 Adeola Odeku St, Victoria Island',
          line2: 'Lagos',
          landmark: 'Opposite the blue gate',
          contact: 'Chinedu Okafor',
          phone: '08031234567',
          isDefault: true,
        },
        {
          userId: customer.id,
          label: 'Office',
          line1: '24 Bourdillon Rd, Ikoyi',
          line2: 'Lagos',
          contact: 'Chinedu Okafor',
          phone: '08031234567',
        },
      ],
    });
  }
  console.log(`  ✓ customer ${customer.phone} (wallet ₦5,200)`);

  // ── demo rider, already approved so jobs can be accepted ──
  const rider = await prisma.rider.upsert({
    where: { phone: '+2348094482210' },
    create: {
      phone: '+2348094482210',
      firstName: 'Emeka',
      lastName: 'Adeyemi',
      vehicleType: 'MOTORBIKE',
      plateNumber: 'LND-482-GY',
      zone: 'Victoria Island',
      status: 'APPROVED',
      rating: 4.9,
      completedJobs: 34,
    },
    // vehicleType was added after this rider first existed, so backfill it —
    // an empty update would leave the demo account without the one field the
    // vehicle row on the profile screen reads.
    update: { vehicleType: 'MOTORBIKE' },
  });
  console.log(`  ✓ rider ${rider.phone} (approved — can go online)`);

  /**
   * A second rider left PENDING on purpose.
   *
   * The approved one cannot demonstrate anything about verification: the
   * banner, the disabled availability toggle and the 403 from
   * PATCH /rider/availability are only reachable from an unapproved account,
   * and creating one by hand each time means signing up with a throwaway
   * number and burning an OTP.
   */
  const pendingRider = await prisma.rider.upsert({
    where: { phone: '+2348055512345' },
    create: {
      phone: '+2348055512345',
      firstName: 'Tunde',
      lastName: 'Bakare',
      vehicleType: 'TRICYCLE',
      plateNumber: 'KJA-119-XT',
      zone: 'Yaba',
      status: 'PENDING',
    },
    update: {},
  });
  console.log(`  ✓ rider ${pendingRider.phone} (pending — for testing the verification gate)`);

  // ── an open request with competing bids ───────────────────
  // The bids screen has nothing to render without one, and the bidding window
  // is the Phase-1 differentiator, so it needs to be demoable from a fresh seed.
  const BID_REQUEST_TITLE = 'iPhone 15 Charger (20W USB-C)';

  let request = await prisma.marketplaceRequest.findFirst({
    where: { customerId: customer.id, title: BID_REQUEST_TITLE },
  });

  if (!request) {
    request = await prisma.marketplaceRequest.create({
      data: {
        customerId: customer.id,
        title: BID_REQUEST_TITLE,
        details: 'Genuine Apple, sealed box. Needed today before 6pm.',
        quantity: 1,
        budgetKobo: 2_000_000,
        dropoffArea: 'Victoria Island',
        // Always in the future, so a re-seed never leaves a closed window.
        closesAt: new Date(Date.now() + 30 * 60_000),
      },
    });
  } else {
    // Re-seeding an existing request re-opens its window rather than leaving
    // yesterday's expired one on screen.
    request = await prisma.marketplaceRequest.update({
      where: { id: request.id },
      data: { status: 'OPEN', closesAt: new Date(Date.now() + 30 * 60_000) },
    });
  }

  const bidders: { slug: string; priceKobo: number; etaMinutes: number; note: string }[] = [
    { slug: 'gadgethub-lekki', priceKobo: 1_850_000, etaMinutes: 45, note: 'Sealed, 12-month warranty. Can deliver now.' },
    { slug: 'techplug-ng', priceKobo: 1_780_000, etaMinutes: 90, note: 'Genuine Apple. Free delivery on VI.' },
    { slug: 'ikeja-grains', priceKobo: 1_990_000, etaMinutes: 120, note: 'In stock, comes with a receipt.' },
  ];

  for (const b of bidders) {
    const v = await prisma.vendor.findUnique({ where: { slug: b.slug } });
    if (!v) continue;
    await prisma.bid.upsert({
      // The schema allows one live bid per vendor per request.
      where: { requestId_vendorId: { requestId: request.id, vendorId: v.id } },
      create: {
        requestId: request.id,
        vendorId: v.id,
        priceKobo: b.priceKobo,
        etaMinutes: b.etaMinutes,
        note: b.note,
      },
      update: { priceKobo: b.priceKobo, etaMinutes: b.etaMinutes, note: b.note, status: 'SUBMITTED' },
    });
  }
  console.log(`  ✓ open request "${request.title}" with ${bidders.length} bids (closes in 30 min)`);

  console.log('\nDone. Sign in with OTP_DEV_CODE from your .env.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
