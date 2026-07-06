/**
 * In-memory Mongoose mock — replaces `mongoose` imports at the Bun resolver level.
 * Supports all query patterns used across ~20 models + ~24 routes + seed script.
 */
import crypto from 'node:crypto';

// ─── ID Generation ──────────────────────────────────────
const hex = (n = 24) => crypto.randomBytes(12).toString('hex').slice(0, n);
const objectIds = new Set<string>();
export function generateObjectId(): string {
  let id: string;
  do { id = hex(); } while (objectIds.has(id));
  objectIds.add(id);
  return id;
}

// ─── Central data store ─────────────────────────────────
interface CollectionEntry {
  modelName: string;
  docs: Map<string, Record<string, unknown>>;
  preSaveHooks: Array<(doc: Record<string, unknown>) => void | Promise<void>>;
  postSaveHooks: Array<(doc: Record<string, unknown>) => void | Promise<void>>;
  toJSONTransform?: (doc: Record<string, unknown>, ret: Record<string, unknown>) => Record<string, unknown>;
  toObjectTransform?: (doc: Record<string, unknown>, ret: Record<string, unknown>) => Record<string, unknown>;
  virtuals: Array<{ name: string; options: Record<string, unknown> }>;
  statics: Record<string, unknown>;
  methods: Record<string, unknown>;
}

export const collections = new Map<string, CollectionEntry>();

export function getCollection(modelName: string): CollectionEntry {
  let col = collections.get(modelName);
  if (!col) {
    col = { modelName, docs: new Map(), preSaveHooks: [], postSaveHooks: [], virtuals: [], statics: {}, methods: {} };
    collections.set(modelName, col);
  }
  return col;
}

// ─── ObjectId ───────────────────────────────────────────
class ObjectId {
  _str: string;
  constructor(id?: string) {
    this._str = id || generateObjectId();
  }
  toString() { return this._str; }
  toHexString() { return this._str; }
  equals(other: ObjectId | string) {
    const s = typeof other === 'string' ? other : other._str;
    return this._str === s;
  }
}

// ─── Mongoose Error Types ────────────────────────────────
class MongooseError extends Error {
  constructor(msg: string) { super(msg); this.name = 'MongooseError'; }
}

class ValidationError extends MongooseError {
  errors: Record<string, { message: string }>;
  constructor(errors: Record<string, string> = {}) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = {};
    for (const [k, v] of Object.entries(errors)) {
      this.errors[k] = { message: v };
    }
  }
}

class CastError extends MongooseError {
  value: string;
  constructor(type: string, value: string) {
    super(`Cast to ${type} failed for value "${value}"`);
    this.name = 'CastError';
    this.value = value;
  }
}

// ─── Schema ──────────────────────────────────────────────
class Schema {
  _schema: Record<string, unknown>;
  _options: Record<string, unknown>;
  _hooks: { pre: Record<string, Array<(...args: unknown[]) => void>>; post: Record<string, Array<(...args: unknown[]) => void>> };
  _statics: Record<string, unknown> = {};
  _methods: Record<string, unknown> = {};
  _virtuals: Array<{ name: string; options: Record<string, unknown> }> = [];
  _indexes: Array<Record<string, unknown>> = [];
  _toJSON: { transform?: (doc: Record<string, unknown>, ret: Record<string, unknown>) => Record<string, unknown> } = {};
  _toObject: { transform?: (doc: Record<string, unknown>, ret: Record<string, unknown>) => Record<string, unknown> } = {};

  constructor(schemaDef: Record<string, unknown>, options: Record<string, unknown> = {}) {
    this._schema = schemaDef;
    this._options = options;
    this._hooks = { pre: {}, post: {} };
    if (options.toJSON) this._toJSON = options.toJSON as typeof this._toJSON;
    if (options.toObject) this._toObject = options.toObject as typeof this._toObject;
  }

  pre(event: string, fn: (...args: unknown[]) => void) {
    if (!this._hooks.pre[event]) this._hooks.pre[event] = [];
    this._hooks.pre[event].push(fn);
  }

  post(event: string, fn: (...args: unknown[]) => void) {
    if (!this._hooks.post[event]) this._hooks.post[event] = [];
    this._hooks.post[event].push(fn);
  }

