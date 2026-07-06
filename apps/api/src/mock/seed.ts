/**
 * Seeds the in-memory mock database with demo data.
 * Uses the mock mongoose's internal collection store.
 * Called at server startup when MOCK_DB=true.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import mockMongoose from 'mongoose';

const { __getCollection: getCollection, __generateObjectId: genId } = mockMongoose;

export function seedMockData(): void {
  const now = new Date();
  const adminId = genId();
  const passwordHash = bcrypt.hashSync('Admin@123456', 12);

  // ── Admin User ────────────────────────────────────────
  getCollection('User').docs.set(adminId, {
    _id: adminId,
    name: 'Super Admin',
    email: 'admin@pgmanagement.local',
    phone: '+919876543210',
    passwordHash,
    role: 'admin',
    ntfyTopic: crypto.randomUUID(),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    __v: 0,
  });

  // ── Floors ────────────────────────────────────────────
  const floors = [];
  for (const [num, label] of [[0, 'Ground Floor'], [1, 'First Floor'], [2, 'Second Floor']]) {
    const id = genId();
    floors.push({ _id: id, floorNumber: num, label, totalRooms: 4, amenities: { washingMachines: 2, fridges: 1 }, createdAt: now, updatedAt: now });
    getCollection('Floor').docs.set(id, floors[floors.length - 1]);
  }

  // ── Rooms ─────────────────────────────────────────────
  const roomDefs = [
    { f: 0, sharing: 2, rent: 8000, beds: ['A', 'B'] },
    { f: 0, sharing: 3, rent: 6500, beds: ['A', 'B', 'C'] },
    { f: 0, sharing: 4, rent: 5000, beds: ['A', 'B', 'C', 'D'] },
    { f: 0, sharing: 2, rent: 8500, beds: ['A', 'B'] },
    { f: 1, sharing: 2, rent: 7500, beds: ['A', 'B'] },
    { f: 1, sharing: 3, rent: 6000, beds: ['A', 'B', 'C'] },
    { f: 1, sharing: 4, rent: 5000, beds: ['A', 'B', 'C', 'D'] },
    { f: 1, sharing: 2, rent: 8000, beds: ['A', 'B'] },
    { f: 2, sharing: 3, rent: 6500, beds: ['A', 'B', 'C'] },
    { f: 2, sharing: 4, rent: 5000, beds: ['A', 'B', 'C', 'D'] },
    { f: 2, sharing: 2, rent: 9000, beds: ['A', 'B'] },
    { f: 2, sharing: 3, rent: 7000, beds: ['A', 'B', 'C'] },
  ];
  const rooms = [];
  for (let i = 0; i < roomDefs.length; i++) {
    const d = roomDefs[i];
    const _id = genId();
    rooms.push({
      _id, floorId: floors[d.f]._id, roomNumber: `R${String(i + 1).padStart(2, '0')}`,
      sharingType: d.sharing, monthlyRent: d.rent, isActive: true,
      beds: d.beds.map(b => ({ bedId: b, isOccupied: false, tenantId: null })),
      occupancyCount: 0, createdAt: now, updatedAt: now, __v: 0,
    });
    getCollection('Room').docs.set(_id, rooms[i]);
  }

  // ── Service Statuses ─────────────────────────────────
  const svcTypes = ['wifi', 'washing_machine_1', 'washing_machine_2', 'fridge', 'water_supply', 'electricity'];
  for (const floor of floors) {
    for (const st of svcTypes) {
      const id = genId();
      getCollection('ServiceStatus').docs.set(id, {
        _id: id, floorId: floor._id, serviceType: st, status: 'operational',
        lastUpdatedBy: adminId, lastUpdatedAt: now, createdAt: now, updatedAt: now, __v: 0,
      });
    }
  }

  // ── Sample Tenants ────────────────────────────────────
  const tenantData = [
    { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+919876543211', roomIdx: 0, bedIdx: 0 },
    { name: 'Priya Mehta', email: 'priya@example.com', phone: '+919876543212', roomIdx: 1, bedIdx: 1 },
    { name: 'Amit Kumar', email: 'amit@example.com', phone: '+919876543213', roomIdx: 3, bedIdx: 0 },
    { name: 'Sneha Patel', email: 'sneha@example.com', phone: '+919876543214', roomIdx: 4, bedIdx: 1 },
    { name: 'Vikram Rao', email: 'vikram@example.com', phone: '+919876543215', roomIdx: 6, bedIdx: 0 },
    { name: 'Neha Gupta', email: 'neha@example.com', phone: '+919876543216', roomIdx: 7, bedIdx: 1 },
  ];
  const tenantIds = [];
  const tenantUserIds = [];

  for (const td of tenantData) {
    const uid = genId();
    const tid = genId();
    tenantUserIds.push(uid);
    tenantIds.push(tid);

    getCollection('User').docs.set(uid, {
      _id: uid, name: td.name, email: td.email, phone: td.phone,
      passwordHash: bcrypt.hashSync('password123', 12), role: 'tenant',
      ntfyTopic: crypto.randomUUID(), isActive: true, tenantId: tid,
      createdAt: now, updatedAt: now, __v: 0,
    });

    const room = rooms[td.roomIdx];
    const bed = room.beds[td.bedIdx];
    bed.isOccupied = true;
    bed.tenantId = uid;
    room.occupancyCount++;

    getCollection('Tenant').docs.set(tid, {
      _id: tid, userId: uid, roomId: room._id, bedId: bed.bedId,
      moveInDate: new Date('2025-06-01'), monthlyRent: room.monthlyRent, depositPaid: 5000,
      isActive: true,
      emergencyContact: { name: `${td.name}'s Parent`, phone: '+919876543300', relation: 'parent' },
      createdAt: now, updatedAt: now, __v: 0,
    });
  }

  // ── AppConfig ─────────────────────────────────────────
  getCollection('AppConfig').docs.set(genId(), {
    _id: genId(), pgName: 'Tenet PG', tagline: 'Your home, your space.',
    address: { line1: '42 MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
    phone: '+919876543210', email: 'hello@tenetpg.com', upiId: 'pgowner@okhdfcbank',
    upiPayeeName: 'Tenet PG', roomPricing: { sharing2: 8000, sharing3: 6500, sharing4: 5000 },
    amenities: ['High-Speed WiFi', 'Washing Machine', 'Fridge', 'RO Water', 'Housekeeping'],
    features: { attendanceEnabled: false, laundryEnabled: true, messFeedbackEnabled: true, visitorManagementEnabled: true, guardianPortalEnabled: true, noticeBoardEnabled: true, emergencyAlertsEnabled: true },
    createdAt: now, updatedAt: now,
  });

  // ── Invoices & Payments ──────────────────────────────
  const month = '2026-06';
  for (let i = 0; i < tenantIds.length; i++) {
    const invId = genId();
    getCollection('Invoice').docs.set(invId, {
      _id: invId, invoiceNumber: `INV-202606-${String(i + 1).padStart(3, '0')}`,
      tenantId: tenantIds[i], month, lineItems: [{ description: 'Room Rent', amount: 6500 }],
      rentAmount: 6500, electricityAmount: 0, otherCharges: 0, totalAmount: 6500,
      status: 'sent', dueDate: new Date('2026-06-05'), createdAt: now, updatedAt: now, __v: 0,
    });
    if (i < 3) {
      getCollection('Payment').docs.set(genId(), {
        _id: genId(), tenantId: tenantIds[i], invoiceId: invId, amount: 6500, type: 'rent',
        method: 'upi', status: i === 0 ? 'paid' : 'pending', month,
        dueDate: new Date('2026-06-05'), paidAt: i === 0 ? new Date() : null,
        utrNumber: i === 0 ? 'UTR123456789' : undefined, createdAt: now, updatedAt: now, __v: 0,
      });
    }
  }

  // ── Complaints ───────────────────────────────────────
  const complaints = [
    { t: 0, r: 0, cat: 'wifi', title: 'WiFi keeps disconnecting', desc: 'The WiFi drops every 10 minutes.', pri: 'high', st: 'open' },
    { t: 1, r: 1, cat: 'water', title: 'No hot water in bathroom', desc: 'Hot water not available since morning.', pri: 'medium', st: 'in_progress', notes: 'Plumber called' },
    { t: 2, r: 3, cat: 'cleaning_room', title: 'Room not cleaned this week', desc: 'Housekeeping missed my room twice.', pri: 'low', st: 'resolved', resolved: new Date() },
  ];
  for (const c of complaints) {
    const doc = {
      _id: genId(), tenantId: tenantIds[c.t], roomId: rooms[c.r]._id,
      category: c.cat, title: c.title, description: c.desc, priority: c.pri, status: c.st,
      adminNotes: (c.notes || ''), resolvedAt: c.resolved || null,
      createdAt: now, updatedAt: now, __v: 0,
    };
    getCollection('Complaint').docs.set(doc._id, doc);
  }

  // ── Enquiries ────────────────────────────────────────
  for (const name of ['Rohit Verma', 'Ananya Singh', 'Karan Joshi']) {
    getCollection('Enquiry').docs.set(genId(), {
      _id: genId(), name, phone: '+919876543200',
      email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
      sharingPreference: '2', message: 'Looking for a PG room near MG Road.',
      status: 'new', source: 'landing_page', createdAt: now, updatedAt: now, __v: 0,
    });
  }

  // ── Meal Feedback ────────────────────────────────────
  const today = now.toISOString().slice(0, 10);
  const meals = [
    { t: 0, mt: 'lunch', r: 4, cats: ['taste'] },
    { t: 1, mt: 'lunch', r: 5, cats: ['variety', 'taste'] },
    { t: 2, mt: 'dinner', r: 3, cats: ['quantity'] },
  ];
  for (const m of meals) {
    getCollection('MealFeedback').docs.set(genId(), {
      _id: genId(), tenantId: tenantIds[m.t], date: today, mealType: m.mt,
      rating: m.r, categories: m.cats, createdAt: now, updatedAt: now, __v: 0,
    });
  }

  // ── Notices ─────────────────────────────────────────
  getCollection('NoticePost').docs.set(genId(), {
    _id: genId(), title: 'Welcome to Tenet PG!',
    content: 'We are thrilled to have you here. Please read the PG rules posted on the notice board.',
    pinned: true, authorId: adminId, targetType: 'all', createdAt: now, updatedAt: now, __v: 0,
  });

  // ── Assets ───────────────────────────────────────────
  getCollection('Asset').docs.set(genId(), {
    _id: genId(), name: 'Single Bed with Mattress', category: 'furniture',
    location: 'All Rooms', quantity: 12, status: 'in_use', createdAt: now, updatedAt: now,
  });
  getCollection('Asset').docs.set(genId(), {
    _id: genId(), name: 'Washing Machine LG 7kg', category: 'appliance',
    location: 'Ground Floor Utility', quantity: 2, status: 'in_use',
    nextServiceDate: new Date('2026-09-01'), createdAt: now, updatedAt: now,
  });

  // ── Daily Menu ──────────────────────────────────────
  getCollection('DailyMenu').docs.set(genId(), {
    _id: genId(), date: today,
    meals: { breakfast: [{ name: 'Idli Sambar' }, { name: 'Tea/Coffee' }], lunch: [{ name: 'Dal Makhani' }, { name: 'Jeera Rice' }, { name: 'Roti' }], dinner: [{ name: 'Paneer Butter Masala' }, { name: 'Naan' }, { name: 'Gulab Jamun' }] },
    createdAt: now, updatedAt: now, __v: 0,
  });

  console.log(`Mock database seeded: ${getCollection('User').docs.size} users, ${rooms.length} rooms, ${floors.length} floors, ${tenantIds.length} tenants`);
  console.log('Demo login: admin@pgmanagement.local / Admin@123456');
  console.log('Tenant login (any): rahul@example.com / password123');
}
