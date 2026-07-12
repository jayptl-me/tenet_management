/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- seed script uses dynamic array access; checks not needed for dev-only code
import { connectDatabase, disconnectDatabase } from '../lib/db.js';
import { User } from '../models/user.js';
import { Floor } from '../models/floor.js';
import { Room } from '../models/room.js';
import { Tenant } from '../models/tenant.js';
import { Invoice } from '../models/invoice.js';
import { Payment } from '../models/payment.js';
import { Complaint } from '../models/complaint.js';
import { ServiceStatus } from '../models/serviceStatus.js';
import { MealFeedback } from '../models/mealFeedback.js';
import { DailyMenu } from '../models/dailyMenu.js';
import { NoticePost } from '../models/noticePost.js';
import { AppConfig } from '../models/appConfig.js';
import { Asset } from '../models/asset.js';
import { Guardian } from '../models/guardian.js';
import { LaundrySlot } from '../models/laundrySlot.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

async function seedAdmin(): Promise<string> {
  const existing = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });

  if (existing) {
    logger.info({ email: env.ADMIN_EMAIL }, 'Admin user already exists, skipping');
    return existing.id;
  }

  const admin = new User({
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    phone: env.ADMIN_PHONE,
    passwordHash: env.ADMIN_PASSWORD,
    role: 'admin',
  });

  await admin.save();
  logger.info({ email: env.ADMIN_EMAIL, id: admin.id }, 'Admin user created');
  return admin.id;
}