  index(indexDef: Record<string, unknown>) {
    this._indexes.push(indexDef);
  }

  virtual(name: string, options: Record<string, unknown>) {
    this._virtuals.push({ name, options });
  }

  get statics() { return this._statics; }
  set statics(v) { this._statics = v; }

  get methods() { return this._methods; }
  set methods(v) { this._methods = v; }
}

// ─── Document instance (non-lean) ────────────────────────
class Document {
  _doc: Record<string, unknown>;
  _modelName: string;
  _modified: Set<string>;
  _collection: CollectionEntry;

  constructor(modelName: string, data: Record<string, unknown>, collection: CollectionEntry) {
    this._modelName = modelName;
    this._doc = { ...data };
    this._modified = new Set();
    this._collection = collection;
  }

  get id() { return String(this._doc._id ?? ''); }
  set id(v: string) { this._doc._id = v; }

  get _id() { return this._doc._id; }
  set _id(v: unknown) { this._doc._id = v; }

  isModified(field?: string): boolean {
    if (field) return this._modified.has(field);
    return this._modified.size > 0;
  }

  async save(): Promise<this> {
    for (const hook of this._collection.preSaveHooks) {
      await hook(this._doc);
    }
    const id = String(this._doc._id ?? '');
    const now = new Date();
    if (!this._doc.createdAt) this._doc.createdAt = now;
    this._doc.updatedAt = now;
    if (id) {
      this._collection.docs.set(id, this._doc);
    }
    for (const hook of this._collection.postSaveHooks) {
      await hook(this._doc);
    }
    this._modified.clear();
    return this;
  }

  toJSON(): Record<string, unknown> {
    const ret = { ...this._doc };
    ret.id = String(ret._id ?? '');
    delete ret.__v;
    if (this._collection.toJSONTransform) {
      return this._collection.toJSONTransform(this._doc, ret);
    }
    return ret;
  }

  toObject(): Record<string, unknown> {
    const ret = { ...this._doc };
    ret.id = String(ret._id ?? '');
    delete ret.__v;
    if (this._collection.toObjectTransform) {
      return this._collection.toObjectTransform(this._doc, ret);
    }
    return ret;
  }
}

// ─── Populate Helper ─────────────────────────────────────
function populateRef(
  modelName: string,
  doc: Record<string, unknown>,
  path: string,
  isLean: boolean,
  nested?: Record<string, unknown>,
): Record<string, unknown> {
  const refVal = doc[path];
  if (!refVal) return doc;

  let targetModel: string;
  if (path === 'tenantId' || path === 'tenant') targetModel = 'Tenant';
  else if (path === 'userId') targetModel = 'User';
  else if (path === 'roomId' || path === 'room') targetModel = 'Room';
  else if (path === 'floor' || path === 'floorId') targetModel = 'Floor';
  else if (path === 'invoiceId') targetModel = 'Invoice';
  else targetModel = path.charAt(0).toUpperCase() + path.slice(1).replace(/Id$/, '');

  const targetCol = collections.get(targetModel);
  if (!targetCol) return doc;

  const refStr = typeof refVal === 'object' && refVal !== null && '_id' in refVal
    ? String((refVal as Record<string, unknown>)._id)
    : String(refVal);
  const targetDoc = targetCol.docs.get(refStr);
  if (!targetDoc) return doc;

  let populated = { ...targetDoc };
  populated.id = String(populated._id ?? '');
  delete populated.__v;

  if (nested) {
    const nestedPath = nested.path as string;
    populated = populateRef(targetModel, populated, nestedPath, true) as Record<string, unknown>;
    const selectFields = nested.select as string | undefined;
    if (selectFields) {
      const fields = selectFields.split(/\s+/);
      const filtered: Record<string, unknown> = {};
      for (const f of fields) {
        filtered[f] = populated[f];
      }
      populated = filtered;
    }
  }

  const result = { ...doc, [path]: populated };
  return result;
}

