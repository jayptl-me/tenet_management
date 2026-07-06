/**
 * In-memory Mongoose mock — replaces the real mongoose package.
 * CommonJS module with named exports via module.exports.
 * Real mongoose is CJS ("type": "commonjs") so Bun handles this correctly.
 */
'use strict';

const crypto = require('crypto');

const hex = (n = 24) => crypto.randomBytes(12).toString('hex').slice(0, n);
const objectIds = new Set();

function generateObjectId() {
  let id;
  do { id = hex(); } while (objectIds.has(id));
  objectIds.add(id);
  return id;
}

const collections = new Map();

class CollectionEntry {
  constructor(name) {
    this.modelName = name;
    this.docs = new Map();
    this.preSaveHooks = [];
    this.postSaveHooks = [];
    this.toJSONTransform = null;
    this.toObjectTransform = null;
    this.virtuals = [];
    this.statics = {};
    this.methods = {};
  }
}

function getCollection(name) {
  let col = collections.get(name);
  if (!col) { col = new CollectionEntry(name); collections.set(name, col); }
  return col;
}

class ObjectId {
  constructor(id) { this._str = id || generateObjectId(); }
  toString() { return this._str; }
  toHexString() { return this._str; }
  equals(other) { return this._str === (typeof other === 'string' ? other : other._str); }
}

class Schema {
  constructor(schemaDef, options = {}) {
    this._schema = schemaDef;
    this._options = options;
    this._hooks = { pre: {}, post: {} };
    this._statics = {};
    this._methods = {};
    this._virtuals = [];
    this._indexes = [];
    this._toJSON = {};
    this._toObject = {};
    if (options.toJSON) this._toJSON = options.toJSON;
    if (options.toObject) this._toObject = options.toObject;
  }
  pre(e, fn) { if (!this._hooks.pre[e]) this._hooks.pre[e] = []; this._hooks.pre[e].push(fn); }
  post(e, fn) { if (!this._hooks.post[e]) this._hooks.post[e] = []; this._hooks.post[e].push(fn); }
  index(idx) { this._indexes.push(idx); }
  virtual(name, opts) { this._virtuals.push({ name, options: opts }); }
}
// Schema.Types is a static, not instance property
Schema.Types = { ObjectId };
Object.defineProperty(Schema.prototype, 'statics', {
  get() { return this._statics; },
  set(v) { this._statics = v; },
});
Object.defineProperty(Schema.prototype, 'Types', {
  get() { return { ObjectId }; },
  set(v) {},
  configurable: true,
});
Object.defineProperty(Schema.prototype, 'methods', {
  get() { return this._methods; },
  set(v) { this._methods = v; },
});

class Document {
  constructor(modelName, data, col) {
    this._modelName = modelName; this._modified = new Set(); this._collection = col;
    // Proxy property access to _doc
    const doc = { ...data };
    this._doc = doc;
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'id') return String(doc._id ?? '');
        if (prop in doc) return doc[prop];
        if (col && col.methods && col.methods[prop]) return function(...args) { return col.methods[prop].apply(this, args); };
        const m = target[`_${prop}`];
        if (m !== undefined) return m;
      },
      set(target, prop, value) {
        if (prop in target) { target[prop] = value; return true; }
        doc[prop] = value; target._modified.add(prop); return true;
      },
      has(target, prop) { return prop in target || prop in doc || prop === 'id'; },
    });
  }
  get id() { return String(this._doc._id ?? ''); }
  set id(v) { this._doc._id = v; }
  get _id() { return this._doc._id; }
  set _id(v) { this._doc._id = v; }
  isModified(f) { return f ? this._modified.has(f) : this._modified.size > 0; }
  async save() {
    for (const h of this._collection.preSaveHooks) await h(this._doc);
    const id = String(this._doc._id ?? ''); const now = new Date();
    if (!this._doc.createdAt) this._doc.createdAt = now;
    this._doc.updatedAt = now;
    if (id) this._collection.docs.set(id, this._doc);
    for (const h of this._collection.postSaveHooks) await h(this._doc);
    this._modified.clear(); return this;
  }
  toJSON() {
    const ret = { ...this._doc, id: String(this._doc._id ?? '') }; delete ret.__v;
    return this._collection.toJSONTransform ? this._collection.toJSONTransform(this._doc, ret) : ret;
  }
  toObject() {
    const ret = { ...this._doc, id: String(this._doc._id ?? '') }; delete ret.__v;
    return this._collection.toObjectTransform ? this._collection.toObjectTransform(this._doc, ret) : ret;
  }
}

