/** Isolated transactional store for operation and audit regression tests. */
import { fromFirestoreValue } from '../firestore.js'

export function memoryStore(initial = {}) {
  const docs = new Map(Object.entries(structuredClone(initial)))
  let queue = Promise.resolve()
  let failCommit = null
  function document(path, source = docs) {
    const data = source.get(path)
    return data
      ? { id: path.split('/').at(-1), data: structuredClone(data) }
      : null
  }
  function query(query, source = docs) {
    const collection = query.from[0].collectionId
    const filter = (data, where) => {
      if (!where) return true
      if (where.compositeFilter)
        return where.compositeFilter.filters.every((part) => filter(data, part))
      const f = where.fieldFilter
      return f.op === 'EQUAL'
        ? data[f.field.fieldPath] === fromFirestoreValue(f.value)
        : data[f.field.fieldPath] <= fromFirestoreValue(f.value)
    }
    let results = [...source.keys()]
      .filter((path) => path.startsWith(collection + '/'))
      .map((path) => document(path, source))
      .filter((doc) => filter(doc.data, query.where))
    for (const order of [...(query.orderBy || [])].reverse()) {
      results = results.filter(
        (doc) => doc.data[order.field.fieldPath] !== undefined,
      )
      results.sort(
        (a, b) =>
          (a.data[order.field.fieldPath] > b.data[order.field.fieldPath]
            ? 1
            : a.data[order.field.fieldPath] < b.data[order.field.fieldPath]
              ? -1
              : 0) * (order.direction === 'DESCENDING' ? -1 : 1),
      )
    }
    return results.slice(0, query.limit || results.length)
  }
  const store = {
    docs,
    failNextCommit(error) {
      failCommit = error
    },
    get: async (collection, id) => document(`${collection}/${id}`),
    query: async (q) => query(q),
    transact(work) {
      const result = queue.then(async () => {
        const snapshot = structuredClone(docs)
        const writes = []
        const tx = {
          get: async (collection, id) =>
            document(`${collection}/${id}`, snapshot),
          query: async (q) => query(q, snapshot),
          create: (path, data) => writes.push({ path, data, create: true }),
          update: (path, data) =>
            writes.push({ path, data, merge: true, requireExists: true }),
          delete: (path) => writes.push({ path, delete: true }),
          write(write) {
            const path = (write.update?.name || write.delete).split(
              '/documents/',
            )[1]
            const data = write.update
              ? Object.fromEntries(
                  Object.entries(write.update.fields).map(([key, value]) => [
                    key,
                    fromFirestoreValue(value),
                  ]),
                )
              : null
            writes.push({
              path,
              data,
              delete: !!write.delete,
              merge: !!write.updateMask,
              requireExists: write.currentDocument?.exists === true,
              create: write.currentDocument?.exists === false,
            })
          },
        }
        const value = await work(tx)
        if (failCommit) {
          const failure = failCommit
          failCommit = null
          throw failure
        }
        for (const write of writes) {
          if (write.create && snapshot.has(write.path))
            throw new Error('Document already exists')
          if (write.requireExists && !snapshot.has(write.path))
            throw new Error('Missing document')
          if (write.delete) snapshot.delete(write.path)
          else
            snapshot.set(
              write.path,
              structuredClone(
                write.merge
                  ? { ...snapshot.get(write.path), ...write.data }
                  : write.data,
              ),
            )
        }
        docs.clear()
        for (const [path, data] of snapshot) docs.set(path, data)
        return value
      })
      queue = result.catch(() => {})
      return result
    },
  }
  return store
}