// ─── Query Chain ─────────────────────────────────────────
class QueryChain {
  _modelName: string;
  _filter: Record<string, unknown>;
  _sortFields: Record<string, 1 | -1>;
  _skipCount: number;
  _limitCount: number;
  _populatePaths: Array<string | Record<string, unknown>>;
  _selectFields: string | Record<string, number> | null;
  _leanResult: boolean;
  _collection: CollectionEntry;

  constructor(modelName: string) {
    this._modelName = modelName;
    this._filter = {};
    this._sortFields = {};
    this._skipCount = 0;
    this._limitCount = 0;
    this._populatePaths = [];
    this._selectFields = null;
    this._leanResult = false;
    this._collection = getCollection(modelName);
  }

  // ── Condition helpers ─────────────────────────────────
  _matchValue(field: string, value: unknown, doc: Record<string, unknown>): boolean {
    const parts = field.split('.');
    let obj: unknown = doc;
    for (const p of parts) {
      if (obj == null || typeof obj !== 'object') return false;
      obj = (obj as Record<string, unknown>)[p];
    }
    const docVal = obj;

    if (value === null || value === undefined) {
      return docVal == null;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const ops = value as Record<string, unknown>;
      if (ops.$in !== undefined) {
        const arr = ops.$in as unknown[];
        const docStr = String(docVal ?? '');
        return arr.some((v) => String(v ?? '') === docStr);
      }
      if (ops.$nin !== undefined) {
        const arr = ops.$nin as unknown[];
        const docStr = String(docVal ?? '');
        return !arr.some((v) => String(v ?? '') === docStr);
      }
      if (ops.$ne !== undefined) {
        return String(docVal ?? '') !== String(ops.$ne ?? '');
      }
      if (ops.$gte !== undefined || ops.$lte !== undefined) {
        const dv = typeof docVal === 'number' ? docVal : (docVal instanceof Date ? docVal.getTime() : NaN);
        if (ops.$gte !== undefined && dv < Number(ops.$gte)) return false;
        if (ops.$lte !== undefined && dv > Number(ops.$lte)) return false;
        return true;
      }
      if (ops.$gt !== undefined || ops.$lt !== undefined) {
        const dv = typeof docVal === 'number' ? docVal : (docVal instanceof Date ? docVal.getTime() : NaN);
        if (ops.$gt !== undefined && dv <= Number(ops.$gt)) return false;
        if (ops.$lt !== undefined && dv >= Number(ops.$lt)) return false;
        return true;
      }
      if (ops.$regex !== undefined) {
        const flags = ops.$options && typeof ops.$options === 'string' ? ops.$options : '';
        const re = new RegExp(ops.$regex as string, flags);
        return re.test(String(docVal ?? ''));
      }
      if (ops.$exists !== undefined) {
        return ops.$exists ? docVal !== undefined : docVal === undefined;
      }
      return false;
    }

    return String(docVal ?? '') === String(value);
  }

