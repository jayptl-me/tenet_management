/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck -- seed script uses dynamic array access and relaxed typings
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
import { Enquiry } from '../models/enquiry.js';
import { AppConfig } from '../models/appConfig.js';
import { reconcileOccupancy } from '../services/occupancy-reconcile.service.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

async function run(): Promise<void> {
  await connectDatabase();
  logger.info('Starting comprehensive dashboard telemetry seed...');

  // 1. Ensure Admin User
  let admin = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (!admin) {
    admin = await User.create({
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      phone: env.ADMIN_PHONE,
      passwordHash: env.ADMIN_PASSWORD,
      role: 'admin',
    });
    logger.info('Admin user created');
  }

  // 2. Ensure AppConfig
  let appConfig = await AppConfig.findOne();
  if (!appConfig) {
    appConfig = await AppConfig.create({
      pgName: 'Sunrise PG Luxury Living',
      tagline: 'Premium Co-living & PG Spaces',
      address: {
        line1: '42 MG Road, Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560034',
      },
      phone: '+919876543210',
      email: 'hello@sunrisepg.in',
      upiId: 'sunrisepg@icici',
      upiPayeeName: 'Sunrise PG Living',
      roomPricing: { sharing2: 8500, sharing3: 7000, sharing4: 5500 },
      primaryColor: '#f59e0b',
      amenities: [
        'High-Speed WiFi',
        'Washing Machine',
        'Fridge',
        'RO Water',
        'Housekeeping',
        'Geyser',
      ],
      features: {
        attendanceEnabled: true,
        laundryEnabled: true,
        messFeedbackEnabled: true,
        visitorManagementEnabled: true,
        guardianPortalEnabled: true,
        noticeBoardEnabled: true,
        emergencyAlertsEnabled: true,
      },
    });
    logger.info('AppConfig seeded');
  }

  // 3. Ensure Floors
  let floors = await Floor.find().sort({ floorNumber: 1 });
  if (floors.length === 0) {
    floors = await Floor.insertMany([
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
  }

  // 4. Ensure Rooms
  let rooms = await Room.find().sort({ roomNumber: 1 });
  if (rooms.length === 0) {
    const roomConfigs = [
      { f: 0, sharing: 2, rent: 8500 },
      { f: 0, sharing: 3, rent: 7000 },
      { f: 0, sharing: 4, rent: 5500 },
      { f: 0, sharing: 2, rent: 9000 },
      { f: 1, sharing: 2, rent: 8000 },
      { f: 1, sharing: 3, rent: 6500 },
      { f: 1, sharing: 4, rent: 5500 },
      { f: 1, sharing: 2, rent: 8500 },
      { f: 2, sharing: 3, rent: 7000 },
      { f: 2, sharing: 4, rent: 5500 },
      { f: 2, sharing: 2, rent: 9500 },
      { f: 2, sharing: 3, rent: 7500 },
    ];
    const roomDocs = roomConfigs.map((c, i) => {
      const bedIds =
        c.sharing === 2 ? ['A', 'B'] : c.sharing === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
      return {
        roomNumber: `R${String(i + 1).padStart(2, '0')}`,
        floorId: floors[c.f]._id,
        sharingType: c.sharing,
        monthlyRent: c.rent,
        isActive: true,
        beds: bedIds.map((bedId) => ({ bedId, isOccupied: false, tenantId: null })),
      };
    });
    rooms = await Room.insertMany(roomDocs);
    logger.info({ count: rooms.length }, 'Rooms seeded');
  }

  // 5. Populate Tenants to reach ~80% occupancy (20+ occupied beds out of 34 total beds)
  const candidateNames = [
    { name: 'Rahul Sharma', email: 'rahul.s@example.com', phone: '+919876599901' },
    { name: 'Priya Mehta', email: 'priya.m@example.com', phone: '+919876599902' },
    { name: 'Amit Kumar', email: 'amit.k@example.com', phone: '+919876599903' },
    { name: 'Sneha Patel', email: 'sneha.p@example.com', phone: '+919876599904' },
    { name: 'Vikram Rao', email: 'vikram.r@example.com', phone: '+919876599905' },
    { name: 'Neha Gupta', email: 'neha.g@example.com', phone: '+919876599906' },
    { name: 'Arjun Verma', email: 'arjun.v@example.com', phone: '+919876599907' },
    { name: 'Ananya Iyer', email: 'ananya.i@example.com', phone: '+919876599908' },
    { name: 'Karthik Nair', email: 'karthik.n@example.com', phone: '+919876599909' },
    { name: 'Rohan Deshmukh', email: 'rohan.d@example.com', phone: '+919876599910' },
    { name: 'Divya Reddy', email: 'divya.r@example.com', phone: '+919876599911' },
    { name: 'Siddharth Joshi', email: 'sid.j@example.com', phone: '+919876599912' },
    { name: 'Pooja Bhatia', email: 'pooja.b@example.com', phone: '+919876599913' },
    { name: 'Manish Tiwari', email: 'manish.t@example.com', phone: '+919876599914' },
    { name: 'Meera Menon', email: 'meera.m@example.com', phone: '+919876599915' },
    { name: 'Tanmay Saxena', email: 'tanmay.s@example.com', phone: '+919876599916' },
    { name: 'Shreya Chawla', email: 'shreya.c@example.com', phone: '+919876599917' },
    { name: 'Aditya Kulkarni', email: 'aditya.k@example.com', phone: '+919876599918' },
    { name: 'Ritu Sen', email: 'ritu.s@example.com', phone: '+919876599919' },
    { name: 'Kunal Singhania', email: 'kunal.s@example.com', phone: '+919876599920' },
    { name: 'Deepak Choudhary', email: 'deepak.c@example.com', phone: '+919876599921' },
    { name: 'Pallavi Rao', email: 'pallavi.r@example.com', phone: '+919876599922' },
    { name: 'Nikhil Bansal', email: 'nikhil.b@example.com', phone: '+919876599923' },
    { name: 'Swati Agarwal', email: 'swati.a@example.com', phone: '+919876599924' },
    { name: 'Harsh Vardhan', email: 'harsh.v@example.com', phone: '+919876599925' },
    { name: 'Gaurav Khandelwal', email: 'gaurav.k@example.com', phone: '+919876599926' },
    { name: 'Shubham Mishra', email: 'shubham.m@example.com', phone: '+919876599927' },
    { name: 'Bhavna Chadha', email: 'bhavna.c@example.com', phone: '+919876599928' },
  ];

  let tenants = await Tenant.find({ isActive: true });
  if (tenants.length < 26) {
    logger.info(
      { current: tenants.length },
      'Populating additional active tenants to reach ~80% occupancy...',
    );
    let assigned = 0;
    for (const room of rooms) {
      for (let b = 0; b < room.beds.length; b++) {
        if (assigned >= candidateNames.length) break;
        if (b === room.beds.length - 1 && room.sharingType > 2 && Math.random() > 0.4) {
          continue; // Leave last bed empty in some rooms for vacancy
        }
        if (!room.beds[b].isOccupied) {
          const cand = candidateNames[assigned];
          let user = await User.findOne({ $or: [{ email: cand.email }, { phone: cand.phone }] });
          if (!user) {
            user = await User.create({
              name: cand.name,
              email: cand.email,
              phone: cand.phone,
              passwordHash: 'password123',
              role: 'tenant',
            });
          }

          // Random move-in dates over past 6 months to feed occupancy history
          const monthsAgo = (assigned % 5) + 1;
          const moveIn = new Date();
          moveIn.setMonth(moveIn.getMonth() - monthsAgo);
          moveIn.setDate(1);

          let tenant = await Tenant.findOne({ userId: user._id });
          if (tenant && tenant.isActive) {
            // User already has an active tenancy elsewhere, do not cross-assign
            assigned++;
            continue;
          }
          if (!tenant) {
            tenant = await Tenant.create({
              userId: user._id,
              roomId: room._id,
              bedId: room.beds[b].bedId,
              moveInDate: moveIn,
              depositPaid: 5000,
              monthlyRent: room.monthlyRent,
              isActive: true,
              emergencyContact: {
                name: `${cand.name.split(' ')[0]}'s Guardian`,
                phone: '+919876540000',
                relation: 'parent',
              },
            });
          }

          user.tenantId = tenant._id.toString();
          await user.save();

          await Room.updateOne(
            { _id: room._id, 'beds.bedId': room.beds[b].bedId },
            { $set: { 'beds.$.isOccupied': true, 'beds.$.tenantId': tenant._id } },
          );
          assigned++;
        }
      }
    }
    tenants = await Tenant.find({ isActive: true });
    logger.info({ tenantCount: tenants.length }, 'Tenants populated');
  }

  // 6. Seed Service Statuses (operational, degraded, down)
  const serviceTypes = [
    'wifi',
    'electricity',
    'water_supply',
    'geyser',
    'washing_machine',
    'fridge',
  ];
  await ServiceStatus.deleteMany({});
  const serviceDocs = [];
  for (let fIdx = 0; fIdx < floors.length; fIdx++) {
    const floor = floors[fIdx];
    for (const st of serviceTypes) {
      let status: 'operational' | 'degraded' | 'down' = 'operational';
      if (fIdx === 2 && st === 'wifi') status = 'degraded';
      if (fIdx === 1 && st === 'washing_machine') status = 'degraded';

      serviceDocs.push({
        floorId: floor._id,
        serviceType: st,
        status,
        lastUpdatedBy: admin._id,
        lastUpdatedAt: new Date(),
      });
    }
  }
  await ServiceStatus.insertMany(serviceDocs);
  logger.info('Floor service statuses seeded');

  // 7. Seed Complaints (28 realistic records with diverse categories, aging, priorities, statuses)
  logger.info('Seeding realistic complaints with SLA aging and category breakdown...');
  await Complaint.deleteMany({});

  const now = new Date();
  const complaintsData = [
    // ── Open Tickets (Active) ──
    {
      cat: 'wifi',
      title: 'WiFi intermittent packet drops on 2nd Floor',
      desc: 'Frequent disconnects during evening work hours in R09 and R10.',
      pri: 'high',
      status: 'open',
      hoursAgo: 6, // < 24h
    },
    {
      cat: 'electricity',
      title: 'Study lamp wall socket sparking in R04',
      desc: 'Right side socket gives sparks when plugging laptop charger. Needs urgent electrician inspection.',
      pri: 'urgent',
      status: 'open',
      hoursAgo: 14, // < 24h
    },
    {
      cat: 'water',
      title: 'Low water pressure in 1st floor common washroom',
      desc: 'Pressure has dropped significantly since yesterday afternoon.',
      pri: 'medium',
      status: 'open',
      hoursAgo: 32, // 24-48h
    },
    {
      cat: 'washing_machine',
      title: 'Washing Machine #2 showing Error E3 drain blockage',
      desc: 'Water remains trapped in the drum after the wash cycle completes.',
      pri: 'medium',
      status: 'open',
      hoursAgo: 58, // > 48h Overdue!
    },

    // ── In Progress Tickets (Under Repair) ──
    {
      cat: 'food_quality',
      title: 'Breakfast chole gravy too oily and cold',
      desc: 'Received lukewarm food and excessively oily curry on Sunday breakfast.',
      pri: 'medium',
      status: 'in_progress',
      adminNotes: 'Mess vendor contacted to adjust oil levels and use heat trays.',
      hoursAgo: 11, // < 24h
    },
    {
      cat: 'water',
      title: 'Hot water geyser tripping MCB in bathroom B2',
      desc: 'Every time geyser is turned on, MCB in the corridor trips immediately.',
      pri: 'urgent',
      status: 'in_progress',
      adminNotes: 'Electrician arriving at 2:00 PM today for element replacement.',
      hoursAgo: 22, // < 24h
    },
    {
      cat: 'cleaning_washroom',
      title: 'Deep cleaning needed for 2nd floor west washroom',
      desc: 'Exhaust fan has accumulated dust and tiles require descaling.',
      pri: 'low',
      status: 'in_progress',
      adminNotes: 'Scheduled with housekeeping staff for afternoon shift.',
      hoursAgo: 38, // 24-48h
    },

    // ── Resolved Tickets (Distributed across month for Heatmap and MTTR) ──
    {
      cat: 'wifi',
      title: 'New router credentials not connecting in R02',
      desc: 'SSID password changed but residents not notified.',
      pri: 'high',
      status: 'resolved',
      hoursAgo: 18,
      resolveHours: 3.5,
    },
    {
      cat: 'cleaning_room',
      title: 'Room R05 missed during morning sweeping',
      desc: 'Door was unlocked with cleaning tag displayed.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 26,
      resolveHours: 2.1,
    },
    {
      cat: 'fridge',
      title: 'Refrigerator freezer door gasket loose',
      desc: 'Ice buildup occurring along the inner rim.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 44,
      resolveHours: 6.8,
    },
    {
      cat: 'noise',
      title: 'Loud music from terrace after 11:30 PM',
      desc: 'Disturbing residents studying for semester exams.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 52,
      resolveHours: 1.2,
    },
    {
      cat: 'electricity',
      title: 'Ceiling tube light humming continuously in R07',
      desc: 'Choke ballast defective causing persistent vibration sound.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 70,
      resolveHours: 5.4,
    },
    {
      cat: 'water',
      title: 'RO Water purifier filter indicator turned red',
      desc: 'Cartridge change required for 1st floor dispenser.',
      pri: 'high',
      status: 'resolved',
      hoursAgo: 85,
      resolveHours: 7.2,
    },
    {
      cat: 'cleaning_room',
      title: 'Trash bin not emptied in R03',
      desc: 'Waste bin full from weekend.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 96,
      resolveHours: 2.0,
    },
    {
      cat: 'washing_machine',
      title: 'Vibration noise during high spin cycle',
      desc: 'Machine feet leveling screw required realignment.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 110,
      resolveHours: 8.5,
    },
    {
      cat: 'wifi',
      title: 'Speed throttled below 15 Mbps on ground floor',
      desc: 'Fibre gateway restart required.',
      pri: 'high',
      status: 'resolved',
      hoursAgo: 120,
      resolveHours: 1.8,
    },
    {
      cat: 'lights',
      title: 'Balcony safety LED bulb burnt out',
      desc: 'Dark corner in 2nd floor balcony.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 130,
      resolveHours: 4.2,
    },
    {
      cat: 'cleaning_washroom',
      title: 'Hand wash soap dispenser empty in common basin',
      desc: 'Refill needed.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 140,
      resolveHours: 1.5,
    },
    {
      cat: 'food_quality',
      title: 'Rotis hard and dry during dinner',
      desc: 'Casserole lid left open causing bread to dry.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 145,
      resolveHours: 4.0,
    },
    {
      cat: 'water',
      title: 'Bathroom tap aerator clogged with mineral scale',
      desc: 'Water splashing unevenly.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 155,
      resolveHours: 3.1,
    },
    {
      cat: 'noise',
      title: 'Bike exhaust revving in parking lot at midnight',
      desc: 'Security notified to enforce silence hours.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 162,
      resolveHours: 1.0,
    },
    {
      cat: 'electricity',
      title: 'Main lobby switchboard cover panel cracked',
      desc: 'Child hazard, replacement faceplate installed.',
      pri: 'high',
      status: 'resolved',
      hoursAgo: 168,
      resolveHours: 5.9,
    },
    {
      cat: 'cleaning_room',
      title: 'Cobwebs near AC indoor unit ceiling',
      desc: 'Housekeeping addressed during Saturday deep clean.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 172,
      resolveHours: 3.0,
    },
    {
      cat: 'wifi',
      title: 'DNS resolution failure for corporate VPN portals',
      desc: 'Primary DNS set to 1.1.1.1 on core mikrotik router.',
      pri: 'high',
      status: 'resolved',
      hoursAgo: 178,
      resolveHours: 2.2,
    },
    {
      cat: 'other',
      title: 'Shoe rack designated shelf missing label in R08',
      desc: 'Label printed and affixed.',
      pri: 'low',
      status: 'resolved',
      hoursAgo: 184,
      resolveHours: 24.0,
    },
    {
      cat: 'food_quality',
      title: 'Dinner dessert portion depleted early',
      desc: 'Extra gulab jamuns provided by vendor for late shifts.',
      pri: 'medium',
      status: 'resolved',
      hoursAgo: 190,
      resolveHours: 2.5,
    },

    // ── Dismissed Tickets (Invalid / Duplicate) ──
    {
      cat: 'noise',
      title: 'Outside construction noise on public street',
      desc: 'Municipal road repair work outside PG premises; out of management jurisdiction.',
      pri: 'low',
      status: 'dismissed',
      adminNotes: 'External city road repair. Informed tenant of BBMP schedule.',
      hoursAgo: 72,
    },
    {
      cat: 'other',
      title: 'Personal courier parcel delivered to neighbor room',
      desc: 'Tenant retrieved package directly from lobby shelf.',
      pri: 'low',
      status: 'dismissed',
      adminNotes: 'Resolved mutually between tenants.',
      hoursAgo: 100,
    },
  ];

  const complaintDocs = complaintsData.map((item, idx) => {
    const tIdx = idx % tenants.length;
    const tenant = tenants[tIdx];
    const createdDate = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000);
    const resolvedDate = item.resolveHours
      ? new Date(createdDate.getTime() + item.resolveHours * 60 * 60 * 1000)
      : null;

    return {
      tenantId: tenant._id,
      roomId: tenant.roomId,
      category: item.cat,
      title: item.title,
      description: item.desc,
      priority: item.pri,
      status: item.status,
      adminNotes: item.adminNotes ?? '',
      resolvedAt: resolvedDate,
      createdAt: createdDate,
      updatedAt: resolvedDate ?? createdDate,
    };
  });

  await Complaint.insertMany(complaintDocs);
  logger.info({ count: complaintDocs.length }, 'Complaints seeded');

  // 8. Seed 14 Days of Daily Menus & Meal Feedbacks
  logger.info('Seeding 14 days of authentic Daily Menus & Meal Feedback...');
  await DailyMenu.deleteMany({});
  await MealFeedback.deleteMany({});

  const menuCycle = [
    {
      breakfast: [
        { name: 'Masala Dosa & Sambar' },
        { name: 'Coconut Chutney' },
        { name: 'Filter Coffee / Tea' },
      ],
      lunch: [
        { name: 'Paneer Butter Masala' },
        { name: 'Jeera Rice' },
        { name: 'Dal Tadka' },
        { name: 'Butter Roti' },
        { name: 'Cucumber Salad' },
      ],
      dinner: [
        { name: 'Dal Makhani' },
        { name: 'Tandoori Roti' },
        { name: 'Steamed Rice' },
        { name: 'Gulab Jamun' },
      ],
    },
    {
      breakfast: [
        { name: 'Idli Vada Combo' },
        { name: 'Tomato Chutney & Sambar' },
        { name: 'Ginger Tea' },
      ],
      lunch: [
        { name: 'Rajma Masala' },
        { name: 'Basmati Chawal' },
        { name: 'Aloo Gobi Dry' },
        { name: 'Phulka' },
        { name: 'Boondi Raita' },
      ],
      dinner: [
        { name: 'Kadai Paneer' },
        { name: 'Lachha Paratha' },
        { name: 'Veg Pulao' },
        { name: 'Moong Dal Halwa' },
      ],
    },
    {
      breakfast: [
        { name: 'Aloo Paratha with Butter' },
        { name: 'Fresh Curd & Pickle' },
        { name: 'Masala Chai' },
      ],
      lunch: [
        { name: 'Veg Biryani with Salan' },
        { name: 'Mixed Veg Kurma' },
        { name: 'Onion Raita' },
        { name: 'Papad' },
      ],
      dinner: [
        { name: 'Palak Paneer' },
        { name: 'Phulka & Steamed Rice' },
        { name: 'Yellow Moong Dal' },
        { name: 'Fruit Custard' },
      ],
    },
    {
      breakfast: [
        { name: 'Poha with Roasted Peanuts' },
        { name: 'Boiled Eggs / Sprouts' },
        { name: 'Lemon Tea' },
      ],
      lunch: [
        { name: 'South Indian Thali' },
        { name: 'Sambar & Rasam' },
        { name: 'Cabbage Poriyal' },
        { name: 'Curd Rice' },
        { name: 'Appalam' },
      ],
      dinner: [
        { name: 'Egg Bhurji / Paneer Bhurji' },
        { name: 'Tawa Roti' },
        { name: 'Khichdi with Ghee' },
        { name: 'Jalebi' },
      ],
    },
    {
      breakfast: [
        { name: 'Poori Bhaji (Potato Masala)' },
        { name: 'Semolina Kesari' },
        { name: 'Coffee / Tea' },
      ],
      lunch: [
        { name: 'Chole Bhature' },
        { name: 'Jeera Rice' },
        { name: 'Punjabi Kadhi Pakora' },
        { name: 'Sirka Onion Salad' },
      ],
      dinner: [
        { name: 'Methi Malai Matar' },
        { name: 'Garlic Naan' },
        { name: 'Peas Pulao' },
        { name: 'Rasgulla' },
      ],
    },
    {
      breakfast: [
        { name: 'Uttapam with Onion & Tomato' },
        { name: 'Green Coconut Chutney' },
        { name: 'Filter Coffee' },
      ],
      lunch: [
        { name: 'Mushroom Pepper Masala' },
        { name: 'Ghee Rice' },
        { name: 'Dal Fry' },
        { name: 'Chapati' },
        { name: 'Kachumber' },
      ],
      dinner: [
        { name: 'Shahi Paneer' },
        { name: 'Rumali Roti' },
        { name: 'Veg Fried Rice' },
        { name: 'Ice Cream Cup' },
      ],
    },
    {
      breakfast: [
        { name: 'Bread Omelette / Veg Sandwich' },
        { name: 'Banana & Boiled Eggs' },
        { name: 'Cold Bournvita' },
      ],
      lunch: [
        { name: 'Special Sunday Dum Biryani' },
        { name: 'Mirchi Ka Salan' },
        { name: 'Burani Raita' },
        { name: 'Gulab Jamun' },
      ],
      dinner: [
        { name: 'Light Khichdi & Kadhi' },
        { name: 'Aloo Methi' },
        { name: 'Phulka' },
        { name: 'Papad & Pickle' },
      ],
    },
  ];

  const menuDocs = [];
  const feedbackDocs = [];

  for (let d = 13; d >= 0; d--) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - d);
    const dateStr = targetDate.toISOString().slice(0, 10);
    const menuIndex = d % menuCycle.length;
    const dayMenu = menuCycle[menuIndex];

    menuDocs.push({
      date: dateStr,
      meals: dayMenu,
    });

    const meals: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];
    for (const mealType of meals) {
      const t1 = tenants[(d * 3) % tenants.length];
      const t2 = tenants[(d * 3 + 1) % tenants.length];

      let baseRating = mealType === 'lunch' ? 4.5 : mealType === 'breakfast' ? 4.2 : 4.0;
      if (d === 2 && mealType === 'breakfast') baseRating = 3.6;
      if (d === 0 && mealType === 'lunch') baseRating = 4.8;

      const r1 = Math.min(
        5,
        Math.max(3, Math.round((baseRating + (Math.random() * 0.8 - 0.4)) * 10) / 10),
      );
      const r2 = Math.min(
        5,
        Math.max(3, Math.round((baseRating + (Math.random() * 0.6 - 0.3)) * 10) / 10),
      );

      const tagPool = ['taste', 'quantity', 'hygiene', 'variety', 'timing'];
      const tag1 = [tagPool[d % tagPool.length], tagPool[(d + 1) % tagPool.length]];
      const tag2 = [tagPool[(d + 2) % tagPool.length]];

      feedbackDocs.push({
        tenantId: t1._id,
        date: dateStr,
        mealType,
        rating: Math.round(r1),
        categories: tag1,
        status: 'submitted',
        createdAt: targetDate,
      });

      feedbackDocs.push({
        tenantId: t2._id,
        date: dateStr,
        mealType,
        rating: Math.round(r2),
        categories: tag2,
        status: 'acknowledged',
        createdAt: targetDate,
      });
    }
  }

  await DailyMenu.insertMany(menuDocs);
  await MealFeedback.insertMany(feedbackDocs);
  logger.info(
    { menus: menuDocs.length, feedbacks: feedbackDocs.length },
    'Daily menus and meal feedback seeded',
  );

  // 9. Seed Invoices & Payments for 6 Months (Revenue Trend & Payment Funnel)
  logger.info('Seeding 6 months of invoices and payments...');
  await Invoice.deleteMany({});
  await Payment.deleteMany({});

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(mStr);
  }
  const currentMonth = months[months.length - 1];

  const invoiceDocs = [];
  const paymentDocs = [];
  let invoiceCounter = 1;

  for (let mIdx = 0; mIdx < months.length; mIdx++) {
    const mStr = months[mIdx];
    const isCurrent = mStr === currentMonth;

    for (let tIdx = 0; tIdx < tenants.length; tIdx++) {
      const tenant = tenants[tIdx];
      const invNum = `INV-${mStr.replace('-', '')}-${String(invoiceCounter++).padStart(3, '0')}`;
      const rent = tenant.monthlyRent || 7500;
      const electricity = tIdx % 2 === 0 ? 650 : 450;
      const total = rent + electricity;
      const dueDate = new Date(parseInt(mStr.slice(0, 4)), parseInt(mStr.slice(5, 7)) - 1, 5);

      let status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' = 'paid';
      if (isCurrent) {
        if (tIdx < 10) status = 'paid';
        else if (tIdx < 13) status = 'partial';
        else if (tIdx < 16) status = 'sent';
        else if (tIdx < 18) status = 'overdue';
        else status = 'draft';
      }

      const invDoc = {
        invoiceNumber: invNum,
        tenantId: tenant._id,
        month: mStr,
        generatedAt: new Date(dueDate.getTime() - 4 * 24 * 60 * 60 * 1000),
        lineItems: [
          { description: 'Room Accommodation Fee', amount: rent },
          { description: 'Electricity Sub-meter Charges', amount: electricity },
        ],
        rentAmount: rent,
        electricityAmount: electricity,
        otherCharges: 0,
        totalAmount: total,
        dueDate,
        status,
      };
      invoiceDocs.push(invDoc);
    }
  }

  const createdInvoices = await Invoice.insertMany(invoiceDocs);
  logger.info({ count: createdInvoices.length }, 'Invoices seeded');

  // Match Payments to Invoices
  for (const inv of createdInvoices) {
    if (inv.status === 'paid') {
      paymentDocs.push({
        tenantId: inv.tenantId,
        invoiceId: inv._id,
        amount: inv.totalAmount,
        type: 'rent',
        method: 'upi',
        status: 'paid',
        month: inv.month,
        dueDate: inv.dueDate,
        paidAt: new Date(inv.dueDate.getTime() - 24 * 60 * 60 * 1000),
        utrNumber: `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      });
    } else if (inv.status === 'partial') {
      paymentDocs.push({
        tenantId: inv.tenantId,
        invoiceId: inv._id,
        amount: Math.round(inv.totalAmount / 2),
        type: 'rent',
        method: 'upi',
        status: 'paid',
        month: inv.month,
        dueDate: inv.dueDate,
        paidAt: new Date(inv.dueDate.getTime()),
        utrNumber: `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      });
    }
  }

  // Add 2 payments with status: 'pending_verification' for the Attention Required Triage Banner
  const sentInvoices = createdInvoices.filter(
    (inv) => inv.month === currentMonth && inv.status === 'sent',
  );
  if (sentInvoices.length >= 2) {
    paymentDocs.push({
      tenantId: sentInvoices[0].tenantId,
      invoiceId: sentInvoices[0]._id,
      amount: sentInvoices[0].totalAmount,
      type: 'rent',
      method: 'upi',
      status: 'pending_verification',
      month: currentMonth,
      dueDate: sentInvoices[0].dueDate,
      paidAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      utrNumber: 'HDFC982348102931',
      notes: 'Tenant submitted Google Pay screenshot via portal',
    });
    paymentDocs.push({
      tenantId: sentInvoices[1].tenantId,
      invoiceId: sentInvoices[1]._id,
      amount: sentInvoices[1].totalAmount,
      type: 'rent',
      method: 'upi',
      status: 'pending_verification',
      month: currentMonth,
      dueDate: sentInvoices[1].dueDate,
      paidAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      utrNumber: 'ICIC849201948270',
      notes: 'Payment transferred via IMPS',
    });
  }

  await Payment.insertMany(paymentDocs);
  logger.info({ count: paymentDocs.length }, 'Payments seeded');

  // 10. Seed Enquiries
  await Enquiry.deleteMany({});
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 3);
  const tenDaysAgo = new Date(now);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  await Enquiry.insertMany([
    {
      name: 'Rajat Kapoor',
      email: 'rajat.k@gmail.com',
      phone: '+919811223344',
      preferredSharing: '2',
      source: 'landing_page',
      status: 'new',
      notes: 'Working at Microsoft, needs quiet 2nd floor room with high-speed WiFi',
      createdAt: sevenDaysAgo,
    },
    {
      name: 'Simran Walia',
      email: 'simran.w@gmail.com',
      phone: '+919822334455',
      preferredSharing: '3',
      source: 'referral',
      status: 'new',
      notes: 'Referred by Priya Mehta from R02',
      createdAt: now,
    },
    {
      name: 'Deepak Joshi',
      email: 'deepak.j@gmail.com',
      phone: '+919833445566',
      preferredSharing: '2',
      source: 'walk_in',
      status: 'contacted',
      notes: 'Followed up via WhatsApp, visiting for room tour on Saturday',
      createdAt: tenDaysAgo,
    },
    {
      name: 'Kavita Sundaram',
      email: 'kavita.s@gmail.com',
      phone: '+919844556677',
      preferredSharing: '2',
      source: 'phone_call',
      status: 'contacted',
      notes: 'Shared room photos and fee structure',
      createdAt: tenDaysAgo,
    },
  ]);
  logger.info('Enquiries seeded');

  logger.info(
    'Dashboard telemetry seed complete! All collections populated with live-anchored data.',
  );
  await reconcileOccupancy(false);
  await disconnectDatabase();
}

run().catch((err) => {
  logger.error({ err }, 'Dashboard telemetry seed failed');
  process.exit(1);
});
