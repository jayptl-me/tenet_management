/**
 * Room model tests — validates bed generation, sharing type, and occupancy.
 * Mongoose 9 compatibility: after create(), re-fetch via findById() for typed access.
 */
import { describe, it, expect } from 'vitest';
import { Room } from '../models/room.js';
import type { IBedSubdoc } from '../models/room.js';

type AnyDoc = Record<string, unknown>;
const roomCreate = Room.create.bind(Room) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

describe('Room Model', () => {
  const validRoomData: AnyDoc = {
    roomNumber: 'TEST-101',
    floorId: '000000000000000000000001',
    sharingType: 2,
    monthlyRent: 8000,
    beds: Room.generateBeds(2),
  };

  it('should create a room with 2-sharing type', async () => {
    const raw = await roomCreate({ ...validRoomData, roomNumber: `T101-${Date.now()}` });
    const room = await Room.findById(raw._id as string);
    expect(room).not.toBeNull();
    expect(room?.beds).toHaveLength(2);
    const beds = room!.beds as IBedSubdoc[];
    expect(beds[0]?.bedId).toBe('A');
    expect(beds[1]?.bedId).toBe('B');
    expect(beds[0]?.isOccupied).toBe(false);
  });

  it('should create a room with 4-sharing type', async () => {
    const raw = await roomCreate({ ...validRoomData, roomNumber: `T102-${Date.now()}`, sharingType: 4, beds: Room.generateBeds(4) });
    const room = await Room.findById(raw._id as string);
    expect(room).not.toBeNull();
    expect(room?.beds).toHaveLength(4);
    const beds = room!.beds as IBedSubdoc[];
    expect(beds[3]?.bedId).toBe('D');
  });

  it('should reject room number duplicates', async () => {
    const rn = `DUP-${Date.now()}`;
    await roomCreate({ ...validRoomData, roomNumber: rn });
    await expect(roomCreate({ ...validRoomData, roomNumber: rn })).rejects.toThrow();
  });

  it('should reject invalid sharing type', async () => {
    await expect(roomCreate({ ...validRoomData, roomNumber: `T103-${Date.now()}`, sharingType: 5 })).rejects.toThrow();
  });

  it('should derive occupancyCount on save', async () => {
    const raw = await roomCreate({ ...validRoomData, roomNumber: `T104-${Date.now()}` });
    const room = await Room.findById(raw._id as string);
    expect(room?.occupancyCount).toBe(0);
  });

  it('should generate correct beds via static method', () => {
    const beds = Room.generateBeds(3);
    expect(beds).toHaveLength(3);
    expect(beds.map((b) => b.bedId)).toEqual(['A', 'B', 'C']);
  });
});