async function seedAppConfig(): Promise<void> {
  const existing = await AppConfig.findOne();
  if (existing) {
    logger.info('AppConfig already exists, skipping');
    return;
  }

  await AppConfig.create({
    pgName: 'Sunrise PG',
    tagline: 'Your home, your space.',
    address: {
      line1: '42 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
    phone: '+919876543210',
    email: 'hello@sunrisepg.in',
    upiId: 'pgowner@okhdfcbank',
    upiPayeeName: 'Sunrise PG',
    roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
    primaryColor: '#f59e0b',
    amenities: ['High-Speed WiFi', 'Washing Machine', 'Fridge', 'RO Water', 'Housekeeping'],
    testimonials: [
      {
        name: 'Rahul S.',
        occupation: 'Software Engineer',
        rating: 5,
        quote: 'Best PG experience in Bangalore!',
      },
      { name: 'Priya M.', occupation: 'Designer', rating: 4, quote: 'Clean rooms and great food.' },
    ],
    features: {
      attendanceEnabled: false,
      laundryEnabled: true,
      messFeedbackEnabled: true,
      visitorManagementEnabled: true,
      guardianPortalEnabled: true,
      noticeBoardEnabled: true,
      emergencyAlertsEnabled: true,
    },
  });

  logger.info('AppConfig created');
}

async function seedSampleData(adminId: string): Promise<void> {
  // ── Floors ──────────────────────────────────────────
  const floors: any[] = await Floor.insertMany([
    {
      floorNumber: 0,
      label: 'Ground Floor',
      totalRooms: 4,
      amenities: { washingMachines: 2, fridges: 1 },
    },
    {
      floorNumber: 1,
      label: 'First Floor',
      totalRooms: 4,
      amenities: { washingMachines: 2, fridges: 1 },
    },
    {
      floorNumber: 2,
      label: 'Second Floor',
      totalRooms: 4,
      amenities: { washingMachines: 2, fridges: 1 },
    },
  ]);
  logger.info({ count: floors.length }, 'Floors seeded');

  // ── Rooms ───────────────────────────────────────────
  const roomConfigs = [
    { f: 0, sharing: 2, rent: 8000 },
    { f: 0, sharing: 3, rent: 6500 },
    { f: 0, sharing: 4, rent: 5000 },
    { f: 0, sharing: 2, rent: 8500 },
    { f: 1, sharing: 2, rent: 7500 },
    { f: 1, sharing: 3, rent: 6000 },
    { f: 1, sharing: 4, rent: 5000 },
    { f: 1, sharing: 2, rent: 8000 },
    { f: 2, sharing: 3, rent: 6500 },
    { f: 2, sharing: 4, rent: 5000 },
    { f: 2, sharing: 2, rent: 9000 },
    { f: 2, sharing: 3, rent: 7000 },
  ];

  const roomDocs: any[] = [];
  for (let i = 0; i < roomConfigs.length; i++) {
    const c = roomConfigs[i];
    const bedIds =
      c.sharing === 2 ? ['A', 'B'] : c.sharing === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
    roomDocs.push({
      roomNumber: `R${String(i + 1).padStart(2, '0')}`,
      floorId: floors[c.f]._id,
      sharingType: c.sharing,
      monthlyRent: c.rent,
      isActive: true,
      beds: bedIds.map((bedId: string) => ({ bedId, isOccupied: false, tenantId: null })),
    });
  }
  const rooms: any[] = await Room.insertMany(roomDocs);
  logger.info({ count: rooms.length }, 'Rooms seeded');

  // ── Service Status ──────────────────────────────────
  const serviceTypes = [
    'wifi',
    'washing_machine_1',
    'washing_machine_2',
    'fridge',
    'water_supply',
    'electricity',
  ];
  const ssDocs: any[] = [];
  for (const floor of floors) {
    for (const st of serviceTypes) {
      ssDocs.push({
        floorId: floor._id,
        serviceType: st,
        status: 'operational',
        lastUpdatedBy: adminId,
      });
    }
  }
  await ServiceStatus.insertMany(ssDocs);
  logger.info({ count: ssDocs.length }, 'Service statuses seeded');

  // ── Tenants + Users ─────────────────────────────────
  const sampleTenants = [
    {
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+919876543211',
      bedIdx: 0,
      roomIdx: 0,
    },
    {
      name: 'Priya Mehta',
      email: 'priya@example.com',
      phone: '+919876543212',
      bedIdx: 1,
      roomIdx: 1,
    },
    {
      name: 'Amit Kumar',
      email: 'amit@example.com',
      phone: '+919876543213',
      bedIdx: 0,
      roomIdx: 3,
    },
    {
      name: 'Sneha Patel',
      email: 'sneha@example.com',
      phone: '+919876543214',
      bedIdx: 1,
      roomIdx: 4,
    },
    {
      name: 'Vikram Rao',
      email: 'vikram@example.com',
      phone: '+919876543215',
      bedIdx: 0,
      roomIdx: 6,
    },
    {
      name: 'Neha Gupta',
      email: 'neha@example.com',
      phone: '+919876543216',
      bedIdx: 1,
      roomIdx: 7,
    },
  ];

  const tenantPairs: Array<{ userId: string; tenantId: string }> = [];

  for (const data of sampleTenants) {
    const user = new User({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: 'password123',
      role: 'tenant',
    });
    await user.save();

    const room = rooms[data.roomIdx];

    const tenant = new Tenant({
      userId: user._id,
      roomId: room._id,
      bedId: room.beds[data.bedIdx].bedId,
      moveInDate: new Date('2025-06-01'),
      depositPaid: 5000,
      monthlyRent: room.monthlyRent,
      isActive: true,
      emergencyContact: {
        name: `${data.name}'s Parent`,
        phone: '+919876543300',
        relation: 'parent',
      },
    });
    await tenant.save();

    // beds.tenantId must reference Tenant, not User
    room.beds[data.bedIdx].isOccupied = true;
    room.beds[data.bedIdx].tenantId = tenant._id;
    await room.save();

    // Backfill User.tenantId so Flutter portal can resolve tenantId (P0-F1)
    user.tenantId = tenant._id.toString();
    await user.save();

    tenantPairs.push({ userId: user.id, tenantId: tenant.id });
  }
  logger.info({ count: sampleTenants.length }, 'Tenants + Users seeded');

  // ── Invoices ────────────────────────────────────────
  const month = '2026-06';
  const invoiceDueDate = new Date(2026, 5, 5); // 5th of billing month
  const invoiceDocs: any[] = [];
  for (let i = 0; i < tenantPairs.length; i++) {
    invoiceDocs.push({
      invoiceNumber: `INV-202606-${String(i + 1).padStart(3, '0')}`,
      tenantId: tenantPairs[i].tenantId,
      month,
      lineItems: [{ description: 'Room Rent', amount: 6500 }],
      rentAmount: 6500,
      electricityAmount: 0,
      otherCharges: 0,
      totalAmount: 6500,
      dueDate: invoiceDueDate,
      status: 'sent',
    });
  }
  const invoices: any[] = await Invoice.insertMany(invoiceDocs);
  logger.info({ count: invoices.length }, 'Invoices seeded');

  // ── Payments ────────────────────────────────────────
  const paymentDocs: any[] = [];
  for (let i = 0; i < Math.min(3, invoices.length); i++) {
    paymentDocs.push({
      tenantId: tenantPairs[i].tenantId,
      invoiceId: invoices[i]._id,
      amount: 6500,
      type: 'rent',
      method: 'upi',
      status: i === 0 ? 'paid' : 'pending',
      month,
      dueDate: new Date('2026-06-05'),
      paidAt: i === 0 ? new Date() : null,
      utrNumber: i === 0 ? 'UTR123456789' : undefined,
    });
  }
  await Payment.insertMany(paymentDocs);
  logger.info({ count: paymentDocs.length }, 'Payments seeded');

  // ── Complaints ──────────────────────────────────────
  await Complaint.insertMany([
    {
      tenantId: tenantPairs[0].tenantId,
      roomId: rooms[0]._id,
      category: 'wifi',
      title: 'WiFi keeps disconnecting',
      description: 'The WiFi drops every 10 minutes in room R01.',
      priority: 'high',
      status: 'open',
    },
    {
      tenantId: tenantPairs[1].tenantId,
      roomId: rooms[1]._id,
      category: 'water',
      title: 'No hot water in bathroom',
      description: 'Hot water not available since morning.',
      priority: 'medium',
      status: 'in_progress',
      adminNotes: 'Plumber called, will visit tomorrow.',
    },
    {
      tenantId: tenantPairs[2].tenantId,
      roomId: rooms[3]._id,
      category: 'cleaning_room',
      title: 'Room not cleaned this week',
      description: 'Housekeeping missed my room twice this week.',
      priority: 'low',
      status: 'resolved',
      resolvedAt: new Date(),
    },
  ] as any[]);
  logger.info('Complaints seeded');

  // ── Meal Feedback ──────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  await MealFeedback.insertMany([
    {
      tenantId: tenantPairs[0].tenantId,
      date: today,
      mealType: 'lunch',
      rating: 4,
      categories: ['taste'],
    },
    {
      tenantId: tenantPairs[1].tenantId,
      date: today,
      mealType: 'lunch',
      rating: 5,
      categories: ['variety', 'taste'],
    },
    {
      tenantId: tenantPairs[2].tenantId,
      date: today,
      mealType: 'dinner',
      rating: 3,
      categories: ['quantity'],
    },
  ] as any[]);
  logger.info('Meal feedback seeded');

  // ── Daily Menu ──────────────────────────────────────
  await DailyMenu.create({
    date: today,
    meals: {
      breakfast: [{ name: 'Idli Sambar' }, { name: 'Tea/Coffee' }],
      lunch: [{ name: 'Dal Makhani' }, { name: 'Jeera Rice' }, { name: 'Roti' }],
      dinner: [{ name: 'Paneer Butter Masala' }, { name: 'Naan' }, { name: 'Gulab Jamun' }],
    },
  } as any);
  logger.info('Daily menu seeded');

  // ── Notice Posts ────────────────────────────────────
  await NoticePost.insertMany([
    {
      title: 'Welcome to Sunrise PG!',
      content:
        'We are thrilled to have you here. Please read the PG rules posted on the notice board.',
      pinned: true,
      authorId: adminId,
      targetType: 'all',
    },
    {
      title: 'Monthly Maintenance - June 15',
      content:
        'There will be a power shutdown from 10 AM to 2 PM on June 15 for electrical maintenance.',
      pinned: false,
      authorId: adminId,
      targetType: 'all',
    },
  ] as any[]);
  logger.info('Notice posts seeded');

  // ── Assets ──────────────────────────────────────────
  await Asset.insertMany([
    {
      name: 'Single Bed with Mattress',
      category: 'furniture',
      location: 'All Rooms',
      quantity: 12,
      status: 'in_use',
    },
    {
      name: 'Washing Machine LG 7kg',
      category: 'appliance',
      location: 'Ground Floor Utility',
      quantity: 2,
      status: 'in_use',
      nextServiceDate: new Date('2026-09-01'),
    },
    {
      name: 'Samsung Fridge 250L',
      category: 'appliance',
      location: 'Ground Floor Kitchen',
      quantity: 1,
      status: 'in_use',
    },
    {
      name: 'Dettol Floor Cleaner',
      category: 'cleaning',
      location: 'Store Room',
      quantity: 5,
      lowStockThreshold: 2,
      status: 'available',
    },
  ] as any[]);
  logger.info('Assets seeded');

  // ── Guardians ──────────────────────────────────────
  const g1 = new User({
    name: 'Rajesh Sharma',
    email: 'rajesh.sharma@example.com',
    phone: '+919876543301',
    passwordHash: 'password123',
    role: 'guardian',
  });
  await g1.save();
  await Guardian.create({
    userId: g1._id,
    tenantId: tenantPairs[0].tenantId,
    name: 'Rajesh Sharma',
    phone: '+919876543301',
    email: 'rajesh.sharma@example.com',
    relation: 'father',
  } as any);

  const g2 = new User({
    name: 'Sunita Mehta',
    email: 'sunita.mehta@example.com',
    phone: '+919876543302',
    passwordHash: 'password123',
    role: 'guardian',
  });
  await g2.save();
  await Guardian.create({
    userId: g2._id,
    tenantId: tenantPairs[1].tenantId,
    name: 'Sunita Mehta',
    phone: '+919876543302',
    email: 'sunita.mehta@example.com',
    relation: 'mother',
  } as any);
  logger.info('Guardians seeded');

  // ── Laundry Slots ──────────────────────────────────
  const todayDate = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  await LaundrySlot.insertMany([
    {
      tenantId: tenantPairs[0].tenantId,
      slotDate: todayDate,
      slotTime: '08:00-10:00',
      items: 5,
      status: 'completed',
      notes: 'Regular wash completed',
    },
    {
      tenantId: tenantPairs[1].tenantId,
      slotDate: todayDate,
      slotTime: '10:00-12:00',
      items: 3,
      status: 'booked',
    },
    {
      tenantId: tenantPairs[2].tenantId,
      slotDate: tomorrowDate,
      slotTime: '08:00-10:00',
      items: 7,
      status: 'booked',
      notes: 'Includes bedsheets',
    },
    {
      tenantId: tenantPairs[3].tenantId,
      slotDate: tomorrowDate,
      slotTime: '14:00-16:00',
      items: 4,
      status: 'confirmed',
    },
  ] as any[]);
  logger.info('Laundry slots seeded');
}

async function seed(): Promise<void> {
  logger.info('Starting database seed...');

  await connectDatabase();

  const adminId = await seedAdmin();
  await seedAppConfig();

  const args = Bun.argv.slice(2);
  if (args.includes('--with-sample-data')) {
    logger.info('Seeding sample data...');
    await seedSampleData(adminId);
  }

  await disconnectDatabase();
  logger.info('Seed completed successfully');
  process.exit(0);
}

seed().catch((err) => {
  logger.fatal({ err }, 'Seed failed');
  process.exit(1);
});
