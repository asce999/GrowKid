/**
 * Part of the stand-in (see ./fake.js). Proof files are too big for localStorage, so they live
 * in IndexedDB, keyed by proof id. The real server keeps them in cloud storage instead.
 */
const open = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('growkid-fake', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('files')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

async function run(mode, work) {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', mode)
      const request = work(transaction.objectStore('files'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error) // the storage is full, for one
    })
  } finally {
    db.close()
  }
}

export const putFile = (id, file) => run('readwrite', (store) => store.put(file, id))
export const getFile = (id) => run('readonly', (store) => store.get(id))
export const deleteFile = (id) => run('readwrite', (store) => store.delete(id))
