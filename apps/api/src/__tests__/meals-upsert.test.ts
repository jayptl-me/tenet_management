/**
 * MealFeedback unique-index tests -- validates the compound unique index
 * on { tenantId, date, mealType }. Tests duplicate key errors (E11000)
 * on create and update operations.
 * Mongoose 9 compatibility: cast helpers for loose-typed create calls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MealFeedback } from '../models/mealFeedback.js';

type AnyDoc = Record<string, unknown>;
const feedbackCreate = MealFeedback.create.bind(MealFeedback) as unknown as (doc: AnyDoc) => Promise<AnyDoc>;

describe('MealFeedback Unique Index', () => {
  const baseFeedback: AnyDoc = {
    tenantId: '000000000000000000000001',
    date: '2026-07-15',
    mealType: 'breakfast',
    rating: 5,
  };

  // Ensure the unique index is built before each test
  beforeEach(async () => {
    await MealFeedback.init();
  });

  it('should create a meal feedback with a valid unique combination', async () => {
    const raw = await feedbackCreate({ ...baseFeedback });
    expect(raw._id).toBeDefined();
  });

  it('should reject duplicate tenant+date+mealType on create (E11000)', async () => {
    await feedbackCreate({ ...baseFeedback });
    await expect(feedbackCreate({ ...baseFeedback })).rejects.toMatchObject({ code: 11000 });
  });

  it('should allow different mealType for same tenant+date', async () => {
    await feedbackCreate({ ...baseFeedback });
    const lunch = await feedbackCreate({ ...baseFeedback, mealType: 'lunch' });
    expect(lunch._id).toBeDefined();
  });

  it('should allow different date for same tenant+mealType', async () => {
    await feedbackCreate({ ...baseFeedback });
    const nextDay = await feedbackCreate({ ...baseFeedback, date: '2026-07-16' });
    expect(nextDay._id).toBeDefined();
  });

  it('should allow different tenant for same date+mealType', async () => {
    await feedbackCreate({ ...baseFeedback });
    const otherTenant = await feedbackCreate({
      ...baseFeedback,
      tenantId: '000000000000000000000002',
    });
    expect(otherTenant._id).toBeDefined();
  });

  it('should reject update to mealType that conflicts with existing (E11000)', async () => {
    const tenantId = '000000000000000000000003';
    // Create breakfast and lunch for same tenant+date
    const breakfast = await feedbackCreate({
      tenantId,
      date: '2026-07-15',
      mealType: 'breakfast',
      rating: 4,
    });
    await feedbackCreate({
      tenantId,
      date: '2026-07-15',
      mealType: 'lunch',
      rating: 5,
    });

    // Try to update breakfast's mealType to 'lunch' -> should conflict
    await expect(
      MealFeedback.findByIdAndUpdate(breakfast._id as string, { mealType: 'lunch' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});