class QueryChain {
  constructor(modelName) {
    this._modelName = modelName; this._filter = {}; this._sortFields = {};
    this._skipCount = 0; this._limitCount = 0; this._populatePaths = [];
    this._selectFields = null; this._leanResult = false;
    this._collection = getCollection(modelName);
  }
  _matchValue(field, value, doc) {
    const parts = field.split('.'); let obj = doc;
    for (const p of parts) { if (obj == null || typeof obj !== 'object') return false; obj = obj[p]; }
    const docVal = obj;
    if (value === null || value === undefined) return docVal == null;
    if (typeof value === 'object' && !Array.isArray(value)) {
      const ops = value;
      if (ops.$in !== undefined) return ops.$in.some(v => String(v ?? '') === String(docVal ?? ''));
      if (ops.$ne !== undefined) return String(docVal ?? '') !== String(ops.$ne ?? '');
      if (ops.$gte !== undefined || ops.$lte !== undefined) {
        const dv = docVal instanceof Date ? docVal.getTime() : Number(docVal);
        if (ops.$gte !== undefined && dv < Number(ops.$gte)) return false;
        if (ops.$lte !== undefined && dv > Number(ops.$lte)) return false; return true;
      }
      if (ops.$gt !== undefined || ops.$lt !== undefined) {
        const dv = docVal instanceof Date ? docVal.getTime() : Number(docVal);
        if (ops.$gt !== undefined && dv <= Number(ops.$gt)) return false;
        if (ops.$lt !== undefined && dv >= Number(ops.$lt)) return false; return true;
      }
      if (ops.$regex !== undefined) {
        return new RegExp(ops.$regex, typeof ops.$options === 'string' ? ops.$options : '').test(String(docVal ?? ''));
      }
      if (ops.$exists !== undefined) return ops.$exists ? docVal !== undefined : docVal === undefined;
      if (ops.$nin !== undefined) return !ops.$nin.some(v => String(v ?? '') === String(docVal ?? ''));
      return false;
    }
    return String(docVal ?? '') === String(value);
  }
  _matchDoc(doc) {
    if (this._filter.$or && !this._filter.$or.some(cl => Object.entries(cl).every(([k, v]) => this._matchValue(k, v, doc)))) return false;
    if (this._filter.$and && !this._filter.$and.every(cl => Object.entries(cl).every(([k, v]) => this._matchValue(k, v, doc)))) return false;
    for (const [field, value] of Object.entries(this._filter)) {
      if (field === '$or' || field === '$and') continue;
      if (!this._matchValue(field, value, doc)) return false;
    }
    return true;
  }
  find(f) { this._filter = { ...f }; return this; }
  findOne(f) { this._filter = { ...f }; this._limitCount = 1; return this; }
  findById(id) { return this.findOne({ _id: id }); }
  sort(s) { this._sortFields = { ...s }; return this; }
  skip(n) { this._skipCount = n; return this; }
  limit(n) { this._limitCount = n; return this; }
  populate(p) { this._populatePaths.push(p); return this; }
  select(f) { this._selectFields = f; return this; }
  lean() { this._leanResult = true; return this; }
  session() { return this; }
  then(resolve, reject) { return this._exec().then(resolve, reject); }
  catch(reject) { return this._exec().catch(reject); }
  finally(fn) { return this._exec().finally(fn); }
  async _populateRef(doc, path, nested) {
    const refVal = doc[path]; if (!refVal) return doc;
    const nameMap = { tenantId: 'Tenant', tenant: 'Tenant', userId: 'User', roomId: 'Room', room: 'Room', floor: 'Floor', floorId: 'Floor', invoiceId: 'Invoice' };
    const targetModel = nameMap[path] || path.charAt(0).toUpperCase() + path.slice(1).replace(/Id$/, '');
    const targetCol = collections.get(targetModel); if (!targetCol) return doc;
    const refStr = typeof refVal === 'object' ? String(refVal._id) : String(refVal);
    const targetDoc = targetCol.docs.get(refStr); if (!targetDoc) return doc;
    let populated = { ...targetDoc, id: String(targetDoc._id ?? '') }; delete populated.__v;
    if (nested) {
      populated = await this._populateRef(populated, nested.path, nested.populate);
      if (nested.select) {
        const fields = nested.select.split(/\s+/); const filtered = {};
        for (const f of fields) filtered[f] = populated[f]; populated = filtered;
      }
    }
    return { ...doc, [path]: populated };
  }
  async _exec() {
    let docs = [...this._collection.docs.values()].filter(d => this._matchDoc(d));
    if (Object.keys(this._sortFields).length > 0) {
      docs.sort((a, b) => {
        for (const [field, order] of Object.entries(this._sortFields)) {
          const av = a[field], bv = b[field];
          let cmp = av == null && bv == null ? 0 : av == null ? -1 : bv == null ? 1
            : typeof av === 'string' ? av.localeCompare(bv || '') : av instanceof Date ? av.getTime() - (bv?.getTime() || 0) : Number(av) - Number(bv);
          if (cmp !== 0) return cmp * order;
        } return 0;
      });
    }
    if (this._skipCount > 0) docs = docs.slice(this._skipCount);
    if (this._limitCount > 0) docs = docs.slice(0, this._limitCount);
    for (const pop of this._populatePaths) {
      docs = await Promise.all(docs.map(async d =>
        typeof pop === 'string' ? this._populateRef(d, pop) : this._populateRef(d, pop.path, pop.populate)
      ));
    }
    if (this._selectFields && typeof this._selectFields === 'string') {
      docs = docs.map(d => { const cp = { ...d }; this._selectFields.split(/\s+/).forEach(f => { if (f.startsWith('-')) delete cp[f.slice(1)]; }); return cp; });
    }
    if (!this._leanResult) docs = docs.map(d => new Document(this._modelName, d, this._collection));
    else docs = docs.map(d => { const p = { ...d, id: String(d._id ?? '') }; delete p.__v; return p; });
    return this._limitCount === 1 ? (docs[0] ?? null) : docs;
  }
}

