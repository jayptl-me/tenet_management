/**
 * Room model tests — validates bed generation, sharing type, and occupancy.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Room } from '../models/room.js';
import type { IBedSubdoc } from '../models/room.js';

describe('Room Model', () => {
  const validRoomData = {
    roomNumber: 'TEST-101',
    floorId: new mongoose.Types.ObjectId(),
    sharingType: 2,
    monthlyRent: 8000,
  };

  it('should create a room with 2-sharing type', async () => {
    const room = await Room.create(validRoomData);
    expect(room.beds).toHaveLength(2);
    const beds = room.beds! as IBedSubdoc[];
    expect(beds[0]?.bedId).toBe('A');
    expect(beds[1]?.bedId).toBe('B');
    expect(beds[0]?.isOccupied).toBe(false);
  });

  it('should create a room with 4-sharing type', async () => {
    const room = await Room.create({ ...validRoomData, roomNumber: 'TEST-102', sharingType: 4 });
    expect(room.beds).toHaveLength(4);
    const beds = room.beds! as IBedSubdoc[];
    expect(beds[3]?.bedId).toBe('D');
  });

  it('should reject room number duplicates', async () => {
    await Room.create(validRoomData);
    await expect(Room.create(validRoomData)).rejects.toThrow();
  });

  it('should reject invalid sharing type', async () => {
    const data = { ...validRoomData, roomNumber: 'TEST-103', sharingType: 5 };
    await expect(Room.create(data)).rejects.toThrow();
  });

  it('should derive occupancyCount on save', async () => {
    const room = await Room.create(validRoomData);
    expect(room.occupancyCount).toBe(0);
  });

  it('should generate correct beds via static method', () => {
    const beds = Room.generateBeds(3);
    expect(beds).toHaveLength(3);
    expect(beds.map((b) => b.bedId)).toEqual(['A', 'B', 'C']);
  });
});