  _matchDoc(doc: Record<string, unknown>): boolean {
    if (this._filter.$or !== undefined) {
      const clauses = this._filter.$or as Record<string, unknown>[];
      const orMatch = clauses.some((clause) => {
        return Object.entries(clause).every(([k, v]) => this._matchValue(k, v, doc));
      });
      if (!orMatch) return false;
    }
    const mainFilter: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this._filter)) {
      if (k === '$or' || k === '$and') continue;
      mainFilter[k] = v;
    }
    if (this._filter.$and !== undefined) {
      const clauses = this._filter.$and as Record<string, unknown>[];
      for (const clause of clauses) {
        for (const [k, v] of Object.entries(clause)) {
          if (!this._matchValue(k, v, doc)) return false;
        }
      }
    }
    for (const [field, value] of Object.entries(mainFilter)) {
      if (!this._matchValue(field, value, doc)) return false;
    }
    return true;
  }

  // ── Query modifiers ───────────────────────────────────
  find(filter: Record<string, unknown>): this {
    this._filter = { ...filter };
    return this;
  }

  findOne(filter: Record<string, unknown>): this {
    this._filter = { ...filter };
    this._limitCount = 1;
    return this;
  }

  findById(id: string): this {
    return this.findOne({ _id: id } as Record<string, unknown>);
  }

  sort(sortObj: Record<string, 1 | -1>): this {
    this._sortFields = { ...sortObj };
    return this;
  }

  skip(n: number): this {
    this._skipCount = n;
    return this;
  }

  limit(n: number): this {
    this._limitCount = n;
    return this;
  }

  populate(path: string | Record<string, unknown>): this {
    this._populatePaths.push(path);
    return this;
  }

  select(fields: string | Record<string, number>): this {
    this._selectFields = fields;
    return this;
  }

  lean(): this {
    this._leanResult = true;
    return this;
  }

  session(sid: string | Record<string, unknown>): this {
    if (typeof sid === 'string') this._sessionId = sid;
    return this;
  }

  // ── Execution ─────────────────────────────────────────
  async exec<T = unknown>(): Promise<T> {
    return this._exec() as Promise<T>;
  }

  async _exec(): Promise<unknown> {
    const allDocs = [...this._collection.docs.values()].filter((d) => this._matchDoc(d));

    // Sort
    if (Object.keys(this._sortFields).length > 0) {
      allDocs.sort((a, b) => {
        for (const [field, order] of Object.entries(this._sortFields)) {
          const av = a[field];
          const bv = b[field];
          let cmp = 0;
          if (av == null && bv == null) cmp = 0;
          else if (av == null) cmp = -1;
          else if (bv == null) cmp = 1;
          else if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv);
          else if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
          else cmp = Number(av) - Number(bv);
          if (cmp !== 0) return cmp * order;
        }
        return 0;
      });
    }

    let results: unknown[] = allDocs;

    if (this._skipCount > 0) results = results.slice(this._skipCount);
    if (this._limitCount > 0) results = results.slice(0, this._limitCount);

    // Populate
    if (this._populatePaths.length > 0) {
      results = results.map((doc) => {
        let d = doc as Record<string, unknown>;
        for (const pop of this._populatePaths) {
          if (typeof pop === 'string') {
            d = populateRef(this._modelName, d, pop, this._leanResult);
          } else {
            const path = pop.path as string;
            const nested = pop.populate as Record<string, unknown> | undefined;
            d = populateRef(this._modelName, d, path, this._leanResult, nested);
          }
        }
        return d;
      });
    }

    // Apply select
    if (this._selectFields) {
      results = results.map((doc) => {
        const d = { ...(doc as Record<string, unknown>) };
        if (typeof this._selectFields === 'string') {
          const fields = (this._selectFields as string).split(/\s+/);
          for (const f of fields) {
            if (f.startsWith('-')) delete d[f.slice(1)];
          }
        }
        return d;
      });
    }

    if (!this._leanResult) {
      results = results.map((d) => new Document(this._modelName, d as Record<string, unknown>, this._collection));
    } else {
      results = results.map((d) => {
        const plain = { ...(d as Record<string, unknown>) };
        plain.id = String(plain._id ?? '');
        delete plain.__v;
        return plain;
      });
    }

    if (this._limitCount === 1) return results[0] ?? null;
    return results;
  }

  then<T1 = unknown, T2 = never>(resolve?: ((v: unknown) => T1) | null, reject?: ((v: unknown) => T2) | null): Promise<T1 | T2> {
    return this._exec().then(resolve ?? ((v) => v as T1), reject ?? ((v) => { throw v; }));
  }

  catch<T = never>(reject?: ((v: unknown) => T) | null): Promise<unknown> {
    return this._exec().catch(reject ?? ((v) => { throw v; }));
  }

  finally(fn?: (() => void) | null): Promise<unknown> {
    return this._exec().finally(fn ?? (() => {}));
  }
}

// ─── Aggregate Pipeline (basic) ─────────────────────────
class AggregateChain {
  _modelName: string;
  _stages: Record<string, unknown>[];

  constructor(modelName: string, stages: Record<string, unknown>[]) {
    this._modelName = modelName;
    this._stages = stages;
  }

  then<T1 = unknown, T2 = never>(resolve?: ((v: unknown) => T1) | null, reject?: ((v: unknown) => T2) | null): Promise<T1 | T2> {
    return this._exec().then(resolve ?? ((v) => v as T1), reject ?? ((v) => { throw v; }));
  }

  catch<T = never>(reject?: ((v: unknown) => T) | null): Promise<unknown> {
    return this._exec().catch(reject ?? ((v) => { throw v; }));
  }