class AggregateChain {
  constructor(modelName, stages) { this._modelName = modelName; this._stages = stages; }
  then(resolve, reject) { return this._exec().then(resolve, reject); }
  catch(reject) { return this._exec().catch(reject); }
  async _exec() {
    const col = getCollection(this._modelName);
    let docs = [...col.docs.values()].map(d => ({ ...d }));
    for (const stage of this._stages) {
      if (stage.$match) { const q = new QueryChain(this._modelName); q._filter = stage.$match; docs = docs.filter(d => q._matchDoc(d)); }
      else if (stage.$group) { docs = this._group(docs, stage.$group); }
      else if (stage.$sort) {
        const so = stage.$sort;
        docs.sort((a, b) => {
          for (const [field, order] of Object.entries(so)) {
            const av = a[field], bv = b[field];
            let cmp = av == null && bv == null ? 0 : av == null ? -1 : bv == null ? 1
              : typeof av === 'string' ? av.localeCompare(bv || '') : Number(av) - Number(bv);
            if (cmp !== 0) return cmp * order;
          } return 0;
        });
      }
    }
    return docs.map(d => { d.id = String(d._id ?? ''); return d; });
  }
  _group(docs, group) {
    const idExpr = group._id; const groups = new Map();
    for (const doc of docs) {
      const key = typeof idExpr === 'string' ? String(doc[idExpr] ?? 'null')
        : Object.entries(idExpr).map(([k, v]) => `${k}=${doc[v] ?? 'null'}`).join('|');
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(doc);
    }
    const results = [];
    for (const [key, grpDocs] of groups) {
      const result = { _id: key };
      for (const [field, expr] of Object.entries(group)) {
        if (field === '_id') continue;
        if (expr.$sum !== undefined) result[field] = grpDocs.reduce((s, d) => s + (Number(d[expr.$sum]) || 0), 0);
        else if (expr.$avg !== undefined) {
          const vals = grpDocs.map(d => Number(d[expr.$avg]) || 0);
          result[field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
      }
      results.push(result);
    }
    return results;
  }
}

const models = {};

function createModel(name, schema) {
  const col = getCollection(name);
  if (schema) {
    col.preSaveHooks = (schema._hooks.pre.save || []).map(fn => (doc) => fn.call({ _doc: doc, isModified: () => true }, function() {}));
    if (schema._toJSON?.transform) col.toJSONTransform = schema._toJSON.transform;
    if (schema._toObject?.transform) col.toObjectTransform = schema._toObject.transform;
    if (schema._virtuals) col.virtuals = schema._virtuals;
    if (schema._statics) col.statics = schema._statics;
    if (schema._methods) col.methods = schema._methods;
  }
  const m = {
    find(f) { return new QueryChain(name).find(f); },
    findById(id) { return new QueryChain(name).findById(id); },
    findOne(f) { return new QueryChain(name).findOne(f); },
    countDocuments(f = {}) { const q = new QueryChain(name); q._filter = f; return q._exec().then(r => r.length); },
    async create(data) {
      const docData = Array.isArray(data) ? data[0] : data;
      const _id = docData._id || generateObjectId(); const now = new Date();
      const doc = { ...docData, _id, __v: 0, createdAt: now, updatedAt: now };
      for (const h of col.preSaveHooks) await h(doc);
      col.docs.set(_id, doc);
      for (const h of col.postSaveHooks) await h(doc);
      return Array.isArray(data) ? [doc] : doc;
    },
    async insertMany(items) {
      const results = [];
      for (const item of items) {
        const _id = item._id || generateObjectId(); const now = new Date();
        const doc = { ...item, _id, __v: 0, createdAt: now, updatedAt: now };
        for (const h of col.preSaveHooks) await h(doc);
        col.docs.set(_id, doc);
        for (const h of col.postSaveHooks) await h(doc);
        results.push(doc);
      }
      return results;
    },
    async findByIdAndUpdate(id, update, opts = {}) {
      const doc = col.docs.get(id); if (!doc) return null;
      Object.assign(doc, update); doc.updatedAt = new Date();
      return opts.new ? { ...doc, id: doc._id } : doc;
    },
    async findByIdAndDelete(id) { const doc = col.docs.get(id); if (!doc) return null; col.docs.delete(id); return doc; },
    findOneAndUpdate(filter, update, opts = {}) {
      const q = new QueryChain(name); q._filter = filter;
      return q._exec().then(async docs => {
        const target = docs[0]; if (!target) return null;
        const stored = col.docs.get(String(target._id ?? ''));
        if (!stored) return null;
        Object.assign(stored, update); stored.updatedAt = new Date();
        return opts.new ? { ...stored, id: stored._id } : stored;
      });
    },
    async updateMany(filter, update) {
      const q = new QueryChain(name); q._filter = filter;
      const docs = await q._exec(); let count = 0;
      for (const d of docs) {
        const stored = col.docs.get(String(d._id ?? ''));
        if (stored) { Object.assign(stored, update.$set || update); stored.updatedAt = new Date(); count++; }
      }
      return { modifiedCount: count };
    },
    aggregate(pipeline) { return new AggregateChain(name, pipeline); },
  };
  if (schema && schema._statics) {
    for (const [key, val] of Object.entries(schema._statics)) {
      if (typeof val === 'function') m[key] = val.bind(m);
      else m[key] = val;
    }
  }
  return m;
}

const MockMongoose = {
  Schema,
  model(name, schema) {
    if (!schema) return models[name];
    const m = createModel(name, schema);
    models[name] = m;
    return m;
  },
  Error: {
    ValidationError: class extends Error {
      constructor(msg = 'Validation failed') { super(msg); this.name = 'ValidationError'; this.errors = {}; }
    },
    CastError: class extends Error {
      constructor(type, value) { super(`Cast to ${type} failed for "${value}"`); this.name = 'CastError'; this.value = value; }
    },
  },
  Types: { ObjectId },
  connect: async (uri, opts) => { /* no-op for mock */ },
  disconnect: async () => {},
  connection: { readyState: 1, on() {} },
  startSession: async () => ({
    id: generateObjectId(),
    _inTransaction: false,
    async withTransaction(fn) { try { await fn(); } finally {} },
    endSession() {},
  }),
  // Internals for seeding
  __collections: collections,
  __getCollection: getCollection,
  __generateObjectId: generateObjectId,
};

module.exports = MockMongoose;