  finally(fn?: (() => void) | null): Promise<unknown> {
    return this._exec().finally(fn ?? (() => {}));
  }

  async _exec(): Promise<unknown[]> {
    const col = getCollection(this._modelName);
    let docs = [...col.docs.values()].map((d) => ({ ...d }));

    for (const stage of this._stages) {
      if (stage.$match) {
        const q = new QueryChain(this._modelName);
        q._filter = stage.$match as Record<string, unknown>;
        docs = docs.filter((d) => q._matchDoc(d));
      } else if (stage.$group) {
        docs = this._group(docs, stage.$group as Record<string, unknown>);
      } else if (stage.$sort) {
        const sortObj = stage.$sort as Record<string, 1 | -1>;
        docs.sort((a, b) => {
          for (const [field, order] of Object.entries(sortObj)) {
            const av = a[field];
            const bv = b[field];
            let cmp = 0;
            if (av == null && bv == null) cmp = 0;
            else if (av == null) cmp = -1;
            else if (bv == null) cmp = 1;
            else if (typeof av === 'string') cmp = av.localeCompare(bv as string);
            else cmp = Number(av) - Number(bv);
            if (cmp !== 0) return cmp * order;
          }
          return 0;
        });
      }
    }

    return docs.map((d) => {
      d.id = String(d._id ?? '');
      return d;
    });
  }

  _group(docs: Record<string, unknown>[], group: Record<string, unknown>): Record<string, unknown>[] {
    const idExpr = group._id as Record<string, string> | string;
    const groups = new Map<string, Record<string, unknown>[]>();

    for (const doc of docs) {
      let key: string;
      if (typeof idExpr === 'string') {
        key = String(doc[idExpr] ?? 'null');
      } else {
        key = Object.entries(idExpr).map(([k, v]) => `${k}=${doc[v] ?? 'null'}`).join('|');
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }

    const results: Record<string, unknown>[] = [];
    for (const [key, grpDocs] of groups) {
      const result: Record<string, unknown> = { _id: key };
      for (const [field, expr] of Object.entries(group)) {
        if (field === '_id') continue;
        if (typeof expr === 'object' && expr !== null) {
          const acc = expr as Record<string, unknown>;
          if (acc.$sum !== undefined) {
            result[field] = grpDocs.reduce((sum, d) => sum + (Number(d[acc.$sum as string]) || 0), 0);
          } else if (acc.$avg !== undefined) {
            const vals = grpDocs.map((d) => Number(d[acc.$avg as string]) || 0);
            result[field] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          }
        }
      }
      results.push(result);
    }
    return results;
  }
}

// ─── Model Builder ───────────────────────────────────────
function createModel(modelName: string, schema: Schema): Record<string, unknown> {
  const col = getCollection(modelName);
  col.preSaveHooks = (schema._hooks.pre.save || []).map((fn) => {
    return (doc: Record<string, unknown>) => {
      const ctx = { _doc: doc, isModified: () => true, ...doc };
      return fn.call(ctx, function() {} as unknown as unknown);
    };
  });
  if (schema._toJSON?.transform) col.toJSONTransform = schema._toJSON.transform;
  if (schema._toObject?.transform) col.toObjectTransform = schema._toObject.transform;
  if (schema._virtuals) col.virtuals = schema._virtuals;
  if (schema._statics) col.statics = schema._statics;
  if (schema._methods) col.methods = schema._methods;

  const model = {
    find(filter: Record<string, unknown>) { return new QueryChain(modelName).find(filter); },
    findById(id: string) { return new QueryChain(modelName).findById(id); },
    findOne(filter: Record<string, unknown>) { return new QueryChain(modelName).findOne(filter); },
    countDocuments(filter: Record<string, unknown> = {}) {
      const q = new QueryChain(modelName);
      q._filter = filter;
      return q._exec().then((r) => (r as unknown[]).length);
    },
    async create(data: unknown) {
      const docData = Array.isArray(data) ? data[0] : data;
      const _id = docData._id || generateObjectId();
      const now = new Date();
      const doc: Record<string, unknown> = { ...(docData as Record<string, unknown>), _id, __v: 0, createdAt: now, updatedAt: now };
      for (const hook of col.preSaveHooks) {
        await hook(doc);
      }
      col.docs.set(_id, doc);
      for (const hook of col.postSaveHooks) {
        await hook(doc);
      }
      if (Array.isArray(data)) return [doc];
      return doc;
    },
    async insertMany(data: Record<string, unknown>[]) {
      const results: Record<string, unknown>[] = [];
      for (const item of data) {
        const _id = item._id || generateObjectId();
        const now = new Date();
        const doc: Record<string, unknown> = { ...item, _id, __v: 0, createdAt: now, updatedAt: now };
        for (const hook of col.preSaveHooks) {
          await hook(doc);
        }
        col.docs.set(_id, doc);
        for (const hook of col.postSaveHooks) {
          await hook(doc);
        }
        results.push(doc);
      }
      return results;
    },
    async findByIdAndUpdate(id: string, update: Record<string, unknown>, options: Record<string, unknown> = {}) {
      const doc = col.docs.get(id);
      if (!doc) return null;
      for (const [k, v] of Object.entries(update)) {
        doc[k] = v;
      }
      doc.updatedAt = new Date();
      if (options.new) return { ...doc, id: doc._id };
      return doc;
    },
    async findByIdAndDelete(id: string) {
      const doc = col.docs.get(id);
      if (!doc) return null;
      col.docs.delete(id);
      return doc;
    },
    async findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown> = {}) {
      const q = new QueryChain(modelName);
      q._filter = filter;
      const docs = await q._exec() as Record<string, unknown>[];
      const target = docs[0];
      if (!target) return null;
      const targetId = String(target._id ?? '');
      const stored = col.docs.get(targetId);
      if (!stored) return null;
      for (const [k, v] of Object.entries(update)) {
        stored[k] = v;
      }
      stored.updatedAt = new Date();
      if (options.new) return { ...stored, id: stored._id };
      return stored;
    },
    async updateMany(filter: Record<string, unknown>, update: Record<string, unknown>) {
      const q = new QueryChain(modelName);
      q._filter = filter;
      const docs = await q._exec() as Record<string, unknown>[];
      let count = 0;
      for (const d of docs) {
        const id = String(d._id ?? '');
        const stored = col.docs.get(id);
        if (stored) {
          const setOp = update.$set as Record<string, unknown> | undefined;
          Object.assign(stored, setOp || update);
          stored.updatedAt = new Date();
          count++;
        }
      }
      return { modifiedCount: count };
    },
    aggregate(pipeline: Record<string, unknown>[]) {
      return new AggregateChain(modelName, pipeline);
    },
  };

  // Attach statics
  if (schema._statics) {
    for (const [key, val] of Object.entries(schema._statics)) {
      if (typeof val === 'function') {
        (model as Record<string, unknown>)[key] = (val as (...args: unknown[]) => unknown).bind(model);
      } else {
        (model as Record<string, unknown>)[key] = val;
      }
    }
  }

  return model;
}

// ─── Standalone `model` function (matches `import { model } from 'mongoose'`) ──
function model(name: string, schema?: Schema): Record<string, unknown> {
  if (!schema) {
    // retrieval mode: model('User') — return existing
    const col = collections.get(name);
    if (!col) throw new Error(`Mock model '${name}' has not been registered yet`);
    // Return a thin proxy over the collection
    const m = createModel(name, new Schema({}));
    return m;
  }
  return createModel(name, schema);
}

// Re-export the Schema class for `import { Schema } from 'mongoose'`
export { Schema };

// ─── Mongoose Module Export ──────────────────────────────
const MockMongoose = {
  Schema,
  model,
  Error: { ValidationError, CastError } as unknown as Record<string, unknown>,
  Types: {
    ObjectId,
  },
  connection: {
    readyState: 1,
    on: () => {},
  },
  startSession: async () => {
    const session = {
      id: generateObjectId(),
      _inTransaction: false,
      async withTransaction(fn: () => Promise<void>) {
        this._inTransaction = true;
        try { await fn(); } finally { this._inTransaction = false; }
      },
      endSession() {},
    };
    return session;
  },
};

export default MockMongoose;
